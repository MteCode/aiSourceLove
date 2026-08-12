/**
 * AI 能力抽象层。
 *
 * 为什么要抽象：冷启动阶段用户少，纯规则效果比模型好，AI 层是第二期的事。
 * 但代码结构必须现在就留好口子，否则二期要动匹配引擎的核心逻辑。
 *
 * 两个实现：
 *   - MockAiProvider          无需 API key，本地/演示直接跑
 *   - OpenAiCompatProvider    DeepSeek / 通义 / Kimi / OpenAI 都是这个协议
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiProvider {
  readonly name: string;
  /** 文本向量化。返回值维度必须稳定。 */
  embed(texts: string[]): Promise<number[][]>;
  /** 对话补全，用于生成推荐理由 */
  chat(messages: ChatMessage[], opts?: { maxTokens?: number; temperature?: number }): Promise<string>;
  /** 该实现是否是真实模型（false 表示 mock，调用方可据此决定要不要扣权益） */
  readonly isReal: boolean;
  /**
   * 向量的来源标识，形如 `text-embedding-v3:1024` 或 `mock:256`。
   * 落库时跟着向量一起存：换了模型的向量彼此不可比，
   * 必须能识别出"这条是旧模型算的"从而重算，而不是拿去做余弦。
   */
  readonly embeddingModelId: string;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');

// ─────────────────────────────────────────────
//  Mock 实现
// ─────────────────────────────────────────────

/**
 * 确定性伪向量。
 *
 * 用的是 feature hashing（哈希技巧）：把文本切成 1-gram / 2-gram，
 * 每个 gram 哈希到固定维度上累加。它不理解语义，但**共享词越多余弦越高**，
 * 所以退化成了一个词面重合度算法——比返回随机数有用得多，
 * 而且完全确定：同样的输入永远同样的输出，测试和演示不会跳。
 */
export class MockAiProvider implements AiProvider {
  readonly name = 'mock';
  readonly isReal = false;
  readonly embeddingModelId: string;

  constructor(private readonly dim = 256) {
    this.embeddingModelId = `mock:${dim}`;
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.hashEmbed(t));
  }

  private hashEmbed(text: string): number[] {
    const vec = new Array<number>(this.dim).fill(0);
    const clean = (text ?? '').toLowerCase().replace(/[\s\p{P}]+/gu, '');
    if (!clean) return vec;

    const grams: string[] = [];
    // 中文按单字 + 双字切，英文这样切也能work（当作字符 n-gram）
    for (let i = 0; i < clean.length; i++) {
      grams.push(clean[i]);
      if (i + 1 < clean.length) grams.push(clean.slice(i, i + 2));
    }

    for (const g of grams) {
      const h = this.fnv1a(g);
      const idx = h % this.dim;
      // 用哈希的符号位决定 +1/-1，减少碰撞造成的系统性偏置
      vec[idx] += (h & 0x10000) === 0 ? 1 : -1;
    }

    // L2 归一化，让余弦相似度直接可比
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    return norm === 0 ? vec : vec.map((v) => v / norm);
  }

  private fnv1a(s: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h;
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    // 演示用：把用户消息里的关键信息拼一句话，明确标注是模拟输出
    const last = messages.filter((m) => m.role === 'user').pop()?.content ?? '';
    const hints: string[] = [];
    if (/同城|同一城市/.test(last)) hints.push('两人在同一城市，见面成本低');
    if (/年龄差\s*[0-3]\s*岁/.test(last)) hints.push('年龄相近');
    if (/学历/.test(last)) hints.push('学历相当');
    const body = hints.length ? hints.join('，') : '双方基础条件互相符合对方的择偶要求';
    return `【模拟推荐理由】${body}，建议红娘优先安排接触。（当前 AI_PROVIDER=mock，配置真实 API key 后此处会由大模型生成）`;
  }
}

// ─────────────────────────────────────────────
//  OpenAI 兼容实现
// ─────────────────────────────────────────────

