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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@yuanqiao/shared");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
let DashboardService = class DashboardService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async overview() {
        const today = (0, shared_1.startOfDay)();
        const monthStart = (0, shared_1.startOfMonth)();
        const thirtyDaysAgo = new Date(today.getTime() - 29 * 86400_000);
        const [totalMembers, newMembersToday, pendingAudit, pendingPhotoAudit, maleCount, femaleCount, totalMatchmakers, activeIntroductions, successIntroductions, revenueTodayAgg, revenueMonthAgg, revenueTotalAgg, vipCount, cityRows,] = await Promise.all([
            this.prisma.profile.count({ where: { deletedAt: null } }),
            this.prisma.profile.count({ where: { deletedAt: null, createdAt: { gte: today } } }),
            this.prisma.profile.count({ where: { deletedAt: null, status: shared_1.ProfileStatus.PENDING } }),
            this.prisma.profilePhoto.count({ where: { auditStatus: 'PENDING' } }),
            this.prisma.profile.count({ where: { deletedAt: null, gender: 'MALE' } }),
            this.prisma.profile.count({ where: { deletedAt: null, gender: 'FEMALE' } }),
            this.prisma.matchmaker.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
            this.prisma.introduction.count({
                where: {
                    status: {
                        notIn: [shared_1.IntroductionStatus.SUCCESS, shared_1.IntroductionStatus.FAILED, shared_1.IntroductionStatus.CANCELLED],
                    },
                },
            }),
            this.prisma.introduction.count({ where: { status: shared_1.IntroductionStatus.SUCCESS } }),
            this.prisma.order.aggregate({
                where: { status: shared_1.OrderStatus.PAID, paidAt: { gte: today } },
                _sum: { amount: true },
            }),
            this.prisma.order.aggregate({
                where: { status: shared_1.OrderStatus.PAID, paidAt: { gte: monthStart } },
                _sum: { amount: true },
            }),
            this.prisma.order.aggregate({
                where: { status: shared_1.OrderStatus.PAID },
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
    async trend(from) {
        const [members, orders, intros] = await Promise.all([
            this.prisma.profile.findMany({
                where: { deletedAt: null, createdAt: { gte: from } },
                select: { createdAt: true },
            }),
            this.prisma.order.findMany({
                where: { status: shared_1.OrderStatus.PAID, paidAt: { gte: from } },
                select: { paidAt: true, amount: true },
            }),
            this.prisma.introduction.findMany({
                where: { createdAt: { gte: from } },
                select: { createdAt: true },
            }),
        ]);
        const days = new Map();
        for (let i = 0; i < 30; i++) {
            const d = new Date(from.getTime() + i * 86400_000);
            days.set((0, shared_1.toDateStr)(d), { newMembers: 0, revenue: 0, introductions: 0 });
        }
        for (const m of members) {
            const k = (0, shared_1.toDateStr)(m.createdAt);
            const e = days.get(k);
            if (e)
                e.newMembers++;
        }
        for (const o of orders) {
            if (!o.paidAt)
                continue;
            const e = days.get((0, shared_1.toDateStr)(o.paidAt));
            if (e)
                e.revenue += o.amount;
        }
        for (const i of intros) {
            const e = days.get((0, shared_1.toDateStr)(i.createdAt));
            if (e)
                e.introductions++;
        }
        return [...days.entries()].map(([date, v]) => ({ date, ...v }));
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map