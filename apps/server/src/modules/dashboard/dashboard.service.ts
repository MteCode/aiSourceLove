import { Injectable } from '@nestjs/common';
import { DashboardDto, IntroductionStatus, OrderStatus, ProfileStatus, startOfDay, startOfMonth, toDateStr } from '@yuanqiao/shared';
import { PrismaService } from '@/infra/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(): Promise<DashboardDto> {
    const today = startOfDay();
    const monthStart = startOfMonth();
    const thirtyDaysAgo = new Date(today.getTime() - 29 * 86400_000);

    const [
      totalMembers,
      newMembersToday,
      pendingAudit,
      pendingPhotoAudit,
      maleCount,
      femaleCount,
      totalMatchmakers,
      activeIntroductions,
      successIntroductions,
      revenueTodayAgg,
      revenueMonthAgg,
      revenueTotalAgg,
      vipCount,
      cityRows,
    ] = await Promise.all([
      this.prisma.profile.count({ where: { deletedAt: null } }),
      this.prisma.profile.count({ where: { deletedAt: null, createdAt: { gte: today } } }),
      this.prisma.profile.count({ where: { deletedAt: null, status: ProfileStatus.PENDING } }),
      this.prisma.profilePhoto.count({ where: { auditStatus: 'PENDING' } }),
      this.prisma.profile.count({ where: { deletedAt: null, gender: 'MALE' } }),
      this.prisma.profile.count({ where: { deletedAt: null, gender: 'FEMALE' } }),
      this.prisma.matchmaker.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      this.prisma.introduction.count({
        where: {
          status: {
            notIn: [IntroductionStatus.SUCCESS, IntroductionStatus.FAILED, IntroductionStatus.CANCELLED],
          },
        },
      }),
      this.prisma.introduction.count({ where: { status: IntroductionStatus.SUCCESS } }),
      this.prisma.order.aggregate({
        where: { status: OrderStatus.PAID, paidAt: { gte: today } },
        _sum: { amount: true },
      }),
      this.prisma.order.aggregate({
        where: { status: OrderStatus.PAID, paidAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      this.prisma.order.aggregate({
        where: { status: OrderStatus.PAID },
        _sum: { amount: true },
      }),
      this.prisma.user.count({ where: { isVip: true, deletedAt: null } }),
      this.prisma.profile.groupBy({
        by: ['cityName'],
        where: { deletedAt: null, cityName: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { cityName: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      totalMembers,
      newMembersToday,
      pendingAudit,
      pendingPhotoAudit,
      genderRatio: { male: maleCount, female: femaleCount },
      totalMatchmakers,
      activeIntroductions,
      successIntroductions,
      revenueToday: revenueTodayAgg._sum.amount ?? 0,
      revenueThisMonth: revenueMonthAgg._sum.amount ?? 0,
      revenueTotal: revenueTotalAgg._sum.amount ?? 0,
      vipCount,
      trend: await this.trend(thirtyDaysAgo),
      cityDistribution: cityRows.map((c) => ({
        cityName: c.cityName ?? '未知',
        count: c._count._all,
      })),
    };
  }

  /**
   * 近 30 天趋势。
   * 用三次 groupBy 而不是三十次 count —— 后者在数据量上来后会把看板拖死。
   */
  private async trend(from: Date): Promise<DashboardDto['trend']> {
    const [members, orders, intros] = await Promise.all([
      this.prisma.profile.findMany({
        where: { deletedAt: null, createdAt: { gte: from } },
        select: { createdAt: true },
      }),
      this.prisma.order.findMany({
        where: { status: OrderStatus.PAID, paidAt: { gte: from } },
        select: { paidAt: true, amount: true },
      }),
      this.prisma.introduction.findMany({
        where: { createdAt: { gte: from } },
        select: { createdAt: true },
      }),
    ]);

    const days = new Map<string, { newMembers: number; revenue: number; introductions: number }>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(from.getTime() + i * 86400_000);
      days.set(toDateStr(d), { newMembers: 0, revenue: 0, introductions: 0 });
    }

    for (const m of members) {
      const k = toDateStr(m.createdAt);
      const e = days.get(k);
      if (e) e.newMembers++;
    }
    for (const o of orders) {
      if (!o.paidAt) continue;
      const e = days.get(toDateStr(o.paidAt));
      if (e) e.revenue += o.amount;
    }
    for (const i of intros) {
      const e = days.get(toDateStr(i.createdAt));
      if (e) e.introductions++;
    }

    return [...days.entries()].map(([date, v]) => ({ date, ...v }));
  }
}
