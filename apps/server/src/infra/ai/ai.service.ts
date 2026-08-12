import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@/config/configuration';
import { RedisService } from '@/infra/redis/redis.service';
import {
  AiProvider,
  ChatMessage,
  MockAiProvider,
  OpenAiCompatProvider,
} from './ai.provider';

/**
 * AI 服务。对上层只暴露"要向量"和"要一句推荐理由"，
 * 上层不关心背后是 mock 还是 DeepSeek。
 *
 * 所有对外调用都带兜底：AI 挂了不能让匹配接口挂掉，
 * 降级为"没有 AI 层"，L1+L2 照常出结果。
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  /** 对话通道 */
  private readonly provider: AiProvider;
  /**
   * 向量通道。多数时候和 provider 是同一个对象。
   *
   * 分开拿是因为现实里这俩常常不是同一家：DeepSeek 只有对话没有 embedding，
   * 中转服务的分组也可能只挂了对话模型。这时候对话用真模型、向量退回 mock，
   * 比让向量去打一个不存在的接口、吃 503 再重试退避要好。
   */
  private readonly embedProvider: AiProvider;

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly redis: RedisService,
  ) {
    const ai = this.config.get('ai', { infer: true });
    const mock = new MockAiProvider(256);

    // ── 对话通道 ──
    if (ai.provider === 'openai-compatible' && ai.apiKey) {
      this.provider = new OpenAiCompatProvider({
        chatBaseUrl: ai.baseUrl,
        chatApiKey: ai.apiKey,
        chatModel: ai.chatModel,
        // 这个实例只用来 chat，下面的 embedding 字段填了也不会走到
        embeddingBaseUrl: ai.embeddingBaseUrl || ai.baseUrl,
        embeddingApiKey: ai.embeddingApiKey || ai.apiKey,
        embeddingModel: ai.embeddingModel,
        embeddingDim: ai.embeddingDim,
        embeddingBatchSize: ai.embeddingBatchSize,
        timeoutMs: ai.timeoutMs,
      });
      this.logger.log(`AI 对话：${ai.chatModel} @ ${ai.baseUrl}`);
    } else {
      this.provider = mock;
      this.logger.warn('AI 对话：mock（未配置 AI_API_KEY），推荐理由是模板拼的');
    }

    // ── 向量通道 ──
    // 必须显式配了 embedding 的 key 才启用真模型。
    // 不从对话 key 自动推导：对话供应商很可能根本没有 embedding 接口，
    // 推导过去的结果是每次匹配都去打一个 404/503 的地址，白白拖慢请求。
    if (ai.embeddingApiKey && (ai.embeddingBaseUrl || ai.baseUrl)) {
      this.embedProvider = new OpenAiCompatProvider({
        chatBaseUrl: ai.embeddingBaseUrl || ai.baseUrl,
        chatApiKey: ai.embeddingApiKey,
        chatModel: ai.chatModel,
        embeddingBaseUrl: ai.embeddingBaseUrl || ai.baseUrl,
        embeddingApiKey: ai.embeddingApiKey,
        embeddingModel: ai.embeddingModel,
        embeddingDim: ai.embeddingDim,
        embeddingBatchSize: ai.embeddingBatchSize,
        timeoutMs: ai.timeoutMs,
      });
      this.logger.log(`AI 向量：${ai.embeddingModel} @ ${ai.embeddingBaseUrl || ai.baseUrl}`);
    } else {
      this.embedProvider = mock;
      this.logger.warn(
        'AI 向量：mock（未配置 AI_EMBEDDING_API_KEY）。语义匹配退化为词面重合度，L1+L2 不受影响。',
      );
    }
  }

  get isReal(): boolean {
    return this.provider.isReal;
  }

  get providerName(): string {
    return this.provider.name;
  }

  /** 向量的来源标识，落库时跟着存，用于识别旧模型算的向量 */
  get embeddingModelId(): string {
    return this.embedProvider.embeddingModelId;
  }

  get isEmbeddingReal(): boolean {
    return this.embedProvider.isReal;
  }

  /** 批量向量化，失败返回 null（调用方降级） */
  async embed(texts: string[]): Promise<number[][] | null> {
    if (!texts.length) return [];
    try {
      return await this.embedProvider.embed(texts);
    } catch (e) {
      this.logger.error(`向量化失败：${(e as Error).message}`);
      return null;
    }
  }

  async embedOne(text: string): Promise<number[] | null> {
    const r = await this.embed([text]);
    return r?.[0] ?? null;
  }

  /**
   * 生成推荐理由。带 Redis 缓存——同一对人的理由不会天天变，
   * 而且这是真金白银的 token 消耗。
   */
  async generateMatchReason(input: {
    cacheKey: string;
    selfDesc: string;
    otherDesc: string;
    highlights: string[];
    concerns: string[];
    score: number;
  }): Promise<string | null> {
    const cached = await this.redis.get(`ai:reason:${input.cacheKey}`);
    if (cached) return cached;

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          '你是一位经验丰富的婚恋红娘助理。根据两人的资料和系统算出的匹配点，' +
          '写一句 40-80 字的中文推荐理由，给红娘和用户看。' +
          '要求：具体、克制、不夸张、不承诺结果；只说资料里有的事实；不要用"完美""天作之合"这类词。',
      },
      {
        role: 'user',
        content: [
          `综合匹配分：${input.score}/100`,
          `会员A自述：${input.selfDesc.slice(0, 300) || '（未填写）'}`,
          `会员B自述：${input.otherDesc.slice(0, 300) || '（未填写）'}`,
          `系统识别的契合点：${input.highlights.join('、') || '无'}`,
          `需要留意：${input.concerns.join('、') || '无'}`,
        ].join('\n'),
      },
    ];

    try {
      const text = await this.provider.chat(messages, { maxTokens: 200, temperature: 0.6 });
      if (text) await this.redis.set(`ai:reason:${input.cacheKey}`, text, 7 * 24 * 3600);
      return text || null;
    } catch (e) {
      this.logger.error(`生成推荐理由失败：${(e as Error).message}`);
      return null;
    }
  }
}
