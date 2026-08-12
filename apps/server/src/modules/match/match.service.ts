import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  BenefitCode,
  Gender,
  MATCH_LIMITS,
  MatchResultDto,
  MatchWeightKey,
  PageResult,
  VisibilityLevel,
  ageRangeToBirthdayRange,
  calcAge,
  clamp01,
  cosineSimilarity,
} from '@yuanqiao/shared';
import { buildPageResult } from '@/common/dto/pagination.dto';
import type { AuthUser } from '@/common/types/auth-user';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { AiService } from '@/infra/ai/ai.service';
import { PrivacyService } from '@/modules/privacy/privacy.service';
import { BenefitService } from '@/modules/vip/benefit.service';
import { MatchScoreOutput, ScoringPreference, ScoringProfile, computeMatchScore } from './scoring';
import { MatchQueryDto } from './dto/match.dto';

/** 打分需要的字段——只 select 这些，别把 2000 字的自我介绍 500 份一起拉回来 */
const SCORING_SELECT = {
  id: true,
  gender: true,
  birthday: true,
  heightCm: true,
  education: true,
  annualIncome: true,
  maritalStatus: true,
  childrenStatus: true,
  houseStatus: true,
  carStatus: true,
  provinceCode: true,
  cityCode: true,
  lat: true,
  lng: true,
  preference: true,
} satisfies Prisma.ProfileSelect;

@Injectable()
export class MatchService {
  private readonly logger = new Logger(MatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly privacy: PrivacyService,
    private readonly benefit: BenefitService,
  ) {}

  /**
   * 三层匹配主流程。
   *
   *   L1 硬过滤（SQL）  → 把不可能的人排除掉，只留 ≤500 个候选
   *   L2 加权打分（内存）→ 双向满足度 + 年龄/学历/收入/距离/身高
   *   L3 AI 层（可选）  → 头部 20 个算语义相似度，Top3 生成推荐理由
   *
   * 冷启动阶段建议只开 L1+L2：用户少的时候纯规则效果比模型好，
   * 而且 L3 每次调用都是真金白银。enableAi 默认 false。
   */
  async run(query: MatchQueryDto, viewer: AuthUser): Promise<PageResult<MatchResultDto>> {
    const self = await this.loadScoringProfile(query.profileId);
    if (!self) throw new NotFoundException('档案不存在');

    await this.assertCanMatchFor(query.profileId, viewer);

    // ── L1 ──
    const candidates = await this.hardFilter(self, query);
    if (!candidates.length) {
      return buildPageResult<MatchResultDto>([], 0, query.page, query.pageSize);
    }

    // ── L2 ──
    let scored = candidates
      .map((c) => ({ candidate: c, result: computeMatchScore({ self, candidate: c, semantic: null, weights: query.weights }) }))
      .sort((a, b) => b.result.score - a.result.score);

    if (query.minScore != null) {
      scored = scored.filter((s) => s.result.score >= query.minScore!);
    }

    // ── L3（可选，消耗权益）──
    const aiEnabled = query.enableAi === true;
    let aiReasons = new Map<string, string>();
    if (aiEnabled) {
      await this.consumeAiQuota(viewer, query.profileId);
      const head = scored.slice(0, MATCH_LIMITS.maxAiCandidates);
      const semantics = await this.computeSemanticScores(self.id, head.map((h) => h.candidate.id));

      if (semantics) {
        // 带上语义分重新打一遍并重排
        for (const h of head) {
          h.result = computeMatchScore({
            self,
            candidate: h.candidate,
            semantic: semantics.get(h.candidate.id) ?? null,
            weights: query.weights,
          });
        }
        head.sort((a, b) => b.result.score - a.result.score);
        scored = [...head, ...scored.slice(MATCH_LIMITS.maxAiCandidates)];
      }

      aiReasons = await this.generateReasons(self.id, scored.slice(0, 3));
    }

    // ── 分页 + 投影 ──
    const total = scored.length;
    const pageItems = scored.slice(query.skip, query.skip + query.take);
    const briefs = await this.loadBriefs(pageItems.map((p) => p.candidate.id), viewer);

    const list: MatchResultDto[] = pageItems.flatMap((p) => {
      const brief = briefs.get(p.candidate.id);
      if (!brief) return [];
      return [
        {
          profile: brief,
          score: p.result.score,
          details: p.result.details,
          aSatisfiesB: p.result.aSatisfiesB,
          bSatisfiesA: p.result.bSatisfiesA,
          aiReason: aiReasons.get(p.candidate.id) ?? null,
          highlights: p.result.highlights,
          concerns: p.result.concerns,
        },
      ];
    });

    return buildPageResult(list, total, query.page, query.pageSize);
  }

  // ═══════ L1：硬过滤 ═══════

