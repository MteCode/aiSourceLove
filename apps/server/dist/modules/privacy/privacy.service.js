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
var PrivacyService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrivacyService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@yuanqiao/shared");
const all_exceptions_filter_1 = require("../../common/filters/all-exceptions.filter");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
const storage_service_1 = require("../../infra/storage/storage.service");
const field_service_1 = require("../field/field.service");
const benefit_service_1 = require("../vip/benefit.service");
/** 看原图（不打码）需要的等级。VIP 能看清晰照片是核心卖点之一。 */
const PHOTO_ORIGINAL_LEVEL = shared_1.VisibilityLevel.VIP;
/**
 * 字段可见等级的兜底表。
 * 正常情况下等级来自 FieldDef.visibility（运营可在后台调），
 * 这里是字典里没配这个字段时的默认值——宁可保守，不可泄露。
 */
const DEFAULT_VISIBILITY = {
    nickname: shared_1.VisibilityLevel.PUBLIC,
    gender: shared_1.VisibilityLevel.PUBLIC,
    age: shared_1.VisibilityLevel.PUBLIC,
    heightCm: shared_1.VisibilityLevel.PUBLIC,
    cityName: shared_1.VisibilityLevel.PUBLIC,
    education: shared_1.VisibilityLevel.PUBLIC,
    occupation: shared_1.VisibilityLevel.MEMBER,
    introduction: shared_1.VisibilityLevel.MEMBER,
    weightKg: shared_1.VisibilityLevel.MEMBER,
    maritalStatus: shared_1.VisibilityLevel.MEMBER,
    childrenStatus: shared_1.VisibilityLevel.MEMBER,
    hometownCityName: shared_1.VisibilityLevel.MEMBER,
    houseStatus: shared_1.VisibilityLevel.VIP,
    carStatus: shared_1.VisibilityLevel.VIP,
    school: shared_1.VisibilityLevel.VIP,
    company: shared_1.VisibilityLevel.VIP,
    annualIncome: shared_1.VisibilityLevel.VIP,
    birthday: shared_1.VisibilityLevel.VIP,
    // 命门：真实姓名和联系方式
    realName: shared_1.VisibilityLevel.UNLOCKED,
    phone: shared_1.VisibilityLevel.UNLOCKED,
    wechat: shared_1.VisibilityLevel.UNLOCKED,
};
/**
 * 隐私分级服务（模块4）。
 *
 * 全站**唯一**允许把 Profile 变成对外 DTO 的地方。
 * 任何绕过 project() 直接把 Prisma 实体 return 出去的代码都是数据泄露，
 * code review 必查这一条。
 */
