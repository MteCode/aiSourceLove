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
var CommissionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const shared_1 = require("@yuanqiao/shared");
const all_exceptions_filter_1 = require("../../common/filters/all-exceptions.filter");
const pagination_dto_1 = require("../../common/dto/pagination.dto");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
/** 牵线成功的固定奖励（分）。可改成从系统配置读。 */
const INTRO_SUCCESS_BONUS = 20000; // 200 元
/**
 * 分润与提现。
 *
 * 涉及钱的三条铁律：
 *  1. 幂等。Commission 上有 @@unique([source, refId])，同一笔订单永远只能产生一条分润。
 *  2. 冷静期。订单支付后 7 天分润才从"待结算"转"可提现"——
 *     否则用户 3 天后退款，红娘的钱已经提走了，平台自己吃亏。
 *  3. 余额与流水必须在同一事务里改，且余额只做增量（不做覆盖写）。
 */
let CommissionService = CommissionService_1 = class CommissionService {
    prisma;
    logger = new common_1.Logger(CommissionService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    /** 名下会员购买 VIP 的分润。在支付成功的事务里调用。 */
    async grantForOrder(params, tx) {
        const commissionAmount = Math.floor(params.amount * params.rate);
        if (commissionAmount <= 0)
            return;
        // 唯一键兜底：回调重放时这里会抛 P2002，被上层吞掉即可（说明已经记过了）
        try {
            await tx.commission.create({
                data: {
                    matchmakerId: params.matchmakerId,
                    source: shared_1.CommissionSource.ORDER,
                    amount: commissionAmount,
                    status: shared_1.CommissionStatus.PENDING,
                    refId: params.orderId,
                    refNo: params.orderNo,
                    remark: `名下会员购买VIP ¥${(0, shared_1.fenToYuan)(params.amount)}，分润 ${(params.rate * 100).toFixed(0)}%`,
                    settleAt: (0, shared_1.addDays)(new Date(), shared_1.COMMISSION_COOLDOWN_DAYS),
                },
            });
            this.logger.log(`红娘 ${params.matchmakerId} 获得订单分润 ¥${(0, shared_1.fenToYuan)(commissionAmount)}（订单 ${params.orderNo}）`);
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                this.logger.warn(`订单 ${params.orderNo} 的分润已存在，跳过重复入账`);
                return;
            }
            throw e;
        }
    }
    /** 牵线成功的奖励。在牵线状态流转的事务里调用。 */
    async grantForIntroduction(params, tx) {
        try {
            await tx.commission.create({
                data: {
                    matchmakerId: params.matchmakerId,
                    source: shared_1.CommissionSource.INTRO_SUCCESS,
                    amount: INTRO_SUCCESS_BONUS,
                    status: shared_1.CommissionStatus.PENDING,
                    refId: params.introductionId,
                    refNo: params.serialNo,
                    remark: `牵线成功奖励（${params.serialNo}）`,
                    settleAt: (0, shared_1.addDays)(new Date(), shared_1.COMMISSION_COOLDOWN_DAYS),
                },
            });
            this.logger.log(`红娘 ${params.matchmakerId} 获得牵线成功奖励 ¥${(0, shared_1.fenToYuan)(INTRO_SUCCESS_BONUS)}`);
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
                return;
            throw e;
        }
    }
    /** 订单退款时冲销分润。已提现的不能冲销，只能记账追讨。 */
    async revokeForOrder(orderId, tx) {
        const c = await tx.commission.findUnique({
            where: { source_refId: { source: shared_1.CommissionSource.ORDER, refId: orderId } },
        });
        if (!c)
            return;
        if (c.status === shared_1.CommissionStatus.WITHDRAWN) {
            this.logger.error(`订单 ${orderId} 退款，但分润 ${c.id}（¥${(0, shared_1.fenToYuan)(c.amount)}）已被提现，需人工追讨`);
            return;
        }
        await tx.commission.update({
            where: { id: c.id },
            data: { status: shared_1.CommissionStatus.CANCELLED, remark: `${c.remark ?? ''}｜订单退款已冲销` },
        });
        // 已结算过的要从可提现余额里扣回来
        if (c.status === shared_1.CommissionStatus.SETTLED) {
            await tx.matchmaker.update({
                where: { id: c.matchmakerId },
                data: { availableBalance: { decrement: c.amount } },
            });
        }
        this.logger.log(`订单 ${orderId} 退款，冲销分润 ¥${(0, shared_1.fenToYuan)(c.amount)}`);
    }
    /**
     * 结算：把过了冷静期的 PENDING 分润转成 SETTLED，并加进可提现余额。
     * 由定时任务每天调用。
     */
    async settleDue() {
        const due = await this.prisma.commission.findMany({
            where: { status: shared_1.CommissionStatus.PENDING, settleAt: { lte: new Date() } },
            select: { id: true, matchmakerId: true, amount: true },
        });
        if (!due.length)
            return { count: 0, amount: 0 };
        // 按红娘聚合，减少 update 次数
        const byMatchmaker = new Map();
        for (const c of due) {
            byMatchmaker.set(c.matchmakerId, (byMatchmaker.get(c.matchmakerId) ?? 0) + c.amount);
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.commission.updateMany({
                where: { id: { in: due.map((d) => d.id) } },
                data: { status: shared_1.CommissionStatus.SETTLED },
            });
            for (const [mmId, amount] of byMatchmaker) {
                await tx.matchmaker.update({
                    where: { id: mmId },
                    data: { availableBalance: { increment: amount } },
                });
            }
        });
        const total = due.reduce((s, c) => s + c.amount, 0);
        this.logger.log(`结算了 ${due.length} 笔分润，共 ¥${(0, shared_1.fenToYuan)(total)}`);
        return { count: due.length, amount: total };
    }
    async listCommissions(query) {
        const where = {};
        if (query.status)
            where.status = query.status;
        if (query.matchmakerId)
            where.matchmakerId = query.matchmakerId;
        const [rows, total] = await Promise.all([
            this.prisma.commission.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: query.skip,
                take: query.take,
            }),
            this.prisma.commission.count({ where }),
        ]);
        return (0, pagination_dto_1.buildPageResult)(rows.map((c) => ({
            id: c.id,
            matchmakerId: c.matchmakerId,
            source: c.source,
            amount: c.amount,
            status: c.status,
            refId: c.refId,
            refNo: c.refNo,
            remark: c.remark,
            settleAt: c.settleAt?.toISOString() ?? null,
            createdAt: c.createdAt.toISOString(),
        })), total, query.page, query.pageSize);
    }
    // ───────── 提现 ─────────
    /**
     * 发起提现。
     *
     * 关键：**先扣余额再建单**，且在同一事务里。
     * 反过来做的话，用户连点两次就能提两次同样的钱。
     */
    async createWithdrawal(matchmakerId, dto) {
        if (dto.amount < shared_1.WITHDRAWAL_MIN_AMOUNT) {
            throw new all_exceptions_filter_1.BizException(`最低提现金额为 ¥${(0, shared_1.fenToYuan)(shared_1.WITHDRAWAL_MIN_AMOUNT)}`, 40050);
        }
        return this.prisma.$transaction(async (tx) => {
            const mm = await tx.matchmaker.findUnique({
                where: { id: matchmakerId },
                select: { availableBalance: true },
            });
            if (!mm)
                throw new common_1.NotFoundException('红娘不存在');
            if (mm.availableBalance < dto.amount) {
                throw new all_exceptions_filter_1.BizException(`可提现余额不足（当前 ¥${(0, shared_1.fenToYuan)(mm.availableBalance)}）`, 40051);
            }
            // 有未处理的提现单时不允许再提，避免余额被重复占用
            const pending = await tx.withdrawal.count({
                where: {
                    matchmakerId,
                    status: { in: [shared_1.WithdrawalStatus.PENDING, shared_1.WithdrawalStatus.APPROVED] },
                },
            });
            if (pending > 0)
                throw new all_exceptions_filter_1.BizException('你有提现单还在处理中，请等待完成后再提', 40052);
            await tx.matchmaker.update({
                where: { id: matchmakerId },
                data: { availableBalance: { decrement: dto.amount } },
            });
            const serialNo = await this.prisma.nextSerial('withdrawal', 'WD', tx);
            const w = await tx.withdrawal.create({
                data: {
                    serialNo,
                    matchmakerId,
                    amount: dto.amount,
                    method: dto.method ?? 'WECHAT',
                    account: dto.account,
                    realName: dto.realName,
                    status: shared_1.WithdrawalStatus.PENDING,
                },
            });
            // 把可提现的分润标记为已提现，并挂到这张提现单上
            const settled = await tx.commission.findMany({
                where: { matchmakerId, status: shared_1.CommissionStatus.SETTLED },
                orderBy: { createdAt: 'asc' },
                select: { id: true, amount: true },
            });
            let remaining = dto.amount;
            const covered = [];
            for (const c of settled) {
                if (remaining <= 0)
                    break;
                covered.push(c.id);
                remaining -= c.amount;
            }
            if (covered.length) {
                await tx.commission.updateMany({
                    where: { id: { in: covered } },
                    data: { status: shared_1.CommissionStatus.WITHDRAWN, withdrawalId: w.id },
                });
            }
            this.logger.log(`红娘 ${matchmakerId} 发起提现 ${serialNo} ¥${(0, shared_1.fenToYuan)(dto.amount)}`);
            return w;
        });
    }
    /** 后台审核提现 */
    async reviewWithdrawal(id, dto, operatorId) {
        const w = await this.prisma.withdrawal.findUnique({ where: { id } });
        if (!w)
            throw new common_1.NotFoundException('提现单不存在');
        const from = w.status;
        (0, shared_1.assertTransition)(shared_1.WITHDRAWAL_STATUS_TRANSITIONS, from, dto.status, '提现单状态');
        if (dto.status === shared_1.WithdrawalStatus.REJECTED && !dto.rejectReason?.trim()) {
            throw new all_exceptions_filter_1.BizException('拒绝提现必须填写理由', 40053);
        }
        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.withdrawal.update({
                where: { id },
                data: {
                    status: dto.status,
                    rejectReason: dto.rejectReason,
                    remark: dto.remark,
                    reviewedBy: operatorId,
                    reviewedAt: new Date(),
                    ...(dto.status === shared_1.WithdrawalStatus.PAID ? { paidAt: new Date() } : {}),
                },
            });
            if (dto.status === shared_1.WithdrawalStatus.REJECTED) {
                // 拒绝就把钱退回可提现余额，并把分润状态还原
                await tx.matchmaker.update({
                    where: { id: w.matchmakerId },
                    data: { availableBalance: { increment: w.amount } },
                });
                await tx.commission.updateMany({
                    where: { withdrawalId: id },
                    data: { status: shared_1.CommissionStatus.SETTLED, withdrawalId: null },
                });
                this.logger.log(`提现 ${w.serialNo} 被拒，¥${(0, shared_1.fenToYuan)(w.amount)} 已退回余额`);
            }
            if (dto.status === shared_1.WithdrawalStatus.PAID) {
                await tx.matchmaker.update({
                    where: { id: w.matchmakerId },
                    data: { withdrawnAmount: { increment: w.amount } },
                });
                this.logger.log(`提现 ${w.serialNo} 已打款 ¥${(0, shared_1.fenToYuan)(w.amount)}`);
            }
            return updated;
        });
    }
    async listWithdrawals(query) {
        const where = {};
        if (query.status)
            where.status = query.status;
        if (query.matchmakerId)
            where.matchmakerId = query.matchmakerId;
        const [rows, total] = await Promise.all([
            this.prisma.withdrawal.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: query.skip,
                take: query.take,
                include: { matchmaker: { select: { name: true, phone: true } } },
            }),
            this.prisma.withdrawal.count({ where }),
        ]);
        return (0, pagination_dto_1.buildPageResult)(rows, total, query.page, query.pageSize);
    }
};
exports.CommissionService = CommissionService;
exports.CommissionService = CommissionService = CommissionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CommissionService);
//# sourceMappingURL=commission.service.js.map