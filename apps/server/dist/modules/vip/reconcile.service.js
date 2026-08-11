"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ReconcileService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReconcileService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@yuanqiao/shared");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
const pay_registry_1 = require("./pay/pay.registry");
/**
 * 每日对账。
 *
 * 为什么必须做：支付链路再怎么写幂等，也挡不住网络抖动导致的
 * "渠道扣了钱但回调没到"。没有对账，这种单子会一直挂在"待支付"，
 * 用户投诉时你连有没有收到钱都查不出来。
 *
 * 四种结果：
 *   MATCHED         平账
 *   MISSING_LOCAL   渠道有、我方无 —— 最危险，用户付了钱没拿到权益
 *   MISSING_REMOTE  我方有、渠道无 —— 通常是测试数据或人工改库
 *   AMOUNT_MISMATCH 金额不符 —— 要么被篡改，要么有部分退款没同步
 */
let ReconcileService = ReconcileService_1 = class ReconcileService {
    prisma;
    pay;
    logger = new common_1.Logger(ReconcileService_1.name);
    constructor(prisma, pay) {
        this.prisma = prisma;
        this.pay = pay;
    }
    /** 对某一天的账。date 格式 YYYY-MM-DD，默认昨天。 */
    async reconcile(date) {
        const day = date ?? (0, shared_1.toDateStr)(new Date(Date.now() - 86400_000));
        const start = new Date(`${day}T00:00:00+08:00`);
        const end = new Date(`${day}T23:59:59.999+08:00`);
        const provider = this.pay.get();
        const channel = provider.channel;
        // 我方：当天支付成功的流水
        const local = await this.prisma.paymentTxn.findMany({
            where: {
                status: shared_1.PaymentStatus.SUCCESS,
                channel,
                notifiedAt: { gte: start, lte: end },
            },
            select: { outTradeNo: true, transactionId: true, amount: true },
        });
        const localAmount = local.reduce((s, t) => s + t.amount, 0);
        // 渠道：拉对账单
        const remote = provider.fetchBill ? await provider.fetchBill(day) : null;
        if (!remote) {
            // 渠道不支持拉账单（比如 mock），只做本地自检：
            // 找出"订单已支付但没有成功流水"和"有成功流水但订单没标已支付"的
            const orphans = await this.selfCheck(start, end);
            const result = orphans.length ? shared_1.ReconcileResult.AMOUNT_MISMATCH : shared_1.ReconcileResult.MATCHED;
            await this.save(day, channel, result, local.length, localAmount, 0, 0, orphans);
            if (orphans.length) {
                this.logger.error(`【对账】${day} 本地自检发现 ${orphans.length} 条异常`);
            }
            else {
                this.logger.log(`【对账】${day} 本地自检通过：${local.length} 笔 ¥${(0, shared_1.fenToYuan)(localAmount)}`);
            }
            return {
                date: day, channel, result,
                localCount: local.length, localAmount,
                remoteCount: 0, remoteAmount: 0,
                diffs: orphans,
            };
        }
        const remoteAmount = remote.reduce((s, t) => s + t.amount, 0);
        const localByNo = new Map(local.map((l) => [l.outTradeNo, l]));
        const remoteByNo = new Map(remote.map((r) => [r.outTradeNo, r]));
        const diffs = [];
        for (const r of remote) {
            const l = localByNo.get(r.outTradeNo);
            if (!l) {
                diffs.push({ type: shared_1.ReconcileResult.MISSING_LOCAL, ...r });
            }
            else if (l.amount !== r.amount) {
                diffs.push({
                    type: shared_1.ReconcileResult.AMOUNT_MISMATCH,
                    outTradeNo: r.outTradeNo,
                    local: l.amount,
                    remote: r.amount,
                });
            }
        }
        for (const l of local) {
            if (!remoteByNo.has(l.outTradeNo)) {
                diffs.push({ type: shared_1.ReconcileResult.MISSING_REMOTE, ...l });
            }
        }
        const result = diffs.length
            ? (diffs[0].type ?? shared_1.ReconcileResult.AMOUNT_MISMATCH)
            : shared_1.ReconcileResult.MATCHED;
        await this.save(day, channel, result, local.length, localAmount, remote.length, remoteAmount, diffs);
        if (diffs.length) {
            this.logger.error(`【对账告警】${day} ${channel} 有 ${diffs.length} 条差异：` +
                `我方 ${local.length} 笔 ¥${(0, shared_1.fenToYuan)(localAmount)}，渠道 ${remote.length} 笔 ¥${(0, shared_1.fenToYuan)(remoteAmount)}`);
        }
        else {
            this.logger.log(`【对账】${day} ${channel} 平账：${local.length} 笔 ¥${(0, shared_1.fenToYuan)(localAmount)}`);
        }
        return {
            date: day, channel, result,
            localCount: local.length, localAmount,
            remoteCount: remote.length, remoteAmount,
            diffs,
        };
    }
    /** 本地一致性自检：订单状态与支付流水必须对得上 */
    async selfCheck(start, end) {
        const out = [];
        // 订单标了已支付，却没有成功流水
        const paidNoTxn = await this.prisma.order.findMany({
            where: {
                status: shared_1.OrderStatus.PAID,
                paidAt: { gte: start, lte: end },
                payments: { none: { status: shared_1.PaymentStatus.SUCCESS } },
            },
            select: { orderNo: true, amount: true, paidAt: true },
        });
        out.push(...paidNoTxn.map((o) => ({ type: 'PAID_WITHOUT_TXN', ...o })));
        // 有成功流水，订单却不是已支付/已退款
        const txnNoPaid = await this.prisma.paymentTxn.findMany({
            where: {
                status: shared_1.PaymentStatus.SUCCESS,
                notifiedAt: { gte: start, lte: end },
                order: { status: { notIn: [shared_1.OrderStatus.PAID, shared_1.OrderStatus.REFUNDING, shared_1.OrderStatus.REFUNDED] } },
            },
            select: { outTradeNo: true, amount: true, order: { select: { orderNo: true, status: true } } },
        });
        out.push(...txnNoPaid.map((t) => ({ type: 'TXN_WITHOUT_PAID_ORDER', ...t })));
        return out;
    }
    async save(date, channel, result, localCount, localAmount, remoteCount, remoteAmount, detail) {
        await this.prisma.reconcileRecord.upsert({
            where: { date_channel: { date, channel } },
            create: {
                date, channel, result,
                localCount, localAmount, remoteCount, remoteAmount,
                detail: detail,
            },
            update: {
                result, localCount, localAmount, remoteCount, remoteAmount,
                detail: detail,
            },
        });
    }
    async list(limit = 30) {
        return this.prisma.reconcileRecord.findMany({
            orderBy: { date: 'desc' },
            take: limit,
        });
    }
};
exports.ReconcileService = ReconcileService;
exports.ReconcileService = ReconcileService = ReconcileService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        pay_registry_1.PayProviderRegistry])
], ReconcileService);
//# sourceMappingURL=reconcile.service.js.map