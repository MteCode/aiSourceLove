/**
 * 支付通道抽象。
 *
 * MVP 用 MockPayProvider 跑通全链路（下单→支付→发权益→分润→退款），
 * 接微信支付时只要实现同一个接口，业务代码一行不改。
 */

export interface CreatePayParams {
  outTradeNo: string;
  /** 分 */
  amount: number;
  description: string;
  /** 微信 JSAPI 需要 */
  openid?: string;
  clientIp?: string;
  notifyUrl: string;
}

/** 前端拉起支付需要的参数。mock 通道返回一个可以直接点的确认地址。 */
export type PayParams = Record<string, string>;

/** 从渠道回调里解析出来的结果 */
export interface NotifyResult {
  outTradeNo: string;
  /** 渠道交易号 —— 幂等的关键 */
  transactionId: string;
  /** 分 */
  amount: number;
  success: boolean;
  paidAt: Date;
  raw: unknown;
}

export interface RefundParams {
  outTradeNo: string;
  outRefundNo: string;
  /** 分 */
  totalAmount: number;
  refundAmount: number;
  reason?: string;
}

export interface PayProvider {
  readonly channel: 'MOCK' | 'WECHAT' | 'ALIPAY';
  createPayment(params: CreatePayParams): Promise<PayParams>;
  /** 解析并**验签**回调。验签失败必须抛错——不验签的回调接口等于把钱包挂在网上。 */
  parseNotify(headers: Record<string, string | string[] | undefined>, rawBody: string): Promise<NotifyResult>;
  /** 回调处理完要返回给渠道的响应体 */
  notifyResponse(success: boolean, message?: string): unknown;
  refund(params: RefundParams): Promise<{ success: boolean; refundId: string }>;
  /** 拉取某天的对账单，用于每日对账。不支持则返回 null。 */
  fetchBill?(date: string): Promise<{ outTradeNo: string; transactionId: string; amount: number }[] | null>;
}

// ─────────────────────────────────────────────

/**
 * 模拟支付通道。
 *
 * 用途：本地/演示环境跑通完整链路。
 * 它返回一个 payUrl，前端（或 curl）打过去就相当于"用户付了钱"，
 * 服务端收到后走的是和真实回调**完全相同**的处理路径——
 * 这样接真通道时不会出现"mock 能跑真的不能跑"。
 */
export class MockPayProvider implements PayProvider {
  readonly channel = 'MOCK' as const;

  constructor(private readonly publicBaseUrl: string) {}

  async createPayment(params: CreatePayParams): Promise<PayParams> {
    return {
      channel: 'MOCK',
      outTradeNo: params.outTradeNo,
      amount: String(params.amount),
      // 前端拿这个地址发 POST 就模拟支付成功
      payUrl: `${this.publicBaseUrl}/api/pay/mock/confirm`,
      tip: '模拟支付：POST payUrl，body 传 {"outTradeNo":"...","success":true}',
    };
  }

  async parseNotify(
    _headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ): Promise<NotifyResult> {
    const body = JSON.parse(rawBody) as {
      outTradeNo?: string;
      amount?: number;
      success?: boolean;
      transactionId?: string;
    };
    if (!body.outTradeNo) throw new Error('缺少 outTradeNo');
    return {
      outTradeNo: body.outTradeNo,
      // 模拟渠道交易号：固定由 outTradeNo 派生，这样重复提交同一笔会命中唯一键，
      // 正好能验证幂等逻辑真的生效
      transactionId: body.transactionId ?? `MOCK_${body.outTradeNo}`,
      amount: body.amount ?? 0,
      success: body.success !== false,
      paidAt: new Date(),
      raw: body,
    };
  }

  notifyResponse(success: boolean, message?: string) {
    return { code: success ? 'SUCCESS' : 'FAIL', message: message ?? 'OK' };
  }

  async refund(params: RefundParams) {
    return { success: true, refundId: `MOCKREF_${params.outRefundNo}` };
  }

  async fetchBill() {
    // mock 通道没有真实账单，返回 null 让对账任务跳过远端比对
    return null;
  }
}

// ─────────────────────────────────────────────

export interface WechatPayConfig {
  appId: string;
  mchId: string;
  apiV3Key: string;
  serialNo: string;
  privateKeyPath: string;
  notifyUrl: string;
}

/**
 * 微信支付 V3。
 *
 * 这里给出的是**接口骨架 + 关键实现要点**，没有把签名和证书链写完——
 * 那部分必须拿真实商户号联调，凭空写出来的代码在真实环境一定跑不通，
 * 留个能编译的假实现比留一段看起来能用其实不能用的代码更诚实。
 *
 * 接的时候要做的事（顺序别乱）：
 *  1. 用 wechatpay-node-v3 或官方 SDK，别自己拼签名
 *  2. 回调必须验签（Wechatpay-Signature + 平台证书），验不过直接 401
 *  3. 回调报文用 APIv3 密钥 AES-256-GCM 解密
 *  4. 回调返回 {"code":"SUCCESS"}，非 200 微信会重试 15 次
 *  5. 金额单位是分，和本系统一致，不要再换算
 */
export class WechatPayProvider implements PayProvider {
  readonly channel = 'WECHAT' as const;

  constructor(private readonly config: WechatPayConfig) {}

  private notImplemented(): never {
    throw new Error(
      '微信支付尚未接入。请在 .env 配置 WXPAY_* 并实现 WechatPayProvider' +
        '（建议用 wechatpay-node-v3），或将 PAY_PROVIDER 设为 mock。',
    );
  }

  async createPayment(_params: CreatePayParams): Promise<PayParams> {
    this.notImplemented();
  }

  async parseNotify(): Promise<NotifyResult> {
    this.notImplemented();
  }

  notifyResponse(success: boolean, message?: string) {
    return success ? { code: 'SUCCESS' } : { code: 'FAIL', message: message ?? '处理失败' };
  }

  async refund(): Promise<{ success: boolean; refundId: string }> {
    this.notImplemented();
  }
}
