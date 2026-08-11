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
var BenefitService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BenefitService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@yuanqiao/shared");
const all_exceptions_filter_1 = require("../../common/filters/all-exceptions.filter");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
/**
 * 权益核销引擎（模块5 的核心）。
 *
 * 三条铁律：
 *  1. 权益按「次数/天数」发，不发"无限"。无限权益卖一次就没复购，也没法控成本。
 *  2. 每次核销必须带 bizKey，靠唯一约束做幂等。用户狂点"解锁"按钮不能扣三次钱。
 *  3. 核销必须在事务里，且先写流水再加计数——顺序反了会出现"扣了次数但没记录"。
 */
let BenefitService = BenefitService_1 = class BenefitService {
    prisma;
    logger = new common_1.Logger(BenefitService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    /** 当前周期的 key：DAILY→2026-08-10，MONTHLY→2026-08，NONE→ALL */
    periodKey(cycle, at = new Date()) {
        switch (cycle) {
            case shared_1.ResetCycle.DAILY:
                return (0, shared_1.toDateStr)(at);
            case shared_1.ResetCycle.MONTHLY:
                return (0, shared_1.toDateStr)(at).slice(0, 7);
            default:
                return 'ALL';
        }
    }
    resetAt(cycle, at = new Date()) {
        switch (cycle) {
            case shared_1.ResetCycle.DAILY:
                return (0, shared_1.startOfNextDay)(at);
            case shared_1.ResetCycle.MONTHLY:
                return (0, shared_1.startOfNextMonth)(at);
            default:
                return null;
        }
    }
    /**
     * 查某项权益的余量。
     *
     * 额度 = 所有未过期授予的 quota 之和（叠加买两个套餐就是两份额度）
     * 已用 = 当前周期的 BenefitUsage
     */
    async getRemaining(userId, code, tx) {
        const client = tx ?? this.prisma;
        const now = new Date();
        const grants = await client.benefitGrant.findMany({
            where: { userId, code: code, expireAt: { gt: now } },
            select: { quota: true, cycle: true },
        });
        if (!grants.length) {
            return { total: 0, used: 0, remaining: 0, cycle: shared_1.BENEFIT_META[code].defaultCycle };
        }
        // 同一权益理论上周期一致；万一不一致（改过套餐配置），取最短周期最保守
        const cycle = grants.some((g) => g.cycle === 'DAILY')
            ? shared_1.ResetCycle.DAILY
            : grants.some((g) => g.cycle === 'MONTHLY')
                ? shared_1.ResetCycle.MONTHLY
                : shared_1.ResetCycle.NONE;
        const total = grants.reduce((s, g) => s + g.quota, 0);
        const pk = this.periodKey(cycle, now);
        const usage = await client.benefitUsage.findUnique({
            where: { userId_code_periodKey: { userId, code: code, periodKey: pk } },
            select: { used: true },
        });
        const used = usage?.used ?? 0;
        return { total, used, remaining: Math.max(total - used, 0), cycle };
    }
    /**
     * 核销一次权益。
     *
     * @param bizKey 幂等键。同一个 bizKey 重复调用只扣一次，第二次直接返回 alreadyConsumed。
     *               例："unlock:<userId>:<targetProfileId>"、"view:<userId>:<profileId>:2026-08-10"
     * @throws BenefitExhaustedException 余额不足（前端据此弹开通 VIP 引导）
     */
    async consume(params) {
        const { userId, code, bizType, bizKey, amount = 1, remark } = params;
        const run = async (tx) => {
            // 幂等第一道：流水唯一键。已存在说明这次业务动作之前就扣过了。
            const existing = await tx.benefitConsumeLog.findUnique({ where: { bizKey } });
            if (existing) {
                const { remaining } = await this.getRemaining(userId, code, tx);
                return { consumed: false, alreadyConsumed: true, remaining };
            }
            const { total, used, cycle } = await this.getRemaining(userId, code, tx);
            const remaining = total - used;
            if (remaining < amount) {
                const meta = shared_1.BENEFIT_META[code];
                throw new all_exceptions_filter_1.BenefitExhaustedException(total === 0
                    ? `你还没有「${meta.label}」权益，开通 VIP 即可使用`
                    : `「${meta.label}」本${cycle === shared_1.ResetCycle.DAILY ? '日' : cycle === shared_1.ResetCycle.MONTHLY ? '月' : ''}额度已用完（${used}/${total} ${meta.unit}）`, code);
            }
            const pk = this.periodKey(cycle);
            // 顺序很重要：先写流水（唯一键会挡住并发重复），再加计数
            await tx.benefitConsumeLog.create({
                data: {
                    userId,
                    code: code,
                    amount,
                    periodKey: pk,
                    bizType,
                    bizKey,
                    remark,
                },
            });
            await tx.benefitUsage.upsert({
                where: { userId_code_periodKey: { userId, code: code, periodKey: pk } },
                create: { userId, code: code, periodKey: pk, used: amount },
                update: { used: { increment: amount } },
            });
            return { consumed: true, alreadyConsumed: false, remaining: remaining - amount };
        };
        if (params.tx)
            return run(params.tx);
        return this.prisma.$transaction(run);
    }
    /** 只查不扣，用于前端提前置灰按钮 */
    async canConsume(userId, code, amount = 1) {
        const { remaining } = await this.getRemaining(userId, code);
        return remaining >= amount;
    }
    /** 支付成功后发放套餐里的权益。必须在支付事务里调用。 */
    async grantFromPackage(params) {
        const { userId, benefits, durationDays, orderId, tx } = params;
        const expireAt = new Date(Date.now() + durationDays * 86400 * 1000);
        if (!benefits.length) {
            this.logger.warn(`订单 ${orderId} 的套餐没有配置任何权益`);
            return;
        }
        await tx.benefitGrant.createMany({
            data: benefits.map((b) => ({
                userId,
                code: b.code,
                quota: b.quota,
                cycle: (b.cycle ?? shared_1.BENEFIT_META[b.code].defaultCycle),
                expireAt,
                orderId,
            })),
        });
        this.logger.log(`用户 ${userId} 获得 ${benefits.length} 项权益，到期 ${expireAt.toISOString()}`);
    }
    /** 订单退款时收回权益 */
    async revokeByOrder(orderId, tx) {
        const r = await tx.benefitGrant.deleteMany({ where: { orderId } });
        return r.count;
    }
    /** 用户的全部权益，"我的-会员权益"页面用 */
    async listUserBenefits(userId) {
        const now = new Date();
        const grants = await this.prisma.benefitGrant.findMany({
            where: { userId, expireAt: { gt: now } },
            orderBy: { expireAt: 'asc' },
        });
        const byCode = new Map();
        for (const g of grants) {
            const code = g.code;
            const prev = byCode.get(code);
            byCode.set(code, {
                quota: (prev?.quota ?? 0) + g.quota,
                cycle: (prev?.cycle ?? g.cycle),
                // 展示最晚的到期时间
                expireAt: prev && prev.expireAt > g.expireAt ? prev.expireAt : g.expireAt,
            });
        }
        const out = [];
        for (const [code, v] of byCode) {
            const pk = this.periodKey(v.cycle, now);
            const usage = await this.prisma.benefitUsage.findUnique({
                where: { userId_code_periodKey: { userId, code: code, periodKey: pk } },
                select: { used: true },
            });
            const used = usage?.used ?? 0;
            const meta = shared_1.BENEFIT_META[code];
            out.push({
                code,
                label: meta.label,
                unit: meta.unit,
                total: v.quota,
                used,
                remaining: Math.max(v.quota - used, 0),
                cycle: v.cycle,
                resetAt: this.resetAt(v.cycle, now)?.toISOString() ?? null,
                expireAt: v.expireAt.toISOString(),
            });
        }
        return out;
    }
};
exports.BenefitService = BenefitService;
exports.BenefitService = BenefitService = BenefitService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BenefitService);
//# sourceMappingURL=benefit.service.js.map