  /**
   * 不满足就直接排除的条件，全部下推到 SQL：
   *   性别取向、年龄区间（**双向**）、城市、婚史、子女
   *
   * 双向年龄是关键：既要对方在我的期望年龄内，也要我在对方的期望年龄内。
   * 后者能在 SQL 做是因为"我的年龄"在查询时是个常量。
   *
   * 婚史/子女/房车的**反向**判断（我是否符合对方要求）留到 L2 内存里做——
   * 那些条件存在 JSON 列里，在 MySQL 里过滤既写不干净也走不了索引，
   * 而候选集已经被前面几个条件压到 500 以内了，内存里过一遍很便宜。
   */
  private async hardFilter(self: ScoringProfile, query: MatchQueryDto): Promise<ScoringProfile[]> {
    const selfAge = calcAge(self.birthday);
    const pref = self.preference;

    const where: Prisma.ProfileWhereInput = {
      deletedAt: null,
      status: 'APPROVED',
      id: { not: self.id },
      // MVP 只做异性匹配。要支持同性把这行改成按 orientation 字段决定。
      gender: self.gender === Gender.MALE ? 'FEMALE' : 'MALE',
    };

    // 我的年龄期望 → 候选的生日区间（用生日区间而不是算年龄，才能走索引）
    if (pref?.ageMin != null || pref?.ageMax != null) {
      const r = ageRangeToBirthdayRange(pref?.ageMin, pref?.ageMax);
      where.birthday = { ...(r.gte ? { gte: r.gte } : {}), ...(r.lte ? { lte: r.lte } : {}) };
    }

    // 对方的年龄期望要能容纳我：candidate.pref.ageMin <= 我的年龄 <= candidate.pref.ageMax
    // null 表示不限，所以都要 OR 上 null
    const reverseAge: Prisma.ProfileWhereInput = {
      OR: [
        { preference: { is: null } },
        {
          preference: {
            is: {
              AND: [
                { OR: [{ ageMin: null }, { ageMin: { lte: selfAge } }] },
                { OR: [{ ageMax: null }, { ageMax: { gte: selfAge } }] },
              ],
            },
          },
        },
      ],
    };

    const and: Prisma.ProfileWhereInput[] = [reverseAge];

    // 我期望的城市
    const cityCodes = query.cityCode ? [query.cityCode] : (pref?.cityCodes ?? []);
    if (cityCodes.length) and.push({ cityCode: { in: cityCodes } });

    // 我能接受的婚史 / 子女（正向，标量列，直接 in）
    if (pref?.maritalStatus?.length) and.push({ maritalStatus: { in: pref.maritalStatus } });
    if (pref?.childrenStatus?.length) and.push({ childrenStatus: { in: pref.childrenStatus } });

    // 我要求有房/有车
    if (pref?.requireHouse) and.push({ houseStatus: { in: ['MORTGAGE', 'FULL_PAID'] } });
    if (pref?.requireCar) and.push({ carStatus: { in: ['MORTGAGE', 'FULL_PAID'] } });

    where.AND = and;

    const rows = await this.prisma.profile.findMany({
      where,
      select: SCORING_SELECT,
      // 置顶的优先进入候选集（VIP 曝光权益在这里兑现）
      orderBy: [{ isTop: 'desc' }, { lastActiveAt: 'desc' }],
      take: MATCH_LIMITS.maxCandidates,
    });

    return rows.map((r) => this.toScoringProfile(r));
  }

  // ═══════ L3：语义匹配 ═══════

