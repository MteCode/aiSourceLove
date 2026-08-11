import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  INTRODUCTION_STATUS_TRANSITIONS,
  IntroductionDto,
  IntroductionStatus,
  PageResult,
  VisibilityLevel,
  assertTransition,
} from '@yuanqiao/shared';
import { BizException } from '@/common/filters/all-exceptions.filter';
import { buildPageResult } from '@/common/dto/pagination.dto';
import type { AuthUser } from '@/common/types/auth-user';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { PrivacyService } from '@/modules/privacy/privacy.service';
import { MatchService } from '@/modules/match/match.service';
import { CommissionService } from './commission.service';
import {
  AdvanceIntroductionDto,
  AgreeIntroductionDto,
  CreateIntroductionDto,
  QueryIntroductionDto,
} from './dto/matchmaker.dto';

const INTRO_INCLUDE = {
  matchmaker: { select: { id: true, name: true } },
  aProfile: { include: { photos: true } },
  bProfile: { include: { photos: true } },
  events: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.IntroductionInclude;

/**
 * 牵线服务（模块3 的核心）。
 *
 * 状态流：发起 → 推荐 → 单方同意 → 双方同意 → 交换联系方式 → 见面 → 结果
 * 每一次流转都：① 过状态机校验 ② 写事件流水 ③ 触发副作用（解锁/分润）
 *
 * 为什么要事件流水：红娘的业绩纠纷全靠它。"我明明推荐了""你没推"这种扯皮
 * 只有时间戳能解决。
 */
@Injectable()
export class IntroductionService {
  private readonly logger = new Logger(IntroductionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly privacy: PrivacyService,
    private readonly match: MatchService,
    private readonly commission: CommissionService,
  ) {}

  private pairKey(a: string, b: string): string {
    return [a, b].sort().join(':');
  }

  /** 红娘发起牵线 */
  async create(
    matchmakerId: string,
    dto: CreateIntroductionDto,
    operator: { id: string; name: string },
  ): Promise<IntroductionDto> {
    if (dto.aProfileId === dto.bProfileId) {
      throw new BizException('不能给同一个人牵线', 40040);
    }

    const [a, b] = await Promise.all([
      this.prisma.profile.findFirst({ where: { id: dto.aProfileId, deletedAt: null } }),
      this.prisma.profile.findFirst({ where: { id: dto.bProfileId, deletedAt: null } }),
    ]);
    if (!a || !b) throw new NotFoundException('会员档案不存在');
    if (a.status !== 'APPROVED' || b.status !== 'APPROVED') {
      throw new BizException('只能给资料已审核通过的会员牵线', 40041);
    }
    if (a.gender === b.gender) {
      throw new BizException('当前仅支持异性牵线', 40042);
    }

    // 同一对人只能有一条进行中的牵线，否则双方会收到重复推荐
    const pairKey = this.pairKey(dto.aProfileId, dto.bProfileId);
    const active = await this.prisma.introduction.findFirst({
      where: {
        pairKey,
        status: {
          notIn: [IntroductionStatus.SUCCESS, IntroductionStatus.FAILED, IntroductionStatus.CANCELLED],
        },
      },
      select: { serialNo: true, status: true },
    });
    if (active) {
      throw new BizException(`这两位已有进行中的牵线单（${active.serialNo}）`, 40922);
    }

    // 发起时把匹配分快照下来。事后双方改了资料，还能还原当时的判断依据。
    const score = await this.match.scorePair(dto.aProfileId, dto.bProfileId);

    const intro = await this.prisma.$transaction(async (tx) => {
      const serialNo = await this.prisma.nextSerial('introduction', 'IN', tx);
      const created = await tx.introduction.create({
        data: {
          serialNo,
          matchmakerId,
          aProfileId: dto.aProfileId,
          bProfileId: dto.bProfileId,
          pairKey,
          remark: dto.remark,
          status: IntroductionStatus.INITIATED,
          matchScore: score?.score ?? null,
          matchDetail: (score?.details ?? []) as unknown as Prisma.InputJsonValue,
        },
      });
      await tx.introductionEvent.create({
        data: {
          introductionId: created.id,
          fromStatus: null,
          toStatus: IntroductionStatus.INITIATED,
          note: dto.remark ?? '红娘发起牵线',
          operatorId: operator.id,
          operatorName: operator.name,
        },
      });
      return created;
    });

    this.logger.log(`牵线 ${intro.serialNo} 发起：${a.serialNo} × ${b.serialNo}，匹配分 ${score?.score}`);
    return this.toDto(intro.id, null);
  }

  /**
   * 推进状态。所有流转的唯一入口。
   *
   * 副作用挂在这里：
   *   → CONTACT_EXCHANGED  双方互相解锁联系方式（不扣次数，这是红娘服务的价值）
   *   → SUCCESS            给红娘记一笔成单分润
   */
  async advance(
    id: string,
    dto: AdvanceIntroductionDto,
    operator: { id: string; name: string },
    actor: AuthUser,
    /**
     * 当事人本人拒绝牵线时走这里。调用方已经确认过他是 A 或 B 方，
     * 不需要再校验"是不是这条单的红娘"——但也不能因此给他红娘的其它权限，
     * 所以用一个显式开关，而不是伪造角色。
     */
    opts: { skipOwnerCheck?: boolean } = {},
  ): Promise<IntroductionDto> {
    const intro = await this.prisma.introduction.findUnique({
      where: { id },
      include: { aProfile: true, bProfile: true, matchmaker: true },
    });
    if (!intro) throw new NotFoundException('牵线单不存在');
    if (!opts.skipOwnerCheck) await this.assertCanOperate(intro.matchmakerId, actor);

    const from = intro.status as IntroductionStatus;
    const to = dto.targetStatus;
    assertTransition(INTRODUCTION_STATUS_TRANSITIONS, from, to, '牵线状态');

    if (to === IntroductionStatus.SUCCESS && !dto.note?.trim()) {
      throw new BizException('标记成功时请填写结果反馈，便于后续复盘', 40043);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.introduction.update({
        where: { id },
        data: {
          status: to,
          ...(to === IntroductionStatus.SUCCESS || to === IntroductionStatus.FAILED
            ? { resultNote: dto.note ?? null }
            : {}),
        },
      });

      await tx.introductionEvent.create({
        data: {
          introductionId: id,
          fromStatus: from,
          toStatus: to,
          note: dto.note ?? null,
          operatorId: operator.id,
          operatorName: operator.name,
        },
      });

      if (to === IntroductionStatus.CONTACT_EXCHANGED) {
        await this.privacy.unlockByIntroduction(
          intro.aProfile.userId,
          intro.bProfile.userId,
          intro.aProfileId,
          intro.bProfileId,
          id,
          tx,
        );
        this.logger.log(`牵线 ${intro.serialNo} 交换联系方式，双方已互相解锁`);
      }

      if (to === IntroductionStatus.SUCCESS) {
        await this.commission.grantForIntroduction(
          { matchmakerId: intro.matchmakerId, introductionId: id, serialNo: intro.serialNo },
          tx,
        );
      }
    });

    return this.toDto(id, null);
  }

  /**
   * 会员本人表态同意/拒绝。
   *
   * 两方都同意才进 BOTH_AGREED；一方拒绝直接 FAILED。
   * 这里不让红娘代点——代点会让"双方同意"这个数据失真，业绩统计就没意义了。
   */
  async agree(id: string, dto: AgreeIntroductionDto, actor: AuthUser): Promise<IntroductionDto> {
    const intro = await this.prisma.introduction.findUnique({
      where: { id },
      include: { aProfile: { select: { userId: true } }, bProfile: { select: { userId: true } } },
    });
    if (!intro) throw new NotFoundException('牵线单不存在');

    const isA = intro.aProfile.userId === actor.userId;
    const isB = intro.bProfile.userId === actor.userId;
    if (!isA && !isB) throw new ForbiddenException('你不是这条牵线的当事人');

    const from = intro.status as IntroductionStatus;
    if (
      from !== IntroductionStatus.RECOMMENDED &&
      from !== IntroductionStatus.PARTIALLY_AGREED
    ) {
      throw new BizException(`当前状态（${from}）不能表态`, 40044);
    }

    if (!dto.agree) {
      return this.advance(
        id,
        { targetStatus: IntroductionStatus.FAILED, note: dto.note ?? '一方婉拒' },
        { id: actor.userId, name: actor.nickname ?? actor.phone },
        actor,
        { skipOwnerCheck: true },
      );
    }

    const aAgreed = isA ? true : intro.aAgreed;
    const bAgreed = isB ? true : intro.bAgreed;
    const both = aAgreed && bAgreed;
    const to = both ? IntroductionStatus.BOTH_AGREED : IntroductionStatus.PARTIALLY_AGREED;

    assertTransition(INTRODUCTION_STATUS_TRANSITIONS, from, to, '牵线状态');

    await this.prisma.$transaction(async (tx) => {
      await tx.introduction.update({ where: { id }, data: { aAgreed, bAgreed, status: to } });
      await tx.introductionEvent.create({
        data: {
          introductionId: id,
          fromStatus: from,
          toStatus: to,
          note: `${isA ? 'A' : 'B'} 方同意${dto.note ? `：${dto.note}` : ''}`,
          operatorId: actor.userId,
          operatorName: actor.nickname ?? actor.phone,
        },
      });
    });

    return this.toDto(id, actor);
  }

  async list(query: QueryIntroductionDto, actor: AuthUser): Promise<PageResult<IntroductionDto>> {
    const where: Prisma.IntroductionWhereInput = {};

    const isAdmin = actor.roles.includes('SUPER_ADMIN') || actor.roles.includes('ADMIN');
    if (!isAdmin) {
      if (actor.matchmakerId) {
        where.matchmakerId = actor.matchmakerId;
      } else if (actor.profileId) {
        // 普通会员只能看到自己参与的
        where.OR = [{ aProfileId: actor.profileId }, { bProfileId: actor.profileId }];
      } else {
        return buildPageResult<IntroductionDto>([], 0, query.page, query.pageSize);
      }
    } else if (query.matchmakerId) {
      where.matchmakerId = query.matchmakerId;
    }

    if (query.status) where.status = query.status;
    if (query.profileId) {
      where.AND = [{ OR: [{ aProfileId: query.profileId }, { bProfileId: query.profileId }] }];
    }
    if (query.keyword?.trim()) {
      where.serialNo = { contains: query.keyword.trim() };
    }

    const [rows, total] = await Promise.all([
      this.prisma.introduction.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: query.skip,
        take: query.take,
        include: INTRO_INCLUDE,
      }),
      this.prisma.introduction.count({ where }),
    ]);

    const level = isAdmin
      ? VisibilityLevel.ADMIN
      : actor.matchmakerId
        ? VisibilityLevel.MATCHMAKER
        : VisibilityLevel.MEMBER;

    return buildPageResult(
      rows.map((r) => this.mapDto(r, level)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async toDto(id: string, actor: AuthUser | null): Promise<IntroductionDto> {
    const row = await this.prisma.introduction.findUnique({ where: { id }, include: INTRO_INCLUDE });
    if (!row) throw new NotFoundException('牵线单不存在');

    const isAdmin = !!actor && (actor.roles.includes('SUPER_ADMIN') || actor.roles.includes('ADMIN'));
    const level = !actor
      ? VisibilityLevel.MATCHMAKER
      : isAdmin
        ? VisibilityLevel.ADMIN
        : actor.matchmakerId === row.matchmakerId
          ? VisibilityLevel.MATCHMAKER
          : VisibilityLevel.MEMBER;

    return this.mapDto(row, level);
  }

  private mapDto(
    row: Prisma.IntroductionGetPayload<{ include: typeof INTRO_INCLUDE }>,
    level: VisibilityLevel,
  ): IntroductionDto {
    return {
      id: row.id,
      serialNo: row.serialNo,
      matchmakerId: row.matchmakerId,
      matchmakerName: row.matchmaker.name,
      sideA: this.privacy.projectBrief(row.aProfile, level),
      sideB: this.privacy.projectBrief(row.bProfile, level),
      status: row.status as IntroductionStatus,
      aAgreed: row.aAgreed,
      bAgreed: row.bAgreed,
      remark: row.remark,
      matchScore: row.matchScore,
      events: row.events.map((e) => ({
        id: e.id,
        fromStatus: e.fromStatus as IntroductionStatus | null,
        toStatus: e.toStatus as IntroductionStatus,
        note: e.note,
        operatorId: e.operatorId ?? '',
        operatorName: e.operatorName ?? '系统',
        createdAt: e.createdAt.toISOString(),
      })),
      resultNote: row.resultNote,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async assertCanOperate(matchmakerId: string, actor: AuthUser): Promise<void> {
    if (actor.roles.includes('SUPER_ADMIN') || actor.roles.includes('ADMIN')) return;
    if (actor.matchmakerId === matchmakerId) return;
    throw new ForbiddenException('只能操作自己发起的牵线单');
  }
}
