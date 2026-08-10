import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  COMMISSION_COOLDOWN_DAYS,
  CommissionDto,
  CommissionSource,
  CommissionStatus,
  PageResult,
  WITHDRAWAL_MIN_AMOUNT,
  WITHDRAWAL_STATUS_TRANSITIONS,
  WithdrawalStatus,
  addDays,
  assertTransition,
  fenToYuan,
} from '@yuanqiao/shared';
import { BizException } from '@/common/filters/all-exceptions.filter';
import { buildPageResult } from '@/common/dto/pagination.dto';
import { PrismaService } from '@/infra/prisma/prisma.service';
import {
  CreateWithdrawalDto,
  QueryCommissionDto,
  QueryWithdrawalDto,
  ReviewWithdrawalDto,
} from './dto/matchmaker.dto';

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
@Injectable()
export class CommissionService {
  private readonly logger = new Logger(CommissionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 名下会员购买 VIP 的分润。在支付成功的事务里调用。 */
  async grantForOrder(
    params: { matchmakerId: string; orderId: string; orderNo: string; amount: number; rate: number },
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const commissionAmount = Math.floor(params.amount * params.rate);
    if (commissionAmount <= 0) return;

    // 唯一键兜底：回调重放时这里会抛 P2002，被上层吞掉即可（说明已经记过了）
    try {
      await tx.commission.create({
        data: {
          matchmakerId: params.matchmakerId,
          source: CommissionSource.ORDER,
          amount: commissionAmount,
          status: CommissionStatus.PENDING,
          refId: params.orderId,
          refNo: params.orderNo,
          remark: `名下会员购买VIP ¥${fenToYuan(params.amount)}，分润 ${(params.rate * 100).toFixed(0)}%`,
          settleAt: addDays(new Date(), COMMISSION_COOLDOWN_DAYS),
        },
      });
      this.logger.log(
        `红娘 ${params.matchmakerId} 获得订单分润 ¥${fenToYuan(commissionAmount)}（订单 ${params.orderNo}）`,
      );
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        this.logger.warn(`订单 ${params.orderNo} 的分润已存在，跳过重复入账`);
        return;
      }
      throw e;
    }
  }

  /** 牵线成功的奖励。在牵线状态流转的事务里调用。 */
  async grantForIntroduction(
    params: { matchmakerId: string; introductionId: string; serialNo: string },
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    try {
      await tx.commission.create({
        data: {
          matchmakerId: params.matchmakerId,
          source: CommissionSource.INTRO_SUCCESS,
          amount: INTRO_SUCCESS_BONUS,
          status: CommissionStatus.PENDING,
          refId: params.introductionId,
          refNo: params.serialNo,
          remark: `牵线成功奖励（${params.serialNo}）`,
          settleAt: addDays(new Date(), COMMISSION_COOLDOWN_DAYS),
        },
      });
      this.logger.log(`红娘 ${params.matchmakerId} 获得牵线成功奖励 ¥${fenToYuan(INTRO_SUCCESS_BONUS)}`);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return;
      throw e;
    }
  }

  /** 订单退款时冲销分润。已提现的不能冲销，只能记账追讨。 */
  async revokeForOrder(orderId: string, tx: Prisma.TransactionClient): Promise<void> {
    const c = await tx.commission.findUnique({
      where: { source_refId: { source: CommissionSource.ORDER, refId: orderId } },
    });
    if (!c) return;

    if (c.status === CommissionStatus.WITHDRAWN) {
      this.logger.error(
        `订单 ${orderId} 退款，但分润 ${c.id}（¥${fenToYuan(c.amount)}）已被提现，需人工追讨`,
      );
      return;
    }

    await tx.commission.update({
      where: { id: c.id },
      data: { status: CommissionStatus.CANCELLED, remark: `${c.remark ?? ''}｜订单退款已冲销` },
    });

    // 已结算过的要从可提现余额里扣回来
    if (c.status === CommissionStatus.SETTLED) {
      await tx.matchmaker.update({
        where: { id: c.matchmakerId },
        data: { availableBalance: { decrement: c.amount } },
      });
    }
    this.logger.log(`订单 ${orderId} 退款，冲销分润 ¥${fenToYuan(c.amount)}`);
  }

  /**
   * 结算：把过了冷静期的 PENDING 分润转成 SETTLED，并加进可提现余额。
   * 由定时任务每天调用。
   */
  async settleDue(): Promise<{ count: number; amount: number }> {
    const due = await this.prisma.commission.findMany({
      where: { status: CommissionStatus.PENDING, settleAt: { lte: new Date() } },
      select: { id: true, matchmakerId: true, amount: true },
    });
    if (!due.length) return { count: 0, amount: 0 };

    // 按红娘聚合，减少 update 次数
    const byMatchmaker = new Map<string, number>();
    for (const c of due) {
      byMatchmaker.set(c.matchmakerId, (byMatchmaker.get(c.matchmakerId) ?? 0) + c.amount);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.commission.updateMany({
        where: { id: { in: due.map((d) => d.id) } },
        data: { status: CommissionStatus.SETTLED },
      });
      for (const [mmId, amount] of byMatchmaker) {
        await tx.matchmaker.update({
          where: { id: mmId },
          data: { availableBalance: { increment: amount } },
        });
      }
    });