let PrivacyService = PrivacyService_1 = class PrivacyService {
    prisma;
    storage;
    field;
    benefit;
    logger = new common_1.Logger(PrivacyService_1.name);
    constructor(prisma, storage, field, benefit) {
        this.prisma = prisma;
        this.storage = storage;
        this.field = field;
        this.benefit = benefit;
    }
    // ───────── 观看者上下文 ─────────
    async resolveViewer(profile, user) {
        if (!user) {
            return {
                userId: null,
                isSelf: false,
                isAdmin: false,
                isMatchmakerOf: false,
                isVip: false,
                isUnlocked: false,
            };
        }
        const isAdmin = user.roles.includes(shared_1.RoleCode.SUPER_ADMIN) ||
            user.roles.includes(shared_1.RoleCode.ADMIN) ||
            user.roles.includes(shared_1.RoleCode.AUDITOR);
        const isSelf = !!profile.userId && profile.userId === user.userId;
        // 红娘只对**自己名下**的会员有特权，不是所有红娘都能看所有人
        const isMatchmakerOf = !!user.matchmakerId && profile.matchmakerId === user.matchmakerId;
        const isUnlocked = isSelf
            ? true
            : await this.isUnlocked(user.userId, profile.id);
        return {
            userId: user.userId,
            isSelf,
            isAdmin,
            isMatchmakerOf,
            isVip: user.isVip,
            isUnlocked,
        };
    }
    async isUnlocked(viewerUserId, targetProfileId) {
        const row = await this.prisma.contactUnlock.findUnique({
            where: { viewerUserId_targetProfileId: { viewerUserId, targetProfileId } },
            select: { expiresAt: true },
        });
        if (!row)
            return false;
        return !row.expiresAt || row.expiresAt > new Date();
    }
    /** 由 ViewerContext 算出等级。等价于 shared 里的 resolveViewerLevel，这里重导出保持单一入口。 */
    levelOf(ctx) {
        if (ctx.isAdmin)
            return shared_1.VisibilityLevel.ADMIN;
        if (ctx.isSelf)
            return shared_1.VisibilityLevel.ADMIN;
        if (ctx.isMatchmakerOf)
            return shared_1.VisibilityLevel.MATCHMAKER;
        if (ctx.isUnlocked)
            return shared_1.VisibilityLevel.UNLOCKED;
        if (ctx.isVip)
            return shared_1.VisibilityLevel.VIP;
        if (ctx.userId)
            return shared_1.VisibilityLevel.MEMBER;
        return shared_1.VisibilityLevel.PUBLIC;
    }
    // ───────── 投影（脱敏）─────────
    /** 取字段的可见等级：优先用字典里配的，没配用兜底表，再没有就当 VIP 级（保守） */
    async visibilityMap() {
        const defs = await this.field.getEnabledFields();
        const map = new Map(Object.entries(DEFAULT_VISIBILITY));
        for (const d of defs)
            map.set(d.code, d.visibility);
        return map;
    }
    levelFor(map, code) {
        return map.get(code) ?? shared_1.VisibilityLevel.VIP;
    }
    /**
     * 把 Profile 实体投影成对外 DTO。
     *
     * 规则：看得见就给真值，看不见就换成 MaskedValue（带引导文案和脱敏预览）。
     * 给预览而不是直接抹掉，是为了让用户看到"138****8888"从而有付费冲动——
     * 完全不显示的话用户不知道有什么可解锁的。
     */
    async project(profile, viewer) {
        const level = this.levelOf(viewer);
        const vis = await this.visibilityMap();
        /** 看得见→真值；看不见→MaskedValue */
        const gate = (code, value, preview) => {
            if (value === null || value === undefined)
                return null;
            const need = this.levelFor(vis, code);
            if ((0, shared_1.canSee)(level, need))
                return value;
            return (0, shared_1.lockedValue)(need, preview);
        };
        const extras = {};
        for (const fv of profile.fieldValues ?? []) {
            const need = this.levelFor(vis, fv.fieldCode);
            const raw = fv.valueJson ?? fv.valueText ?? fv.valueNum ?? fv.valueDate ?? null;
            extras[fv.fieldCode] = (0, shared_1.canSee)(level, need) ? raw : (0, shared_1.lockedValue)(need);
        }
        const age = (0, shared_1.calcAge)(profile.birthday);
        const showOriginalPhoto = level >= PHOTO_ORIGINAL_LEVEL;
        return {
            id: profile.id,
            serialNo: profile.serialNo,
            // 展示名：有昵称用昵称，否则用脱敏后的真名（张*），都没有就用编号
            displayName: profile.nickname || (profile.realName ? (0, shared_1.maskName)(profile.realName) : profile.serialNo),
            realName: gate('realName', profile.realName, (0, shared_1.maskName)(profile.realName)),
            gender: profile.gender,
            age,
            birthday: gate('birthday', (0, shared_1.toDateStr)(profile.birthday)),
            heightCm: profile.heightCm,
            weightKg: profile.weightKg,
            education: profile.education,
            school: gate('school', profile.school),
            occupation: profile.occupation,
            company: gate('company', profile.company),
            annualIncome: gate('annualIncome', profile.annualIncome),
            maritalStatus: profile.maritalStatus,
            childrenStatus: profile.childrenStatus,
            houseStatus: profile.houseStatus,
            carStatus: profile.carStatus,
            provinceCode: profile.provinceCode,
            cityCode: profile.cityCode,
            districtCode: profile.districtCode,
            cityName: profile.cityName,
            hometownCityName: profile.hometownCityName,
            introduction: profile.introduction,
            phone: gate('phone', profile.phone, (0, shared_1.maskPhone)(profile.phone)),
            wechat: gate('wechat', profile.wechat, (0, shared_1.maskAccount)(profile.wechat)),
            photos: this.projectPhotos(profile.photos ?? [], showOriginalPhoto, viewer),
            preference: profile.preference
                ? {
                    ageMin: profile.preference.ageMin,
                    ageMax: profile.preference.ageMax,
                    heightMin: profile.preference.heightMin,
                    heightMax: profile.preference.heightMax,
                    educationMin: profile.preference.educationMin,
                    incomeMin: profile.preference.incomeMin,
                    maritalStatus: profile.preference.maritalStatus ?? [],
                    childrenStatus: profile.preference.childrenStatus ?? [],
                    cityCodes: profile.preference.cityCodes ?? [],
                    requireHouse: profile.preference.requireHouse,
                    requireCar: profile.preference.requireCar,
                    description: profile.preference.description,
                }
                : null,
            extras,
            status: profile.status,
            source: profile.source,
            matchmakerId: profile.matchmakerId,
            matchmakerName: profile.matchmaker?.name ?? null,
            isTop: profile.isTop && (!profile.topExpireAt || profile.topExpireAt > new Date()),
            lastActiveAt: profile.lastActiveAt?.toISOString() ?? null,
            createdAt: profile.createdAt.toISOString(),
            viewerLevel: level,
        };
    }
    projectPhotos(photos, showOriginal, viewer) {
        return photos
            // 未过审的照片只有本人、归属红娘、管理员看得到
            .filter((p) => p.auditStatus === 'APPROVED' || viewer.isSelf || viewer.isMatchmakerOf || viewer.isAdmin)
            .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sort - b.sort)
            .map((p) => {
            const useOriginal = showOriginal || !p.maskedUrl;
            return {
                id: p.id,
                url: this.storage.toAbsoluteUrl(useOriginal ? p.url : p.maskedUrl) ?? '',
                masked: !useOriginal,
                isPrimary: p.isPrimary,
                auditStatus: p.auditStatus,
                sort: p.sort,
            };
        });
    }
    /** 列表页的精简投影。列表一律用打码头像，看清楚请点进详情——这是转化漏斗设计。 */
    projectBrief(profile, viewerLevel) {
        const primary = profile.photos?.find((p) => p.isPrimary && p.auditStatus === 'APPROVED') ??
            profile.photos?.find((p) => p.auditStatus === 'APPROVED');
        const showOriginal = viewerLevel >= PHOTO_ORIGINAL_LEVEL;
        const useOriginal = showOriginal || !primary?.maskedUrl;
        return {
            id: profile.id,
            serialNo: profile.serialNo,
            displayName: profile.nickname || (profile.realName ? (0, shared_1.maskName)(profile.realName) : profile.serialNo),
            gender: profile.gender,
            age: (0, shared_1.calcAge)(profile.birthday),
            heightCm: profile.heightCm,
            education: profile.education,
            cityName: profile.cityName,
            occupation: profile.occupation,
            avatarUrl: primary
                ? this.storage.toAbsoluteUrl(useOriginal ? primary.url : primary.maskedUrl)
                : null,
            avatarMasked: !!primary && !useOriginal,
            isTop: profile.isTop && (!profile.topExpireAt || profile.topExpireAt > new Date()),
            status: profile.status,
        };
    }
    // ───────── 解锁联系方式 ─────────
    /**
     * 花权益解锁某人的联系方式。
     *
     * 幂等：同一个人只会扣一次次数，重复调用直接返回已解锁。
     * 这个接口是要花用户钱的，必须经得起重复点击和网络重试。
     */
    async unlockContact(viewerUserId, targetProfileId) {
        const target = await this.prisma.profile.findFirst({
            where: { id: targetProfileId, deletedAt: null },
            select: { id: true, userId: true, status: true },
        });
        if (!target)
            throw new common_1.NotFoundException('该会员不存在');
        if (target.userId === viewerUserId) {
            throw new all_exceptions_filter_1.BizException('不用解锁自己', 40020);
        }
        if (target.status !== 'APPROVED') {
            throw new all_exceptions_filter_1.BizException('该会员资料未通过审核或已下架，暂不可解锁', 40021);
        }
        const already = await this.prisma.contactUnlock.findUnique({
            where: { viewerUserId_targetProfileId: { viewerUserId, targetProfileId } },
        });
        if (already) {
            const { remaining } = await this.benefit.getRemaining(viewerUserId, shared_1.BenefitCode.UNLOCK_CONTACT);
            return { unlocked: true, alreadyUnlocked: true, remaining };
        }
        return this.prisma.$transaction(async (tx) => {
            const r = await this.benefit.consume({
                userId: viewerUserId,
                code: shared_1.BenefitCode.UNLOCK_CONTACT,
                bizType: 'UNLOCK_CONTACT',
                // 幂等键与"谁解锁谁"一一对应
                bizKey: `unlock:${viewerUserId}:${targetProfileId}`,
                remark: `解锁 ${targetProfileId} 的联系方式`,
                tx,
            });
            await tx.contactUnlock.upsert({
                where: { viewerUserId_targetProfileId: { viewerUserId, targetProfileId } },
                create: { viewerUserId, targetProfileId, source: shared_1.UnlockSource.BENEFIT },
                update: {},
            });
            return { unlocked: true, alreadyUnlocked: r.alreadyConsumed, remaining: r.remaining };
        });
    }
    /** 牵线成功后双方自动互相解锁，不扣次数——这是红娘服务的价值体现 */
    async unlockByIntroduction(aUserId, bUserId, aProfileId, bProfileId, introductionId, tx) {
        const pairs = [];
        if (aUserId)
            pairs.push({ viewerUserId: aUserId, targetProfileId: bProfileId });
        if (bUserId)
            pairs.push({ viewerUserId: bUserId, targetProfileId: aProfileId });
        for (const p of pairs) {
            await tx.contactUnlock.upsert({
                where: {
                    viewerUserId_targetProfileId: {
                        viewerUserId: p.viewerUserId,
                        targetProfileId: p.targetProfileId,
                    },
                },
                create: { ...p, source: shared_1.UnlockSource.INTRODUCTION, introductionId },
                update: { source: shared_1.UnlockSource.INTRODUCTION, introductionId },
            });
        }
    }
    /** 后台手工赠送解锁 */
    async unlockByAdmin(viewerUserId, targetProfileId) {
        await this.prisma.contactUnlock.upsert({
            where: { viewerUserId_targetProfileId: { viewerUserId, targetProfileId } },
            create: { viewerUserId, targetProfileId, source: shared_1.UnlockSource.ADMIN },
            update: { source: shared_1.UnlockSource.ADMIN },
        });
    }
    // ───────── 浏览记录与配额 ─────────
    /**
     * 记录一次浏览，并消耗"每日查看资料"权益。
     *
     * 当天重复看同一个人不重复扣次数——不然用户来回翻两下额度就没了，
     * 体验差且会被投诉。靠 (viewer, target, dayKey) 唯一键实现。
     */
    async recordView(viewerUserId, targetProfileId, opts) {
        const dayKey = (0, shared_1.toDateStr)(new Date());
        const existing = await this.prisma.profileView.findUnique({
            where: {
                viewerUserId_targetProfileId_dayKey: { viewerUserId, targetProfileId, dayKey },
            },
            select: { id: true },
        });
        if (existing) {
            // 今天已经看过，不再扣次数
            return { counted: false, remaining: null };
        }
        if (opts.consumeQuota) {
            const r = await this.benefit.consume({
                userId: viewerUserId,
                code: shared_1.BenefitCode.VIEW_PROFILE,
                bizType: 'VIEW_PROFILE',
                bizKey: `view:${viewerUserId}:${targetProfileId}:${dayKey}`,
                remark: '查看资料',
            });
            await this.writeView(viewerUserId, targetProfileId, dayKey);
            return { counted: true, remaining: r.remaining };
        }
        await this.writeView(viewerUserId, targetProfileId, dayKey);
        return { counted: true, remaining: null };
    }
    async writeView(viewerUserId, targetProfileId, dayKey) {
        await this.prisma.profileView
            .create({ data: { viewerUserId, targetProfileId, dayKey } })
            .catch(() => undefined); // 并发下唯一键冲突，忽略即可
        await this.prisma.profile
            .update({ where: { id: targetProfileId }, data: { viewCount: { increment: 1 } } })
            .catch(() => undefined);
    }
    /** 谁看过我 */
    async listVisitors(profileId, take = 50) {
        return this.prisma.profileView.findMany({
            where: { targetProfileId: profileId },
            orderBy: { createdAt: 'desc' },
            take,
            include: {
                viewer: {
                    select: { id: true, nickname: true, avatar: true, profile: { select: { id: true } } },
                },
            },
        });
    }
};
exports.PrivacyService = PrivacyService;
exports.PrivacyService = PrivacyService = PrivacyService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        storage_service_1.StorageService,
        field_service_1.FieldService,
        benefit_service_1.BenefitService])
], PrivacyService);
//# sourceMappingURL=privacy.service.js.map