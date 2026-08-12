/**
 * 集中式配置。所有 process.env 的读取都收敛到这里，
 * 业务代码只从 ConfigService 拿强类型的值，不到处 process.env.XXX。
 */

function int(v: string | undefined, def: number): number {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : def;
}

function bool(v: string | undefined, def = false): boolean {
  if (v == null || v === '') return def;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

/**
 * JWT 有效期。jsonwebtoken 的类型要求是 `ms` 的模板字面量（"7d"/"30m"…）或秒数，
 * 普通 string 不被接受，所以这里收紧成同样的形状，避免每个调用点都强转。
 */
export type ExpiresIn = `${number}${'s' | 'm' | 'h' | 'd'}` | number;

const EXPIRES_RE = /^\d+[smhd]$/;

function expiresIn(v: string | undefined, def: ExpiresIn): ExpiresIn {
  if (!v) return def;
  if (EXPIRES_RE.test(v)) return v as ExpiresIn;
  const n = Number.parseInt(v, 10);
  if (Number.isFinite(n)) return n;
  throw new Error(`无效的有效期格式："${v}"，应为 7d / 30m / 3600 这类`);
}

export interface AppConfig {
  env: string;
  isProd: boolean;
  port: number;
  apiPrefix: string;
  publicBaseUrl: string;
  jwt: {
    secret: string;
    expiresIn: ExpiresIn;
    refreshExpiresIn: ExpiresIn;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  storage: {
    driver: 'local' | 'oss';
    uploadDir: string;
  };
  ai: {
    provider: 'mock' | 'openai-compatible';
    baseUrl: string;
    apiKey: string;
    chatModel: string;
    embeddingBaseUrl: string;
    embeddingApiKey: string;
    embeddingModel: string;
    embeddingDim: number;
    embeddingBatchSize: number;
    timeoutMs: number;
  };
  pay: {
    provider: 'mock' | 'wechat';
    wechat: {
      appId: string;
      mchId: string;
      apiV3Key: string;
      serialNo: string;
      privateKeyPath: string;
      notifyUrl: string;
    };
  };
  wxMini: {
    appId: string;
    appSecret: string;
  };
  sms: {
    provider: 'mock' | 'aliyun' | 'tencent';
    mockCode: string;
  };
}

export default (): AppConfig => {
  const env = process.env.NODE_ENV ?? 'development';
  const secret = process.env.JWT_SECRET ?? '';

  // 生产环境用默认密钥直接拒绝启动——这种事出一次就是全站被伪造 token
  if (env === 'production' && (!secret || secret.startsWith('dev-only'))) {
    throw new Error(
      '生产环境必须设置 JWT_SECRET（且不能用样例值）。生成：openssl rand -hex 32',
    );
  }

  return {
    env,
    isProd: env === 'production',
    port: int(process.env.SERVER_PORT, 3000),
    apiPrefix: process.env.API_PREFIX ?? '/api',
    publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
    jwt: {
      secret: secret || 'dev-only-change-me-0123456789abcdef',
      expiresIn: expiresIn(process.env.JWT_EXPIRES_IN, '7d'),
      refreshExpiresIn: expiresIn(process.env.JWT_REFRESH_EXPIRES_IN, '30d'),
    },
    redis: {
      host: process.env.REDIS_HOST ?? '127.0.0.1',
      port: int(process.env.REDIS_PORT, 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      db: int(process.env.REDIS_DB, 0),
    },
    storage: {
      driver: (process.env.STORAGE_DRIVER as 'local' | 'oss') ?? 'local',
      uploadDir: process.env.UPLOAD_DIR ?? './uploads',
    },
    ai: {
      provider: (process.env.AI_PROVIDER as 'mock' | 'openai-compatible') ?? 'mock',
      baseUrl: process.env.AI_BASE_URL ?? '',
      apiKey: process.env.AI_API_KEY ?? '',
      chatModel: process.env.AI_CHAT_MODEL ?? 'deepseek-chat',
      embeddingBaseUrl: process.env.AI_EMBEDDING_BASE_URL ?? '',
      embeddingApiKey: process.env.AI_EMBEDDING_API_KEY ?? '',
      embeddingModel: process.env.AI_EMBEDDING_MODEL ?? 'text-embedding-v3',
      embeddingDim: int(process.env.AI_EMBEDDING_DIM, 1024),
      embeddingBatchSize: int(process.env.AI_EMBEDDING_BATCH_SIZE, 25),
      // 推理型模型出字慢，单次三四十秒是常态，20 秒的默认值会把正常请求判成超时
      timeoutMs: int(process.env.AI_TIMEOUT_MS, 60000),
    },
    pay: {
      provider: (process.env.PAY_PROVIDER as 'mock' | 'wechat') ?? 'mock',
      wechat: {
        appId: process.env.WXPAY_APP_ID ?? '',
        mchId: process.env.WXPAY_MCH_ID ?? '',
        apiV3Key: process.env.WXPAY_API_V3_KEY ?? '',
        serialNo: process.env.WXPAY_SERIAL_NO ?? '',
        privateKeyPath: process.env.WXPAY_PRIVATE_KEY_PATH ?? '',
        notifyUrl: process.env.WXPAY_NOTIFY_URL ?? '',
      },
    },
    wxMini: {
      appId: process.env.WX_MINI_APP_ID ?? '',
      appSecret: process.env.WX_MINI_APP_SECRET ?? '',
    },
    sms: {
      provider: (process.env.SMS_PROVIDER as 'mock' | 'aliyun' | 'tencent') ?? 'mock',
      mockCode: process.env.SMS_MOCK_CODE ?? '8888',
    },
  };
};

export const isDebugEnabled = bool(process.env.DEBUG_SQL, false);