    const total = due.reduce((s, c) => s + c.amount, 0);
    this.logger.log(`结算了 ${due.length} 笔分润，共 ¥${fenToYuan(total)}`);
    return { count: due.length, amount: total };
  }

  async listCommissions(query: QueryCommissionDto): Promise<PageResult<CommissionDto>> {
    const where: Prisma.CommissionWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.matchmakerId) where.matchmakerId = query.matchmakerId;

    const [rows, total] = await Promise.all([
      this.prisma.commission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.commission.count({ where }),
    ]);

    return buildPageResult(
      rows.map((c) => ({
        id: c.id,
        matchmakerId: c.matchmakerId,
        source: c.source,
        amount: c.amount,
        status: c.status as CommissionStatus,
        refId: c.refId,
        refNo: c.refNo,
        remark: c.remark,
        settleAt: c.settleAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
      })),
      total,
      query.page,
      query.pageSize,
    );
  }

  // ───────── 提现 ─────────

  /**
   * 发起提现。
   *
   * 关键：**先扣余额再建单**，且在同一事务里。
   * 反过来做的话，用户连点两次就能提两次同样的钱。
   */
  async createWithdrawal(matchmakerId: string, dto: CreateWithdrawalDto) {
    if (dto.amount < WITHDRAWAL_MIN_AMOUNT) {
      throw new BizException(`最低提现金额为 ¥${fenToYuan(WITHDRAWAL_MIN_AMOUNT)}`, 40050);
    }

    return this.prisma.$transaction(async (tx) => {
      const mm = await tx.matchmaker.findUnique({
        where: { id: matchmakerId },
        select: { availableBalance: true },
      });
      if (!mm) throw new NotFoundException('红娘不存在');
      if (mm.availableBalance < dto.amount) {
        throw new BizException(
          `可提现余额不足（当前 ¥${fenToYuan(mm.availableBalance)}）`,
          40051,
        );
      }

      // 有未处理的提现单时不允许再提，避免余额被重复占用
      const pending = await tx.withdrawal.count({
        where: {
          matchmakerId,
          status: { in: [WithdrawalStatus.PENDING, WithdrawalStatus.APPROVED] },
        },
      });
      if (pending > 0) throw new BizException('你有提现单还在处理中，请等待完成后再提', 40052);

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
          status: WithdrawalStatus.PENDING,
        },
      });

      // 把可提现的分润标记为已提现，并挂到这张提现单上
      const settled = await tx.commission.findMany({
        where: { matchmakerId, status: CommissionStatus.SETTLED },
        orderBy: { createdAt: 'asc' },
        select: { id: true, amount: true },
      });
      let remaining = dto.amount;
      const covered: string[] = [];
      for (const c of settled) {
        if (remaining <= 0) break;
        covered.push(c.id);
        remaining -= c.amount;
      }
      if (covered.length) {
        await tx.commission.updateMany({
          where: { id: { in: covered } },
          data: { status: CommissionStatus.WITHDRAWN, withdrawalId: w.id },
        });
      }

      this.logger.log(`红娘 ${matchmakerId} 发起提现 ${serialNo} ¥${fenToYuan(dto.amount)}`);
      return w;
    });
  }

  /** 后台审核提现 */
  async reviewWithdrawal(id: string, dto: ReviewWithdrawalDto, operatorId: string) {
    const w = await this.prisma.withdrawal.findUnique({ where: { id } });
    if (!w) throw new NotFoundException('提现单不存在');

    const from = w.status as WithdrawalStatus;
    assertTransition(WITHDRAWAL_STATUS_TRANSITIONS, from, dto.status, '提现单状态');

    if (dto.status === WithdrawalStatus.REJECTED && !dto.rejectReason?.trim()) {
      throw new BizException('拒绝提现必须填写理由', 40053);
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
          ...(dto.status === WithdrawalStatus.PAID ? { paidAt: new Date() } : {}),
        },
      });

      if (dto.status === WithdrawalStatus.REJECTED) {
        // 拒绝就把钱退回可提现余额，并把分润状态还原
        await tx.matchmaker.update({
          where: { id: w.matchmakerId },
          data: { availableBalance: { increment: w.amount } },
        });
        await tx.commission.updateMany({
          where: { withdrawalId: id },
          data: { status: CommissionStatus.SETTLED, withdrawalId: null },
        });
        this.logger.log(`提现 ${w.serialNo} 被拒，¥${fenToYuan(w.amount)} 已退回余额`);
      }

      if (dto.status === WithdrawalStatus.PAID) {
        await tx.matchmaker.update({
          where: { id: w.matchmakerId },
          data: { withdrawnAmount: { increment: w.amount } },
        });
        this.logger.log(`提现 ${w.serialNo} 已打款 ¥${fenToYuan(w.amount)}`);
      }

      return updated;
    });
  }

  async listWithdrawals(query: QueryWithdrawalDto) {
    const where: Prisma.WithdrawalWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.matchmakerId) where.matchmakerId = query.matchmakerId;

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
    return buildPageResult(rows, total, query.page, query.pageSize);
  }
}
