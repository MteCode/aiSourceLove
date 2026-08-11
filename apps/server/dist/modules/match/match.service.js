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
var MatchService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@yuanqiao/shared");
const pagination_dto_1 = require("../../common/dto/pagination.dto");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
const ai_service_1 = require("../../infra/ai/ai.service");
const privacy_service_1 = require("../privacy/privacy.service");
const benefit_service_1 = require("../vip/benefit.service");
const scoring_1 = require("./scoring");
const match_dto_1 = require("./dto/match.dto");
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
};
let MatchService = MatchService_1 = class MatchService {
    prisma;
    ai;
    privacy;
    benefit;
    logger = new common_1.Logger(MatchService_1.name);
    constructor(prisma, ai, privacy, benefit) {
        this.prisma = prisma;
        this.ai = ai;
        this.privacy = privacy;
        this.benefit = benefit;
    }
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
    async run(query, viewer) {
        const self = await this.loadScoringProfile(query.profileId);
        if (!self)
            throw new common_1.NotFoundException('档案不存在');
        await this.assertCanMatchFor(query.profileId, viewer);
        // ── L1 ──
        const candidates = await this.hardFilter(self, query);
        if (!candidates.length) {
            return (0, pagination_dto_1.buildPageResult)([], 0, query.page, query.pageSize);
        }
        // ── L2 ──
        let scored = candidates
            .map((c) => ({ candidate: c, result: (0, scoring_1.computeMatchScore)({ self, candidate: c, semantic: null, weights: query.weights }) }))
            .sort((a, b) => b.result.score - a.result.score);
        if (query.minScore != null) {
            scored = scored.filter((s) => s.result.score >= query.minScore);
        }
        // ── L3（可选，消耗权益）──
        const aiEnabled = query.enableAi === true;
        let aiReasons = new Map();
        if (aiEnabled) {
            await this.consumeAiQuota(viewer, query.profileId);
            const head = scored.slice(0, shared_1.MATCH_LIMITS.maxAiCandidates);
            const semantics = await this.computeSemanticScores(self.id, head.map((h) => h.candidate.id));
            if (semantics) {
                // 带上语义分重新打一遍并重排
                for (const h of head) {
                    h.result = (0, scoring_1.computeMatchScore)({
                        self,
                        candidate: h.candidate,
                        semantic: semantics.get(h.candidate.id) ?? null,
                        weights: query.weights,
                    });
                }
                head.sort((a, b) => b.result.score - a.result.score);
                scored = [...head, ...scored.slice(shared_1.MATCH_LIMITS.maxAiCandidates)];
            }
            aiReasons = await this.generateReasons(self.id, scored.slice(0, 3));
        }
        // ── 分页 + 投影 ──
        const total = scored.length;
        const pageItems = scored.slice(query.skip, query.skip + query.take);
        const briefs = await this.loadBriefs(pageItems.map((p) => p.candidate.id), viewer);
        const list = pageItems.flatMap((p) => {
            const brief = briefs.get(p.candidate.id);
            if (!brief)
                return [];
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
        return (0, pagination_dto_1.buildPageResult)(list, total, query.page, query.pageSize);
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
    async hardFilter(self, query) {
        const selfAge = (0, shared_1.calcAge)(self.birthday);
        const pref = self.preference;
        const where = {
            deletedAt: null,
            status: 'APPROVED',
            id: { not: self.id },
            // MVP 只做异性匹配。要支持同性把这行改成按 orientation 字段决定。
            gender: self.gender === shared_1.Gender.MALE ? 'FEMALE' : 'MALE',
        };
        // 我的年龄期望 → 候选的生日区间（用生日区间而不是算年龄，才能走索引）
        if (pref?.ageMin != null || pref?.ageMax != null) {
            const r = (0, shared_1.ageRangeToBirthdayRange)(pref?.ageMin, pref?.ageMax);
            where.birthday = { ...(r.gte ? { gte: r.gte } : {}), ...(r.lte ? { lte: r.lte } : {}) };
        }
        // 对方的年龄期望要能容纳我：candidate.pref.ageMin <= 我的年龄 <= candidate.pref.ageMax
        // null 表示不限，所以都要 OR 上 null
        const reverseAge = {
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
        const and = [reverseAge];
        // 我期望的城市
        const cityCodes = query.cityCode ? [query.cityCode] : (pref?.cityCodes ?? []);
        if (cityCodes.length)
            and.push({ cityCode: { in: cityCodes } });
        // 我能接受的婚史 / 子女（正向，标量列，直接 in）
        if (pref?.maritalStatus?.length)
            and.push({ maritalStatus: { in: pref.maritalStatus } });
        if (pref?.childrenStatus?.length)
            and.push({ childrenStatus: { in: pref.childrenStatus } });
        // 我要求有房/有车
        if (pref?.requireHouse)
            and.push({ houseStatus: { in: ['MORTGAGE', 'FULL_PAID'] } });
        if (pref?.requireCar)
            and.push({ carStatus: { in: ['MORTGAGE', 'FULL_PAID'] } });
        where.AND = and;
        const rows = await this.prisma.profile.findMany({
            where,
            select: SCORING_SELECT,
            // 置顶的优先进入候选集（VIP 曝光权益在这里兑现）
            orderBy: [{ isTop: 'desc' }, { lastActiveAt: 'desc' }],
            take: shared_1.MATCH_LIMITS.maxCandidates,
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
    async computeSemanticScores(selfId, candidateIds) {
        const ids = [selfId, ...candidateIds];
        const profiles = await this.prisma.profile.findMany({
            where: { id: { in: ids } },
            select: {
                id: true,
                introduction: true,
                introEmbedding: true,
                prefEmbedding: true,
                embeddingUpdatedAt: true,
                preference: { select: { description: true } },
            },
        });
        // 缺向量的补算（懒加载：谁被匹配到才算谁，不做全量预热）
        const needEmbed = profiles.filter((p) => !p.embeddingUpdatedAt || p.introEmbedding == null || p.prefEmbedding == null);
        if (needEmbed.length) {
            const ok = await this.backfillEmbeddings(needEmbed);
            if (!ok)
                return null; // AI 不可用，降级为不算语义分
            // 重新读一次
            return this.computeSemanticScoresFromDb(selfId, candidateIds);
        }
        return this.semanticFrom(profiles, selfId, candidateIds);
    }
    async computeSemanticScoresFromDb(selfId, candidateIds) {
        const profiles = await this.prisma.profile.findMany({
            where: { id: { in: [selfId, ...candidateIds] } },
            select: { id: true, introEmbedding: true, prefEmbedding: true },
        });
        return this.semanticFrom(profiles, selfId, candidateIds);
    }
    semanticFrom(profiles, selfId, candidateIds) {
        const byId = new Map(profiles.map((p) => [p.id, p]));
        const self = byId.get(selfId);
        const out = new Map();
        if (!self)
            return out;
        const selfIntro = self.introEmbedding;
        const selfPref = self.prefEmbedding;
        for (const cid of candidateIds) {
            const c = byId.get(cid);
            if (!c)
                continue;
            const cIntro = c.introEmbedding;
            const cPref = c.prefEmbedding;
            const sims = [];
            if (selfIntro?.length && cPref?.length)
                sims.push((0, shared_1.cosineSimilarity)(selfIntro, cPref));
            if (cIntro?.length && selfPref?.length)
                sims.push((0, shared_1.cosineSimilarity)(cIntro, selfPref));
            if (!sims.length)
                continue;
            // 余弦范围是 [-1,1]，映射到 [0,1]
            const avg = sims.reduce((s, v) => s + v, 0) / sims.length;
            out.set(cid, (0, shared_1.clamp01)((avg + 1) / 2));
        }
        return out;
    }
    /** 批量补算向量并落库 */
    async backfillEmbeddings(profiles) {
        const texts = [];
        const slots = [];
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
        const byProfile = new Map();
        vectors.forEach((v, i) => {
            const slot = slots[i];
            const e = byProfile.get(slot.id) ?? {};
            e[slot.field] = v;
            byProfile.set(slot.id, e);
        });
        const now = new Date();
        await Promise.all([...byProfile.entries()].map(([id, v]) => this.prisma.profile.update({
            where: { id },
            data: {
                introEmbedding: (v.intro ?? []),
                prefEmbedding: (v.pref ?? []),
                embeddingUpdatedAt: now,
            },
        })));
        this.logger.log(`补算了 ${byProfile.size} 份档案的向量（provider=${this.ai.providerName}）`);
        return true;
    }
    /** 给头部候选生成推荐理由 */
    async generateReasons(selfId, top) {
        const out = new Map();
        if (!top.length)
            return out;
        const ids = [selfId, ...top.map((t) => t.candidate.id)];
        const descs = await this.prisma.profile.findMany({
            where: { id: { in: ids } },
            select: { id: true, introduction: true },
        });
        const descById = new Map(descs.map((d) => [d.id, d.introduction ?? '']));
        // 串行而不是并发：AI 接口通常有 QPS 限制，3 个请求串行也就 3 秒
        for (const t of top) {
            const reason = await this.ai.generateMatchReason({
                cacheKey: `${selfId}:${t.candidate.id}:${t.result.score}`,
                selfDesc: descById.get(selfId) ?? '',
                otherDesc: descById.get(t.candidate.id) ?? '',
                highlights: t.result.highlights,
                concerns: t.result.concerns,
                score: t.result.score,
            });
            if (reason)
                out.set(t.candidate.id, reason);
        }
        return out;
    }
    async consumeAiQuota(viewer, profileId) {
        // 红娘和管理员用 AI 匹配不扣会员权益——这是他们的生产工具
        if (viewer.matchmakerId || viewer.roles.includes('ADMIN') || viewer.roles.includes('SUPER_ADMIN')) {
            return;
        }
        const dayKey = new Date().toISOString().slice(0, 10);
        // 幂等键带上分钟，避免用户连点时被当成同一次而不扣费，同时又能容忍网络重试
        const minute = new Date().toISOString().slice(0, 16);
        await this.benefit.consume({
            userId: viewer.userId,
            code: shared_1.BenefitCode.AI_MATCH,
            bizType: 'AI_MATCH',
            bizKey: `ai_match:${viewer.userId}:${profileId}:${minute}`,
            remark: `AI 精准匹配 ${dayKey}`,
        });
    }
    // ═══════ 辅助 ═══════
    /** 只能给自己或名下会员做匹配 */
    async assertCanMatchFor(profileId, viewer) {
        if (viewer.roles.includes('SUPER_ADMIN') || viewer.roles.includes('ADMIN'))
            return;
        if (viewer.profileId === profileId)
            return;
        if (viewer.matchmakerId) {
            const n = await this.prisma.profile.count({
                where: { id: profileId, matchmakerId: viewer.matchmakerId },
            });
            if (n > 0)
                return;
        }
        throw new common_1.ForbiddenException('只能为自己或名下会员进行匹配');
    }
    async loadScoringProfile(id) {
        const p = await this.prisma.profile.findFirst({
            where: { id, deletedAt: null },
            select: SCORING_SELECT,
        });
        return p ? this.toScoringProfile(p) : null;
    }
    toScoringProfile(p) {
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
    toScoringPreference(pref) {
        return {
            ageMin: pref.ageMin,
            ageMax: pref.ageMax,
            heightMin: pref.heightMin,
            heightMax: pref.heightMax,
            educationMin: pref.educationMin,
            incomeMin: pref.incomeMin,
            maritalStatus: pref.maritalStatus ?? [],
            childrenStatus: pref.childrenStatus ?? [],
            cityCodes: pref.cityCodes ?? [],
            requireHouse: pref.requireHouse,
            requireCar: pref.requireCar,
            description: pref.description,
        };
    }
    async loadBriefs(ids, viewer) {
        if (!ids.length)
            return new Map();
        const rows = await this.prisma.profile.findMany({
            where: { id: { in: ids } },
            include: { photos: true },
        });
        const level = viewer.matchmakerId
            ? shared_1.VisibilityLevel.MATCHMAKER
            : viewer.isVip
                ? shared_1.VisibilityLevel.VIP
                : shared_1.VisibilityLevel.MEMBER;
        return new Map(rows.map((r) => [r.id, this.privacy.projectBrief(r, level)]));
    }
    /** 单对单打分，牵线时给红娘看"这两人到底配不配" */
    async scorePair(aProfileId, bProfileId) {
        const [a, b] = await Promise.all([
            this.loadScoringProfile(aProfileId),
            this.loadScoringProfile(bProfileId),
        ]);
        if (!a || !b)
            return null;
        return (0, scoring_1.computeMatchScore)({ self: a, candidate: b, semantic: null });
    }
    /** 后台调参：用不同权重跑同一个人，对比结果 */
    async previewWeights(profileId, weights, viewer) {
        return this.run(Object.assign(new match_dto_1.MatchQueryDto(), { profileId, weights, page: 1, pageSize: 10 }), viewer);
    }
};
exports.MatchService = MatchService;
exports.MatchService = MatchService = MatchService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ai_service_1.AiService,
        privacy_service_1.PrivacyService,
        benefit_service_1.BenefitService])
], MatchService);
//# sourceMappingURL=match.service.js.map