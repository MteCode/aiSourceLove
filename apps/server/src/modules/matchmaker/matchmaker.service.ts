import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  INTRODUCTION_STATUS_LABEL,
  IntroductionStatus,
  MatchmakerDto,
  MatchmakerStatsDto,
  MatchmakerStatus,
  PageResult,
  RoleCode,
  startOfMonth,
} from '@yuanqiao/shared';
import { BizException } from '@/common/filters/all-exceptions.filter';
import { buildPageResult } from '@/common/dto/pagination.dto';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { UserContextService } from '@/modules/auth/user-context.service';
import { ApplyMatchmakerDto, QueryMatchmakerDto, ReviewMatchmakerDto } from './dto/matchmaker.dto';

@Injectable()
export class MatchmakerService {
  private readonly logger = new Logger(MatchmakerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userContext: UserContextService,
  ) {}

  /** 红娘入驻申请。提交后是 PENDING，要后台审核才能开工。 */
  async apply(userId: string, dto: ApplyMatchmakerDto): Promise<MatchmakerDto> {
    const existing = await this.prisma.matchmaker.findUnique({ where: { userId } });
    if (existing) {
      if (existing.status === MatchmakerStatus.PENDING) {
        throw new BizException('你的入驻申请正在审核中', 40920);
      }
      throw new BizException('你已经是红娘了', 40921);
    }

    const mm = await this.prisma.matchmaker.create({
      data: {
        userId,
        name: dto.name,
        phone: dto.phone,
        cityCode: dto.cityCode,
        cityName: dto.cityName,
        bio: dto.bio,
        certImages: (dto.certImages ?? []) as Prisma.InputJsonValue,
        status: MatchmakerStatus.PENDING,
      },
    });
    this.logger.log(`用户 ${userId} 提交红娘入驻申请 ${mm.id}`);
    return this.toDto(mm.id);
  }

  /**
   * 后台审核入驻。
   * 通过时要同时给用户挂上 MATCHMAKER 角色，否则他登录后台没有任何权限。
   */
  async review(id: string, dto: ReviewMatchmakerDto): Promise<MatchmakerDto> {
    const mm = await this.prisma.matchmaker.findUnique({ where: { id } });
    if (!mm) throw new NotFoundException('红娘不存在');

    await this.prisma.$transaction(async (tx) => {
      await tx.matchmaker.update({
        where: { id },
        data: {
          status: dto.status,
          ...(dto.commissionRate != null
            ? { commissionRate: new Prisma.Decimal(dto.commissionRate) }
            : {}),
        },
      });

      const role = await tx.role.findUnique({ where: { code: RoleCode.MATCHMAKER } });
      if (!role) throw new BizException('系统缺少 MATCHMAKER 角色，请先执行 db:seed', 50004);

      if (dto.status === MatchmakerStatus.ACTIVE) {
        await tx.userRole.upsert({
          where: { userId_roleId: { userId: mm.userId, roleId: role.id } },
          create: { userId: mm.userId, roleId: role.id },
          update: {},
        });
      } else {
        // 停用/驳回时收回角色，避免他还能进后台看会员资料
        await tx.userRole.deleteMany({ where: { userId: mm.userId, roleId: role.id } });
      }
    });

    // 权限变了要立刻生效，不能等 60 秒缓存过期
    await this.userContext.invalidate(mm.userId);
    return this.toDto(id);
  }

