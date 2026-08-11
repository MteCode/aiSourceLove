"use strict";
/**
 * 支付通道抽象。
 *
 * MVP 用 MockPayProvider 跑通全链路（下单→支付→发权益→分润→退款），
 * 接微信支付时只要实现同一个接口，业务代码一行不改。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WechatPayProvider = exports.MockPayProvider = void 0;
// ─────────────────────────────────────────────
/**
 * 模拟支付通道。
 *
 * 用途：本地/演示环境跑通完整链路。
 * 它返回一个 payUrl，前端（或 curl）打过去就相当于"用户付了钱"，
 * 服务端收到后走的是和真实回调**完全相同**的处理路径——
 * 这样接真通道时不会出现"mock 能跑真的不能跑"。
 */
class MockPayProvider {
    publicBaseUrl;
    channel = 'MOCK';
    constructor(publicBaseUrl) {
        this.publicBaseUrl = publicBaseUrl;
    }
    async createPayment(params) {
        return {
            channel: 'MOCK',
            outTradeNo: params.outTradeNo,
            amount: String(params.amount),
            // 前端拿这个地址发 POST 就模拟支付成功
            payUrl: `${this.publicBaseUrl}/api/pay/mock/confirm`,
            tip: '模拟支付：POST payUrl，body 传 {"outTradeNo":"...","success":true}',
        };
    }
    async parseNotify(_headers, rawBody) {
        const body = JSON.parse(rawBody);
        if (!body.outTradeNo)
            throw new Error('缺少 outTradeNo');
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
    notifyResponse(success, message) {
        return { code: success ? 'SUCCESS' : 'FAIL', message: message ?? 'OK' };
    }
    async refund(params) {
        return { success: true, refundId: `MOCKREF_${params.outRefundNo}` };
    }
    async fetchBill() {
        // mock 通道没有真实账单，返回 null 让对账任务跳过远端比对
        return null;
    }
}
exports.MockPayProvider = MockPayProvider;
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
class WechatPayProvider {
    config;
    channel = 'WECHAT';
    constructor(config) {
        this.config = config;
    }
    notImplemented() {
        throw new Error('微信支付尚未接入。请在 .env 配置 WXPAY_* 并实现 WechatPayProvider' +
            '（建议用 wechatpay-node-v3），或将 PAY_PROVIDER 设为 mock。');
    }
    async createPayment(_params) {
        this.notImplemented();
    }
    async parseNotify() {
        this.notImplemented();
    }
    notifyResponse(success, message) {
        return success ? { code: 'SUCCESS' } : { code: 'FAIL', message: message ?? '处理失败' };
    }
    async refund() {
        this.notImplemented();
    }
}
exports.WechatPayProvider = WechatPayProvider;
//# sourceMappingURL=pay.provider.js.map