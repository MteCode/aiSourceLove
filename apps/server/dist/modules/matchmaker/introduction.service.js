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
var IntroductionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntroductionService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@yuanqiao/shared");
const all_exceptions_filter_1 = require("../../common/filters/all-exceptions.filter");
const pagination_dto_1 = require("../../common/dto/pagination.dto");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
const privacy_service_1 = require("../privacy/privacy.service");
const match_service_1 = require("../match/match.service");
const commission_service_1 = require("./commission.service");
const INTRO_INCLUDE = {
    matchmaker: { select: { id: true, name: true } },
    aProfile: { include: { photos: true } },
    bProfile: { include: { photos: true } },
    events: { orderBy: { createdAt: 'asc' } },
};
/**
 * 牵线服务（模块3 的核心）。
 *
 * 状态流：发起 → 推荐 → 单方同意 → 双方同意 → 交换联系方式 → 见面 → 结果
 * 每一次流转都：① 过状态机校验 ② 写事件流水 ③ 触发副作用（解锁/分润）
 *
 * 为什么要事件流水：红娘的业绩纠纷全靠它。"我明明推荐了""你没推"这种扯皮
 * 只有时间戳能解决。
 */
let IntroductionService = IntroductionService_1 = class IntroductionService {
    prisma;
    privacy;
    match;
    commission;
    logger = new common_1.Logger(IntroductionService_1.name);
    constructor(prisma, privacy, match, commission) {
        this.prisma = prisma;
        this.privacy = privacy;
        this.match = match;
        this.commission = commission;
    }
    pairKey(a, b) {
        return [a, b].sort().join(':');
    }
    /** 红娘发起牵线 */
    async create(matchmakerId, dto, operator) {
        if (dto.aProfileId === dto.bProfileId) {
            throw new all_exceptions_filter_1.BizException('不能给同一个人牵线', 40040);
        }
        const [a, b] = await Promise.all([
            this.prisma.profile.findFirst({ where: { id: dto.aProfileId, deletedAt: null } }),
            this.prisma.profile.findFirst({ where: { id: dto.bProfileId, deletedAt: null } }),
        ]);
        if (!a || !b)
            throw new common_1.NotFoundException('会员档案不存在');
        if (a.status !== 'APPROVED' || b.status !== 'APPROVED') {
            throw new all_exceptions_filter_1.BizException('只能给资料已审核通过的会员牵线', 40041);
        }
        if (a.gender === b.gender) {
            throw new all_exceptions_filter_1.BizException('当前仅支持异性牵线', 40042);
        }
        // 同一对人只能有一条进行中的牵线，否则双方会收到重复推荐
        const pairKey = this.pairKey(dto.aProfileId, dto.bProfileId);
        const active = await this.prisma.introduction.findFirst({
            where: {
                pairKey,
                status: {
                    notIn: [shared_1.IntroductionStatus.SUCCESS, shared_1.IntroductionStatus.FAILED, shared_1.IntroductionStatus.CANCELLED],
                },
            },
            select: { serialNo: true, status: true },
        });
        if (active) {
            throw new all_exceptions_filter_1.BizException(`这两位已有进行中的牵线单（${active.serialNo}）`, 40922);
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
                    status: shared_1.IntroductionStatus.INITIATED,
                    matchScore: score?.score ?? null,
                    matchDetail: (score?.details ?? []),
                },
            });
            await tx.introductionEvent.create({
                data: {
                    introductionId: created.id,
                    fromStatus: null,
                    toStatus: shared_1.IntroductionStatus.INITIATED,
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
    async advance(id, dto, operator, actor, 
    /**
     * 当事人本人拒绝牵线时走这里。调用方已经确认过他是 A 或 B 方，
     * 不需要再校验"是不是这条单的红娘"——但也不能因此给他红娘的其它权限，
     * 所以用一个显式开关，而不是伪造角色。
     */
    opts = {}) {
        const intro = await this.prisma.introduction.findUnique({
            where: { id },
            include: { aProfile: true, bProfile: true, matchmaker: true },
        });
        if (!intro)
            throw new common_1.NotFoundException('牵线单不存在');
        if (!opts.skipOwnerCheck)
            await this.assertCanOperate(intro.matchmakerId, actor);
        const from = intro.status;
        const to = dto.targetStatus;
        (0, shared_1.assertTransition)(shared_1.INTRODUCTION_STATUS_TRANSITIONS, from, to, '牵线状态');
        if (to === shared_1.IntroductionStatus.SUCCESS && !dto.note?.trim()) {
            throw new all_exceptions_filter_1.BizException('标记成功时请填写结果反馈，便于后续复盘', 40043);
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.introduction.update({
                where: { id },
                data: {
                    status: to,
                    ...(to === shared_1.IntroductionStatus.SUCCESS || to === shared_1.IntroductionStatus.FAILED
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
            if (to === shared_1.IntroductionStatus.CONTACT_EXCHANGED) {
                await this.privacy.unlockByIntroduction(intro.aProfile.userId, intro.bProfile.userId, intro.aProfileId, intro.bProfileId, id, tx);
                this.logger.log(`牵线 ${intro.serialNo} 交换联系方式，双方已互相解锁`);
            }
            if (to === shared_1.IntroductionStatus.SUCCESS) {
                await this.commission.grantForIntroduction({ matchmakerId: intro.matchmakerId, introductionId: id, serialNo: intro.serialNo }, tx);
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
    async agree(id, dto, actor) {
        const intro = await this.prisma.introduction.findUnique({
            where: { id },
            include: { aProfile: { select: { userId: true } }, bProfile: { select: { userId: true } } },
        });
        if (!intro)
            throw new common_1.NotFoundException('牵线单不存在');
        const isA = intro.aProfile.userId === actor.userId;
        const isB = intro.bProfile.userId === actor.userId;
        if (!isA && !isB)
            throw new common_1.ForbiddenException('你不是这条牵线的当事人');
        const from = intro.status;
        if (from !== shared_1.IntroductionStatus.RECOMMENDED &&
            from !== shared_1.IntroductionStatus.PARTIALLY_AGREED) {
            throw new all_exceptions_filter_1.BizException(`当前状态（${from}）不能表态`, 40044);
        }
        if (!dto.agree) {
            return this.advance(id, { targetStatus: shared_1.IntroductionStatus.FAILED, note: dto.note ?? '一方婉拒' }, { id: actor.userId, name: actor.nickname ?? actor.phone }, actor, { skipOwnerCheck: true });
        }
        const aAgreed = isA ? true : intro.aAgreed;
        const bAgreed = isB ? true : intro.bAgreed;
        const both = aAgreed && bAgreed;
        const to = both ? shared_1.IntroductionStatus.BOTH_AGREED : shared_1.IntroductionStatus.PARTIALLY_AGREED;
        (0, shared_1.assertTransition)(shared_1.INTRODUCTION_STATUS_TRANSITIONS, from, to, '牵线状态');
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
    async list(query, actor) {
        const where = {};
        const isAdmin = actor.roles.includes('SUPER_ADMIN') || actor.roles.includes('ADMIN');
        if (!isAdmin) {
            if (actor.matchmakerId) {
                where.matchmakerId = actor.matchmakerId;
            }
            else if (actor.profileId) {
                // 普通会员只能看到自己参与的
                where.OR = [{ aProfileId: actor.profileId }, { bProfileId: actor.profileId }];
            }
            else {
                return (0, pagination_dto_1.buildPageResult)([], 0, query.page, query.pageSize);
            }
        }
        else if (query.matchmakerId) {
            where.matchmakerId = query.matchmakerId;
        }
        if (query.status)
            where.status = query.status;
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
            ? shared_1.VisibilityLevel.ADMIN
            : actor.matchmakerId
                ? shared_1.VisibilityLevel.MATCHMAKER
                : shared_1.VisibilityLevel.MEMBER;
        return (0, pagination_dto_1.buildPageResult)(rows.map((r) => this.mapDto(r, level)), total, query.page, query.pageSize);
    }
    async toDto(id, actor) {
        const row = await this.prisma.introduction.findUnique({ where: { id }, include: INTRO_INCLUDE });
        if (!row)
            throw new common_1.NotFoundException('牵线单不存在');
        const isAdmin = !!actor && (actor.roles.includes('SUPER_ADMIN') || actor.roles.includes('ADMIN'));
        const level = !actor
            ? shared_1.VisibilityLevel.MATCHMAKER
            : isAdmin
                ? shared_1.VisibilityLevel.ADMIN
                : actor.matchmakerId === row.matchmakerId
                    ? shared_1.VisibilityLevel.MATCHMAKER
                    : shared_1.VisibilityLevel.MEMBER;
        return this.mapDto(row, level);
    }
    mapDto(row, level) {
        return {
            id: row.id,
            serialNo: row.serialNo,
            matchmakerId: row.matchmakerId,
            matchmakerName: row.matchmaker.name,
            sideA: this.privacy.projectBrief(row.aProfile, level),
            sideB: this.privacy.projectBrief(row.bProfile, level),
            status: row.status,
            aAgreed: row.aAgreed,
            bAgreed: row.bAgreed,
            remark: row.remark,
            matchScore: row.matchScore,
            events: row.events.map((e) => ({
                id: e.id,
                fromStatus: e.fromStatus,
                toStatus: e.toStatus,
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
    async assertCanOperate(matchmakerId, actor) {
        if (actor.roles.includes('SUPER_ADMIN') || actor.roles.includes('ADMIN'))
            return;
        if (actor.matchmakerId === matchmakerId)
            return;
        throw new common_1.ForbiddenException('只能操作自己发起的牵线单');
    }
};
exports.IntroductionService = IntroductionService;
exports.IntroductionService = IntroductionService = IntroductionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        privacy_service_1.PrivacyService,
        match_service_1.MatchService,
        commission_service_1.CommissionService])
], IntroductionService);
//# sourceMappingURL=introduction.service.js.map