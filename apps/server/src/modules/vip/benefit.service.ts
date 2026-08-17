import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BenefitCode as PrismaBenefitCode, Prisma, ResetCycle as PrismaResetCycle } from '@prisma/client';
import {
  BENEFIT_META,
  BenefitCode,
  BenefitSpec,
  ResetCycle,
  UserBenefitDto,
  startOfNextDay,
  startOfNextMonth,
  toDateStr,
} from '@yuanqiao/shared';
import { BenefitExhaustedException } from '@/common/filters/all-exceptions.filter';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { UserContextService } from '@/modules/auth/user-context.service';

/**
 * 权益核销引擎（模块5 的核心）。
 *
 * 三条铁律：
 *  1. 权益按「次数/天数」发，不发"无限"。无限权益卖一次就没复购，也没法控成本。
 *  2. 每次核销必须带 bizKey，靠唯一约束做幂等。用户狂点"解锁"按钮不能扣三次钱。
 *  3. 核销必须在事务里，且先写流水再加计数——顺序反了会出现"扣了次数但没记录"。
 */
@Injectable()
export class BenefitService {
  private readonly logger = new Logger(BenefitService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userContext: UserContextService,
  ) {}

  /** 当前周期的 key：DAILY→2026-08-10，MONTHLY→2026-08，NONE→ALL */
  periodKey(cycle: ResetCycle, at = new Date()): string {
    switch (cycle) {
      case ResetCycle.DAILY:
        return toDateStr(at);
      case ResetCycle.MONTHLY:
        return toDateStr(at).slice(0, 7);
      default:
        return 'ALL';
    }
  }