  async list(query: QueryMatchmakerDto): Promise<PageResult<MatchmakerDto>> {
    const where: Prisma.MatchmakerWhereInput = { deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.cityCode) where.cityCode = query.cityCode;
    if (query.keyword?.trim()) {
      const kw = query.keyword.trim();
      where.OR = [{ name: { contains: kw } }, { phone: { contains: kw } }];
    }

    const [rows, total] = await Promise.all([
      this.prisma.matchmaker.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
        include: this.statsInclude(),
      }),
      this.prisma.matchmaker.count({ where }),
    ]);

    const list = await Promise.all(rows.map((r) => this.mapDto(r)));
    return buildPageResult(list, total, query.page, query.pageSize);
  }

  async toDto(id: string): Promise<MatchmakerDto> {
    const mm = await this.prisma.matchmaker.findFirst({
      where: { id, deletedAt: null },
      include: this.statsInclude(),
    });
    if (!mm) throw new NotFoundException('红娘不存在');
    return this.mapDto(mm);
  }

  async findByUserId(userId: string) {
    return this.prisma.matchmaker.findFirst({ where: { userId, deletedAt: null } });
  }

  /**
   * 业绩看板。
   *
   * 漏斗是这里最有价值的东西：红娘自己能看到卡在哪一步——
   * 是推荐了没人同意（推荐语写得差/匹配不准），
   * 还是同意了不见面（联系方式给了但没跟进）。
   */
  async stats(matchmakerId: string): Promise<MatchmakerStatsDto> {
    const monthStart = startOfMonth();

    const [
      memberCount,
      memberCountThisMonth,
      introCount,
      introCountThisMonth,
      successCount,
      byStatus,
      commissionAgg,
      mm,
    ] = await Promise.all([
      this.prisma.profile.count({ where: { matchmakerId, deletedAt: null } }),
      this.prisma.profile.count({
        where: { matchmakerId, deletedAt: null, createdAt: { gte: monthStart } },
      }),
      this.prisma.introduction.count({ where: { matchmakerId } }),
      this.prisma.introduction.count({ where: { matchmakerId, createdAt: { gte: monthStart } } }),
      this.prisma.introduction.count({
        where: { matchmakerId, status: IntroductionStatus.SUCCESS },
      }),
      this.prisma.introduction.groupBy({
        by: ['status'],
        where: { matchmakerId },
        _count: { _all: true },
      }),
      this.prisma.commission.groupBy({
        by: ['status'],
        where: { matchmakerId },
        _sum: { amount: true },
      }),
      this.prisma.matchmaker.findUnique({
        where: { id: matchmakerId },
        select: { availableBalance: true, withdrawnAmount: true },
      }),
    ]);

    const sumBy = (status: string) =>
      commissionAgg.find((c) => c.status === status)?._sum.amount ?? 0;

    const countByStatus = new Map(byStatus.map((b) => [b.status, b._count._all]));

    return {
      memberCount,
      memberCountThisMonth,
      introCount,
      introCountThisMonth,
      successCount,
      successRate: introCount > 0 ? Number((successCount / introCount).toFixed(4)) : 0,
      totalCommission: sumBy('PENDING') + sumBy('SETTLED') + sumBy('WITHDRAWN'),
      pendingCommission: sumBy('PENDING'),
      availableBalance: mm?.availableBalance ?? 0,
      withdrawnAmount: mm?.withdrawnAmount ?? 0,
      funnel: (Object.keys(INTRODUCTION_STATUS_LABEL) as IntroductionStatus[]).map((s) => ({
        status: s,
        label: INTRODUCTION_STATUS_LABEL[s],
        count: countByStatus.get(s) ?? 0,
      })),
    };
  }

  /** 名下会员 */
  async members(matchmakerId: string, page: number, pageSize: number) {
    const where: Prisma.ProfileWhereInput = { matchmakerId, deletedAt: null };
    const [rows, total] = await Promise.all([
      this.prisma.profile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, serialNo: true, realName: true, nickname: true, gender: true,
          birthday: true, cityName: true, status: true, createdAt: true, source: true,
        },
      }),
      this.prisma.profile.count({ where }),
    ]);
    return buildPageResult(rows, total, page, pageSize);
  }

  /** 当前红娘 id，普通会员返回 null */
  async requireMatchmakerId(userId: string): Promise<string> {
    const mm = await this.findByUserId(userId);
    if (!mm) throw new BadRequestException('你还不是红娘，请先提交入驻申请');
    if (mm.status !== MatchmakerStatus.ACTIVE) {
      throw new BizException('你的红娘账号未启用，请联系管理员', 40322);
    }
    return mm.id;
  }

  private statsInclude() {
    return {
      _count: { select: { members: true, introductions: true } },
    } satisfies Prisma.MatchmakerInclude;
  }

  private async mapDto(
    mm: Prisma.MatchmakerGetPayload<{ include: { _count: { select: { members: true; introductions: true } } } }>,
  ): Promise<MatchmakerDto> {
    const [successCount, totalAgg] = await Promise.all([
      this.prisma.introduction.count({
        where: { matchmakerId: mm.id, status: IntroductionStatus.SUCCESS },
      }),
      this.prisma.commission.aggregate({
        where: { matchmakerId: mm.id, status: { not: 'CANCELLED' } },
        _sum: { amount: true },
      }),
    ]);

    return {
      id: mm.id,
      userId: mm.userId,
      name: mm.name,
      phone: mm.phone,
      avatar: mm.avatar,
      cityName: mm.cityName,
      bio: mm.bio,
      commissionRate: Number(mm.commissionRate),
      status: mm.status,
      memberCount: mm._count.members,
      introCount: mm._count.introductions,
      successCount,
      totalCommission: totalAgg._sum.amount ?? 0,
      availableBalance: mm.availableBalance,
      createdAt: mm.createdAt.toISOString(),
    };
  }
}