  /**
   * 「自我介绍 ↔ 择偶描述」的语义匹配。
   *
   * 注意方向：不是拿两个人的自我介绍比相似度（那是找相似的人，不是找合适的人），
   * 而是 A 的自我介绍 vs B 的择偶描述、B 的自我介绍 vs A 的择偶描述，取平均。
   */
  private async computeSemanticScores(
    selfId: string,
    candidateIds: string[],
  ): Promise<Map<string, number> | null> {
    const ids = [selfId, ...candidateIds];
    const profiles = await this.prisma.profile.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        introduction: true,
        introEmbedding: true,
        prefEmbedding: true,
        embeddingUpdatedAt: true,
        embeddingModel: true,
        preference: { select: { description: true } },
      },
    });

    // 缺向量的补算（懒加载：谁被匹配到才算谁，不做全量预热）。
    // 模型对不上的也算"缺"——换了 embedding 模型之后，旧向量和新向量维度和语义空间都不同，
    // 拿来算余弦得到的是噪声，必须重算。
    const currentModel = this.ai.embeddingModelId;
    const needEmbed = profiles.filter(
      (p) =>
        !p.embeddingUpdatedAt ||
        p.introEmbedding == null ||
        p.prefEmbedding == null ||
        p.embeddingModel !== currentModel,
    );
    if (needEmbed.length) {
      const ok = await this.backfillEmbeddings(needEmbed);
      if (!ok) return null; // AI 不可用，降级为不算语义分
      // 重新读一次
      return this.computeSemanticScoresFromDb(selfId, candidateIds);
    }

    return this.semanticFrom(profiles, selfId, candidateIds);
  }

  private async computeSemanticScoresFromDb(selfId: string, candidateIds: string[]) {
    const profiles = await this.prisma.profile.findMany({
      where: { id: { in: [selfId, ...candidateIds] } },
      select: { id: true, introEmbedding: true, prefEmbedding: true },
    });
    return this.semanticFrom(profiles, selfId, candidateIds);
  }

  private semanticFrom(
    profiles: { id: string; introEmbedding: unknown; prefEmbedding: unknown }[],
    selfId: string,
    candidateIds: string[],
  ): Map<string, number> {
    const byId = new Map(profiles.map((p) => [p.id, p]));
    const self = byId.get(selfId);
    const out = new Map<string, number>();
    if (!self) return out;

    const selfIntro = self.introEmbedding as number[] | null;
    const selfPref = self.prefEmbedding as number[] | null;

    for (const cid of candidateIds) {
      const c = byId.get(cid);
      if (!c) continue;
      const cIntro = c.introEmbedding as number[] | null;
      const cPref = c.prefEmbedding as number[] | null;

      const sims: number[] = [];
      if (selfIntro?.length && cPref?.length) sims.push(cosineSimilarity(selfIntro, cPref));
      if (cIntro?.length && selfPref?.length) sims.push(cosineSimilarity(cIntro, selfPref));
      if (!sims.length) continue;

      // 余弦范围是 [-1,1]，映射到 [0,1]
      const avg = sims.reduce((s, v) => s + v, 0) / sims.length;
      out.set(cid, clamp01((avg + 1) / 2));
    }
    return out;
  }

  /** 批量补算向量并落库 */
  private async backfillEmbeddings(
    profiles: { id: string; introduction: string | null; preference: { description: string | null } | null }[],
  ): Promise<boolean> {
    const texts: string[] = [];
    const slots: { id: string; field: 'intro' | 'pref' }[] = [];

    for (const p of profiles) {
      texts.push(p.introduction?.trim() || '暂无自我介绍');
      slots.push({ id: p.id, field: 'intro' });
      texts.push(p.preference?.description?.trim() || '暂无择偶描述');
      slots.push({ id: p.id, field: 'pref' });
    }

    const vectors = await this.ai.embed(texts);
    if (!vectors) {
      this.logger.warn('向量化失败，本次匹配跳过 AI 层');
      return false;
    }

    const byProfile = new Map<string, { intro?: number[]; pref?: number[] }>();
    vectors.forEach((v, i) => {
      const slot = slots[i];
      const e = byProfile.get(slot.id) ?? {};
      e[slot.field] = v;
      byProfile.set(slot.id, e);
    });

    const now = new Date();
    await Promise.all(
      [...byProfile.entries()].map(([id, v]) =>
        this.prisma.profile.update({
          where: { id },
          data: {
            introEmbedding: (v.intro ?? []) as Prisma.InputJsonValue,
            prefEmbedding: (v.pref ?? []) as Prisma.InputJsonValue,
            embeddingUpdatedAt: now,
            embeddingModel: this.ai.embeddingModelId,
          },
        }),
      ),
    );
    // 这里要报向量模型，不是对话模型——两条通道可以来自不同厂商，报错了会指错方向
    this.logger.log(`补算了 ${byProfile.size} 份档案的向量（model=${this.ai.embeddingModelId}）`);
    return true;
  }

  /** 给头部候选生成推荐理由 */
  private async generateReasons(
    selfId: string,
    top: { candidate: ScoringProfile; result: MatchScoreOutput }[],
  ): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (!top.length) return out;

    const ids = [selfId, ...top.map((t) => t.candidate.id)];
    const descs = await this.prisma.profile.findMany({
      where: { id: { in: ids } },
      select: { id: true, introduction: true },
    });
    const descById = new Map(descs.map((d) => [d.id, d.introduction ?? '']));

    // 并发发出去。原来是串行的，前提是"每个也就 1 秒"——但换上推理型模型后
    // 单个要 20 秒，3 个串起来 60 秒，正好撞上 Nginx 的代理读超时，整个请求被切断。
    // 3 个并发对任何厂商的 QPS 限制都不构成压力。
    const results = await Promise.all(
      top.map((t) =>
        this.ai
          .generateMatchReason({
            cacheKey: `${selfId}:${t.candidate.id}:${t.result.score}`,
            selfDesc: descById.get(selfId) ?? '',
            otherDesc: descById.get(t.candidate.id) ?? '',
            highlights: t.result.highlights,
            concerns: t.result.concerns,
            score: t.result.score,
          })
          .then((reason) => ({ id: t.candidate.id, reason })),
      ),
    );
    for (const r of results) if (r.reason) out.set(r.id, r.reason);
    return out;
  }

  private async consumeAiQuota(viewer: AuthUser, profileId: string): Promise<void> {
    // 红娘和管理员用 AI 匹配不扣会员权益——这是他们的生产工具
    if (viewer.matchmakerId || viewer.roles.includes('ADMIN') || viewer.roles.includes('SUPER_ADMIN')) {
      return;
    }
    const dayKey = new Date().toISOString().slice(0, 10);
    // 幂等键带上分钟，避免用户连点时被当成同一次而不扣费，同时又能容忍网络重试
    const minute = new Date().toISOString().slice(0, 16);
    await this.benefit.consume({
      userId: viewer.userId,
      code: BenefitCode.AI_MATCH,
      bizType: 'AI_MATCH',
      bizKey: `ai_match:${viewer.userId}:${profileId}:${minute}`,
      remark: `AI 精准匹配 ${dayKey}`,
    });
  }

  // ═══════ 辅助 ═══════

  /** 只能给自己或名下会员做匹配 */
  private async assertCanMatchFor(profileId: string, viewer: AuthUser): Promise<void> {
    if (viewer.roles.includes('SUPER_ADMIN') || viewer.roles.includes('ADMIN')) return;
    if (viewer.profileId === profileId) return;

    if (viewer.matchmakerId) {
      const n = await this.prisma.profile.count({
        where: { id: profileId, matchmakerId: viewer.matchmakerId },
      });
      if (n > 0) return;
    }
    throw new ForbiddenException('只能为自己或名下会员进行匹配');
  }

  private async loadScoringProfile(id: string): Promise<ScoringProfile | null> {
    const p = await this.prisma.profile.findFirst({
      where: { id, deletedAt: null },
      select: SCORING_SELECT,
    });
    return p ? this.toScoringProfile(p) : null;
  }

  private toScoringProfile(p: Prisma.ProfileGetPayload<{ select: typeof SCORING_SELECT }>): ScoringProfile {
    return {
      id: p.id,
      gender: p.gender,
      birthday: p.birthday,
      heightCm: p.heightCm,
      education: p.education,
      annualIncome: p.annualIncome,
      maritalStatus: p.maritalStatus,
      childrenStatus: p.childrenStatus,
      houseStatus: p.houseStatus,
      carStatus: p.carStatus,
      provinceCode: p.provinceCode,
      cityCode: p.cityCode,
      lat: p.lat,
      lng: p.lng,
      introduction: null, // 打分不需要，L3 单独查
      preference: p.preference ? this.toScoringPreference(p.preference) : null,
    };
  }

  private toScoringPreference(pref: Prisma.PreferenceGetPayload<object>): ScoringPreference {
    return {
      ageMin: pref.ageMin,
      ageMax: pref.ageMax,
      heightMin: pref.heightMin,
      heightMax: pref.heightMax,
      educationMin: pref.educationMin,
      incomeMin: pref.incomeMin,
      maritalStatus: (pref.maritalStatus as ScoringPreference['maritalStatus']) ?? [],
      childrenStatus: (pref.childrenStatus as ScoringPreference['childrenStatus']) ?? [],
      cityCodes: (pref.cityCodes as string[]) ?? [],
      requireHouse: pref.requireHouse,
      requireCar: pref.requireCar,
      description: pref.description,
    };
  }

  private async loadBriefs(ids: string[], viewer: AuthUser) {
    if (!ids.length) return new Map();
    const rows = await this.prisma.profile.findMany({
      where: { id: { in: ids } },
      include: { photos: true },
    });
    const level = viewer.matchmakerId
      ? VisibilityLevel.MATCHMAKER
      : viewer.isVip
        ? VisibilityLevel.VIP
        : VisibilityLevel.MEMBER;
    return new Map(rows.map((r) => [r.id, this.privacy.projectBrief(r, level)]));
  }

  /** 单对单打分，牵线时给红娘看"这两人到底配不配" */
  async scorePair(aProfileId: string, bProfileId: string): Promise<MatchScoreOutput | null> {
    const [a, b] = await Promise.all([
      this.loadScoringProfile(aProfileId),
      this.loadScoringProfile(bProfileId),
    ]);
    if (!a || !b) return null;
    return computeMatchScore({ self: a, candidate: b, semantic: null });
  }

  /** 后台调参：用不同权重跑同一个人，对比结果 */
  async previewWeights(
    profileId: string,
    weights: Partial<Record<MatchWeightKey, number>>,
    viewer: AuthUser,
  ): Promise<PageResult<MatchResultDto>> {
    return this.run(
      Object.assign(new MatchQueryDto(), { profileId, weights, page: 1, pageSize: 10 }),
      viewer,
    );
  }
}