  private resetAt(cycle: ResetCycle, at = new Date()): Date | null {
    switch (cycle) {
      case ResetCycle.DAILY:
        return startOfNextDay(at);
      case ResetCycle.MONTHLY:
        return startOfNextMonth(at);
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
  async getRemaining(
    userId: string,
    code: BenefitCode,
    tx?: Prisma.TransactionClient,
  ): Promise<{ total: number; used: number; remaining: number; cycle: ResetCycle }> {
    const client = tx ?? this.prisma;
    const now = new Date();

    const grants = await client.benefitGrant.findMany({
      where: { userId, code: code as PrismaBenefitCode, expireAt: { gt: now } },
      select: { quota: true, cycle: true },
    });

    if (!grants.length) {
      return { total: 0, used: 0, remaining: 0, cycle: BENEFIT_META[code].defaultCycle };
    }

    // 同一权益理论上周期一致；万一不一致（改过套餐配置），取最短周期最保守
    const cycle = grants.some((g) => g.cycle === 'DAILY')
      ? ResetCycle.DAILY
      : grants.some((g) => g.cycle === 'MONTHLY')
        ? ResetCycle.MONTHLY
        : ResetCycle.NONE;

    const total = grants.reduce((s, g) => s + g.quota, 0);
    const pk = this.periodKey(cycle, now);
    const usage = await client.benefitUsage.findUnique({
      where: { userId_code_periodKey: { userId, code: code as PrismaBenefitCode, periodKey: pk } },
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
  async consume(params: {
    userId: string;
    code: BenefitCode;
    bizType: string;
    bizKey: string;
    amount?: number;
    remark?: string;
    /** 传入则复用外层事务 */
    tx?: Prisma.TransactionClient;
  }): Promise<{ consumed: boolean; alreadyConsumed: boolean; remaining: number }> {
    const { userId, code, bizType, bizKey, amount = 1, remark } = params;

    const run = async (tx: Prisma.TransactionClient) => {
      // 幂等第一道：流水唯一键。已存在说明这次业务动作之前就扣过了。
      const existing = await tx.benefitConsumeLog.findUnique({ where: { bizKey } });
      if (existing) {
        const { remaining } = await this.getRemaining(userId, code, tx);
        return { consumed: false, alreadyConsumed: true, remaining };
      }

      const { total, used, cycle } = await this.getRemaining(userId, code, tx);
      const remaining = total - used;
      if (remaining < amount) {
        const meta = BENEFIT_META[code];
        throw new BenefitExhaustedException(
          total === 0
            ? `你还没有「${meta.label}」权益，开通 VIP 即可使用`
            : `「${meta.label}」本${cycle === ResetCycle.DAILY ? '日' : cycle === ResetCycle.MONTHLY ? '月' : ''}额度已用完（${used}/${total} ${meta.unit}）`,
          code,
        );
      }

      const pk = this.periodKey(cycle);

      // 顺序很重要：先写流水（唯一键会挡住并发重复），再加计数
      await tx.benefitConsumeLog.create({
        data: {
          userId,
          code: code as PrismaBenefitCode,
          amount,
          periodKey: pk,
          bizType,
          bizKey,
          remark,
        },
      });

      await tx.benefitUsage.upsert({
        where: { userId_code_periodKey: { userId, code: code as PrismaBenefitCode, periodKey: pk } },
        create: { userId, code: code as PrismaBenefitCode, periodKey: pk, used: amount },
        update: { used: { increment: amount } },
      });

      return { consumed: true, alreadyConsumed: false, remaining: remaining - amount };
    };

    if (params.tx) return run(params.tx);
    return this.prisma.$transaction(run);
  }

  /** 只查不扣，用于前端提前置灰按钮 */
  async canConsume(userId: string, code: BenefitCode, amount = 1): Promise<boolean> {
    const { remaining } = await this.getRemaining(userId, code);
    return remaining >= amount;
  }

  /** 支付成功后发放套餐里的权益。必须在支付事务里调用。 */
  async grantFromPackage(params: {
    userId: string;
    benefits: BenefitSpec[];
    durationDays: number;
    /** 购买传订单 id；后台手动发放传 null——orderId 是外键，编一个字符串会违反约束 */
    orderId: string | null;
    grantNote?: string;
    tx: Prisma.TransactionClient;
  }): Promise<void> {
    const { userId, benefits, durationDays, orderId, grantNote, tx } = params;
    const expireAt = new Date(Date.now() + durationDays * 86400 * 1000);

    if (!benefits.length) {
      this.logger.warn(`订单 ${orderId} 的套餐没有配置任何权益`);
      return;
    }

    await tx.benefitGrant.createMany({
      data: benefits.map((b) => ({
        userId,
        code: b.code as PrismaBenefitCode,
        quota: b.quota,
        cycle: (b.cycle ?? BENEFIT_META[b.code].defaultCycle) as PrismaResetCycle,
        expireAt,
        orderId,
        grantNote: grantNote ?? null,
      })),
    });

    this.logger.log(`用户 ${userId} 获得 ${benefits.length} 项权益，到期 ${expireAt.toISOString()}`);
  }

  /** 订单退款时收回权益 */
  async revokeByOrder(orderId: string, tx: Prisma.TransactionClient): Promise<number> {
    const r = await tx.benefitGrant.deleteMany({ where: { orderId } });
    return r.count;
  }

  /** 用户的全部权益，"我的-会员权益"页面用 */
  async listUserBenefits(userId: string): Promise<UserBenefitDto[]> {
    const now = new Date();
    const grants = await this.prisma.benefitGrant.findMany({
      where: { userId, expireAt: { gt: now } },
      orderBy: { expireAt: 'asc' },
    });

    const byCode = new Map<BenefitCode, { quota: number; cycle: ResetCycle; expireAt: Date }>();
    for (const g of grants) {
      const code = g.code as unknown as BenefitCode;
      const prev = byCode.get(code);
      byCode.set(code, {
        quota: (prev?.quota ?? 0) + g.quota,
        cycle: (prev?.cycle ?? g.cycle) as ResetCycle,
        // 展示最晚的到期时间
        expireAt: prev && prev.expireAt > g.expireAt ? prev.expireAt : g.expireAt,
      });
    }

    const out: UserBenefitDto[] = [];
    for (const [code, v] of byCode) {
      const pk = this.periodKey(v.cycle, now);
      const usage = await this.prisma.benefitUsage.findUnique({
        where: { userId_code_periodKey: { userId, code: code as PrismaBenefitCode, periodKey: pk } },
        select: { used: true },
      });
      const used = usage?.used ?? 0;
      const meta = BENEFIT_META[code];
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
  /**
   * 后台手动给用户开通 VIP。
   *
   * 存在的意义：支付还没上线，但业务上已经需要给特定用户放开 AI 匹配、
   * 解锁次数这些权益——线下收了钱、给红娘的样板号、给早期用户的补偿，
   * 都得有个口子。
   *
   * 走和支付成功完全相同的发放路径（grantFromPackage），不另写一套：
   * 权益条目、有效期、按日/按月重置这些规则只应该有一处实现。
   * 区别只是 orderId 记成 manual:xxx，对账时能认出来这不是真实收款。
   */
  async grantByAdmin(params: {
    userId: string;
    packageId: string;
    operatorId: string;
    remark?: string;
  }): Promise<{ expireAt: Date; benefits: number }> {
    const pkg = await this.prisma.vipPackage.findUnique({ where: { id: params.packageId } });
    if (!pkg) throw new NotFoundException('套餐不存在');

    const user = await this.prisma.user.findFirst({
      where: { id: params.userId, deletedAt: null },
      select: { id: true, vipExpireAt: true },
    });
    if (!user) throw new NotFoundException('用户不存在');

    const benefits = (pkg.benefits ?? []) as unknown as BenefitSpec[];
    const now = new Date();
    // 还没到期就往后续，不要把剩余天数抹掉
    const base = user.vipExpireAt && user.vipExpireAt > now ? user.vipExpireAt : now;
    const expireAt = new Date(base.getTime() + pkg.durationDays * 86400 * 1000);

    await this.prisma.$transaction(async (tx) => {
      await this.grantFromPackage({
        userId: params.userId,
        benefits,
        durationDays: pkg.durationDays,
        // 手动发放不挂订单：orderId 是指向 Order 表的外键，
        // 编一个 manual:xxx 会直接违反外键约束
        orderId: null,
        grantNote: `后台开通 · 操作人 ${params.operatorId}${params.remark ? ` · ${params.remark}` : ''}`,
        tx,
      });
      await tx.user.update({
        where: { id: params.userId },
        data: { isVip: true, vipExpireAt: expireAt },
      });
    });

    // 鉴权上下文里缓存着 isVip，不清的话用户 60 秒内还是非 VIP
    await this.userContext.invalidate(params.userId);
    this.logger.log(`后台开通 VIP：user=${params.userId} 套餐=${pkg.name} 到期=${expireAt.toISOString()}`);
    return { expireAt, benefits: benefits.length };
  }

}