export interface OpenAiCompatOptions {
  chatBaseUrl: string;
  chatApiKey: string;
  chatModel: string;
  embeddingBaseUrl: string;
  embeddingApiKey: string;
  embeddingModel: string;
  embeddingDim: number;
  timeoutMs?: number;
  /** embedding 接口单次最多几条文本。通义 25，OpenAI 2048，取小的更安全 */
  embeddingBatchSize?: number;
  /** 遇到 429 / 5xx 重试几次 */
  maxRetries?: number;
}

export class OpenAiCompatProvider implements AiProvider {
  readonly name = 'openai-compatible';
  readonly isReal = true;
  readonly embeddingModelId: string;

  constructor(private readonly opts: OpenAiCompatOptions) {
    this.embeddingModelId = `${opts.embeddingModel}:${opts.embeddingDim}`;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!texts.length) return [];
    const url = `${this.opts.embeddingBaseUrl.replace(/\/$/, '')}/embeddings`;
    const out = new Array<number[]>(texts.length);

    // 必须分批：各家 embedding 接口都有单次条数上限（通义 25 条、OpenAI 2048 条），
    // 匹配时一次要算几百上千条文本，整包发过去必被拒。
    const size = this.opts.embeddingBatchSize ?? 25;
    for (let start = 0; start < texts.length; start += size) {
      const slice = texts.slice(start, start + size);
      const res = await this.fetchJson<{ data: { embedding: number[]; index: number }[] }>(url, {
        apiKey: this.opts.embeddingApiKey,
        body: { model: this.opts.embeddingModel, input: slice, encoding_format: 'float' },
      });
      // 按 index 归位，别信返回顺序
      for (const d of res.data) out[start + d.index] = d.embedding;
    }

    for (let i = 0; i < out.length; i++) {
      if (!out[i]) throw new Error(`第 ${i} 条文本没拿到向量，接口返回不完整`);
    }
    return out;
  }

  async chat(
    messages: ChatMessage[],
    opts?: { maxTokens?: number; temperature?: number },
  ): Promise<string> {
    const url = `${this.opts.chatBaseUrl.replace(/\/$/, '')}/chat/completions`;
    const res = await this.fetchJson<{ choices: { message: { content: string } }[] }>(url, {
      apiKey: this.opts.chatApiKey,
      body: {
        model: this.opts.chatModel,
        messages,
        max_tokens: opts?.maxTokens ?? 300,
        temperature: opts?.temperature ?? 0.7,
        stream: false,
      },
    });
    return res.choices?.[0]?.message?.content?.trim() ?? '';
  }

  /**
   * 带重试的 POST。
   *
   * 只重试 429 和 5xx——这类是"再试一次可能就好了"。
   * 4xx（key 错、模型名错、参数错）重试多少次都是同样的错，立刻抛出去别浪费时间和配额。
   */
  private async fetchJson<T>(
    url: string,
    init: { apiKey: string; body: unknown },
  ): Promise<T> {
    const maxRetries = this.opts.maxRetries ?? 2;
    let lastErr: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.opts.timeoutMs ?? 20000);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${init.apiKey}`,
          },
          body: JSON.stringify(init.body),
          signal: ctrl.signal,
        });
        if (res.ok) return (await res.json()) as T;

        const text = await res.text().catch(() => '');
        const err = new Error(`AI 接口 ${res.status}: ${text.slice(0, 300)}`);
        if (res.status !== 429 && res.status < 500) throw err;
        lastErr = err;
      } catch (e) {
        // 超时和网络错误也值得重试；上面主动抛的 4xx 已经 return 出去了
        lastErr = e as Error;
        if (lastErr.message.startsWith('AI 接口 4')) throw lastErr;
      } finally {
        clearTimeout(timer);
      }

      if (attempt < maxRetries) {
        // 指数退避：1s、2s。限流场景下立刻重试只会继续撞墙
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      }
    }
    throw lastErr ?? new Error('AI 接口调用失败');
  }
}
