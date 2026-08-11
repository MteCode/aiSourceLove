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
var ProfileService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const shared_1 = require("@yuanqiao/shared");
const all_exceptions_filter_1 = require("../../common/filters/all-exceptions.filter");
const pagination_dto_1 = require("../../common/dto/pagination.dto");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
const storage_service_1 = require("../../infra/storage/storage.service");
const field_service_1 = require("../field/field.service");
const privacy_service_1 = require("../privacy/privacy.service");
/**
 * 改了这些字段就要重新送审。
 * 改昵称、改身高不用重审（无关紧要），改真名、婚史、学历必须重审（会骗人的地方）。
 */
const REAUDIT_FIELDS = new Set([
    'realName', 'birthday', 'gender', 'education', 'school',
    'maritalStatus', 'childrenStatus', 'annualIncome', 'introduction', 'phone',
]);
const PROFILE_INCLUDE = {
    photos: true,
    preference: true,
    fieldValues: true,
    matchmaker: { select: { id: true, name: true } },
};
let ProfileService = ProfileService_1 = class ProfileService {
    prisma;
    field;
    privacy;
    storage;
    logger = new common_1.Logger(ProfileService_1.name);
    constructor(prisma, field, privacy, storage) {
        this.prisma = prisma;
        this.field = field;
        this.privacy = privacy;
        this.storage = storage;
    }
    // ═══════ 录入路径 1：用户自填 ═══════
    async upsertSelf(userId, dto) {
        const existing = await this.prisma.profile.findFirst({
            where: { userId, deletedAt: null },
            include: PROFILE_INCLUDE,
        });
        if (!existing) {
            // 注册时挂在用户上的邀请红娘，建档时转写过来
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { inviteMatchmakerId: true },
            });
            const created = await this.create(dto, {
                userId,
                source: shared_1.ProfileSource.SELF,
                matchmakerId: user?.inviteMatchmakerId ?? null,
            });
            return this.toDto(created.id, null);
        }
        await this.update(existing, dto, { operatorId: userId, operatorName: '本人' });
        return this.toDto(existing.id, null);
    }
    // ═══════ 录入路径 2：红娘代录 ═══════
    /**
     * 红娘代录线下地推来的资料。
     * 关键：**不需要对方有账号**——地推收上来的纸质表格先录进系统，
     * 本人之后注册时用编号认领（claim）。
     */
    async createByMatchmaker(matchmakerId, dto, operator) {
        if (dto.userId) {
            const taken = await this.prisma.profile.findFirst({
                where: { userId: dto.userId, deletedAt: null },
                select: { serialNo: true },
            });
            if (taken)
                throw new all_exceptions_filter_1.BizException(`该用户已有档案（${taken.serialNo}）`, 40910);
        }
        const created = await this.create(dto, {
            userId: dto.userId ?? null,
            source: shared_1.ProfileSource.MATCHMAKER,
            matchmakerId,
        });
        if (dto.submitNow !== false) {
            await this.transition(created.id, shared_1.ProfileStatus.PENDING, {
                operator,
                reason: '红娘代录后提交审核',
            });
        }
        return this.toDto(created.id, null);
    }
    /** 用户用编号认领红娘代录的档案 */
    async claim(userId, serialNo) {
        const profile = await this.prisma.profile.findFirst({
            where: { serialNo, deletedAt: null },
        });
        if (!profile)
            throw new common_1.NotFoundException('档案编号不存在');
        if (profile.userId) {
            throw new all_exceptions_filter_1.BizException(profile.userId === userId ? '这份档案已经是你的了' : '该档案已被其他账号认领', 40911);
        }
        const mine = await this.prisma.profile.findFirst({
            where: { userId, deletedAt: null },
            select: { serialNo: true },
        });
        if (mine)
            throw new all_exceptions_filter_1.BizException(`你已有档案（${mine.serialNo}），不能重复认领`, 40912);
        await this.prisma.profile.update({ where: { id: profile.id }, data: { userId } });
        this.logger.log(`用户 ${userId} 认领了档案 ${serialNo}`);
        return this.toDto(profile.id, null);
    }
    // ═══════ 建 / 改 ═══════
    async create(dto, meta) {
        const { normalized, errors } = await this.field.validateAndNormalize(dto.extras ?? {});
        if (errors.length)
            throw new all_exceptions_filter_1.BizException(errors.join('；'), 40030);
        return this.prisma.$transaction(async (tx) => {
            const serialNo = await this.prisma.nextSerial('profile', 'YQ', tx);
            const profile = await tx.profile.create({
                data: {
                    // 先铺业务字段，再让这些系统字段覆盖，避免 coreFields 里的可选键把它们冲掉
                    ...this.coreFields(dto),
                    serialNo,
                    userId: meta.userId,
                    source: meta.source,
                    matchmakerId: meta.matchmakerId,
                    status: shared_1.ProfileStatus.DRAFT,
                    ...(dto.preference ? { preference: { create: this.preferenceData(dto.preference) } } : {}),
                },
            });
            await this.writeExtras(tx, profile.id, normalized);
            await tx.profileAuditLog.create({
                data: {
                    profileId: profile.id,
                    fromStatus: null,
                    toStatus: shared_1.ProfileStatus.DRAFT,
                    reason: meta.source === shared_1.ProfileSource.MATCHMAKER ? '红娘代录建档' : '用户自建档案',
                    operatorId: meta.userId ?? meta.matchmakerId,
                },
            });
            return profile;
        });
    }
    async update(existing, dto, operator) {
        const { normalized, errors } = await this.field.validateAndNormalize(dto.extras ?? {});
        if (errors.length)
            throw new all_exceptions_filter_1.BizException(errors.join('；'), 40030);
        // 改了关键字段就要重新送审——已通过的资料被偷偷改成另一个人是这类系统的经典事故
        const changedKeyField = this.detectKeyFieldChange(existing, dto);
        const needReaudit = existing.status === shared_1.ProfileStatus.APPROVED && changedKeyField;
        await this.prisma.$transaction(async (tx) => {
            await tx.profile.update({
                where: { id: existing.id },
                data: {
                    ...this.coreFields(dto),
                    // 自我介绍或择偶描述变了，旧向量就失效了，清掉等重算
                    ...(dto.introduction !== undefined || dto.preference?.description !== undefined
                        ? { introEmbedding: client_1.Prisma.DbNull, prefEmbedding: client_1.Prisma.DbNull, embeddingUpdatedAt: null }
                        : {}),
                },
            });
            if (dto.preference) {
                await tx.preference.upsert({
                    where: { profileId: existing.id },
                    create: { profileId: existing.id, ...this.preferenceData(dto.preference) },
                    update: this.preferenceData(dto.preference),
                });
            }
            await this.writeExtras(tx, existing.id, normalized);
            if (needReaudit) {
                await tx.profile.update({
                    where: { id: existing.id },
                    data: { status: shared_1.ProfileStatus.PENDING },
                });
                await tx.profileAuditLog.create({
                    data: {
                        profileId: existing.id,
                        fromStatus: existing.status,
                        toStatus: shared_1.ProfileStatus.PENDING,
                        reason: `修改了关键字段（${changedKeyField}），自动重新送审`,
                        operatorId: operator.operatorId,
                        operatorName: operator.operatorName,
                    },
                });
            }
        });
    }
    detectKeyFieldChange(existing, dto) {
        for (const key of REAUDIT_FIELDS) {
            const next = dto[key];
            if (next === undefined)
                continue;
            const prev = existing[key];
            // 生日要按日期比，字符串直接比会误判
            if (key === 'birthday') {
                const a = prev instanceof Date ? prev.toISOString().slice(0, 10) : String(prev ?? '');
                if (a !== String(next).slice(0, 10))
                    return key;
                continue;
            }
            if (String(prev ?? '') !== String(next ?? ''))
                return key;
        }
        return null;
    }
    coreFields(dto) {
        // undefined 的字段不写（保持原值），null 才是"清空"
        const out = {};
        const assign = (k) => {
            if (dto[k] !== undefined)
                out[k] = dto[k];
        };
        [
            'realName', 'nickname', 'gender', 'heightCm', 'weightKg', 'education', 'school',
            'occupation', 'company', 'annualIncome', 'maritalStatus', 'childrenStatus',
            'houseStatus', 'carStatus', 'provinceCode', 'cityCode', 'districtCode',
            'hometownCityCode', 'introduction', 'phone', 'wechat',
        ].forEach(assign);
        if (dto.birthday !== undefined)
            out.birthday = new Date(dto.birthday);
        return out;
    }
    preferenceData(p) {
        return {
            ageMin: p.ageMin ?? null,
            ageMax: p.ageMax ?? null,
            heightMin: p.heightMin ?? null,
            heightMax: p.heightMax ?? null,
            educationMin: p.educationMin ?? null,
            incomeMin: p.incomeMin ?? null,
            maritalStatus: (p.maritalStatus ?? []),
            childrenStatus: (p.childrenStatus ?? []),
            cityCodes: (p.cityCodes ?? []),
            requireHouse: p.requireHouse ?? false,
            requireCar: p.requireCar ?? false,
            description: p.description ?? null,
        };
    }
    /** 把扩展字段写进 EAV 表，按字段类型落到对应的列 */
    async writeExtras(tx, profileId, values) {
        if (!Object.keys(values).length)
            return;
        const defs = await this.field.getEnabledFields();
        const byCode = new Map(defs.map((d) => [d.code, d]));
        for (const [code, v] of Object.entries(values)) {
            const def = byCode.get(code);
            // isCore 的字段已经写进固定列了，EAV 里不再存一份（会不一致）
            if (!def || def.isCore)
                continue;
            const data = {
                profileId,
                fieldCode: code,
                valueText: null,
                valueNum: null,
                valueDate: null,
                valueJson: client_1.Prisma.DbNull,
            };
            if (v === null) {
                // 保留空行，表示"用户主动清空了"，与"从没填过"区分
            }
            else if (def.type === shared_1.FieldType.NUMBER) {
                data.valueNum = Number(v);
            }
            else if (def.type === shared_1.FieldType.DATE) {
                data.valueDate = new Date(v);
            }
            else if (def.type === shared_1.FieldType.MULTI_SELECT ||
                def.type === shared_1.FieldType.IMAGES ||
                def.type === shared_1.FieldType.RANGE) {
                data.valueJson = v;
            }
            else if (def.type === shared_1.FieldType.BOOLEAN) {
                data.valueNum = v ? 1 : 0;
            }
            else {
                data.valueText = String(v);
            }
            await tx.profileFieldValue.upsert({
                where: { profileId_fieldCode: { profileId, fieldCode: code } },
                create: data,
                update: {
                    valueText: data.valueText,
                    valueNum: data.valueNum,
                    valueDate: data.valueDate,
                    valueJson: data.valueJson ?? client_1.Prisma.DbNull,
                },
            });
        }
    }
    // ═══════ 审核状态机 ═══════
    /**
     * 状态流转的**唯一**入口。所有改 status 的地方都要走这里，
     * 因为这里做了三件事：校验合法流转、写审计日志、维护驳回理由。
     */
    async transition(profileId, target, opts) {
        const profile = await this.prisma.profile.findFirst({
            where: { id: profileId, deletedAt: null },
            select: { id: true, status: true },
        });
        if (!profile)
            throw new common_1.NotFoundException('档案不存在');
        const from = profile.status;
        // 非法流转直接抛错，不会静默写库
        (0, shared_1.assertTransition)(shared_1.PROFILE_STATUS_TRANSITIONS, from, target, '档案状态');
        if (target === shared_1.ProfileStatus.REJECTED && !opts.reason?.trim()) {
            throw new all_exceptions_filter_1.BizException('驳回必须填写理由，否则用户不知道要改什么', 40031);
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.profile.update({
                where: { id: profileId },
                data: {
                    status: target,
                    rejectReason: target === shared_1.ProfileStatus.REJECTED ? (opts.reason ?? null) : null,
                },
            });
            await tx.profileAuditLog.create({
                data: {
                    profileId,
                    fromStatus: from,
                    toStatus: target,
                    reason: opts.reason ?? null,
                    rejectedFields: (opts.rejectedFields ?? undefined),
                    operatorId: opts.operator.id,
                    operatorName: opts.operator.name,
                },
            });
        });
        this.logger.log(`档案 ${profileId} ${from} → ${target} by ${opts.operator.name}`);
    }
    /** 提交审核 */
    async submit(profileId, operator) {
        const profile = await this.prisma.profile.findFirst({
            where: { id: profileId, deletedAt: null },
            include: { photos: true },
        });
        if (!profile)
            throw new common_1.NotFoundException('档案不存在');
        // 提审前做完整性检查，别让审核员收到一堆残缺资料
        const missing = [];
        if (!profile.realName?.trim())
            missing.push('真实姓名');
        if (!profile.cityCode)
            missing.push('所在城市');
        if (!profile.education)
            missing.push('学历');
        if (!profile.phone?.trim())
            missing.push('手机号');
        if (!profile.photos.length)
            missing.push('至少一张照片');
        if (missing.length) {
            throw new all_exceptions_filter_1.BizException(`资料不完整，请先补充：${missing.join('、')}`, 40032);
        }
        await this.transition(profileId, shared_1.ProfileStatus.PENDING, { operator, reason: '提交审核' });
    }
    /** 后台审核 */
    async audit(profileId, dto, operator) {
        await this.transition(profileId, dto.targetStatus, {
            operator,
            reason: dto.reason,
            rejectedFields: dto.rejectedFields,
        });
    }
    async getAuditLogs(profileId) {
        const logs = await this.prisma.profileAuditLog.findMany({
            where: { profileId },
            orderBy: { createdAt: 'desc' },
        });
        return logs.map((l) => ({
            id: l.id,
            fromStatus: l.fromStatus,
            toStatus: l.toStatus,
            reason: l.reason,
            operatorId: l.operatorId ?? '',
            operatorName: l.operatorName ?? '系统',
            createdAt: l.createdAt.toISOString(),
        }));
    }
    // ═══════ 照片 ═══════
    async addPhoto(profileId, file, isPrimary = false) {
        const count = await this.prisma.profilePhoto.count({ where: { profileId } });
        if (count >= 9)
            throw new all_exceptions_filter_1.BizException('最多上传 9 张照片', 40033);
        const stored = await this.storage.savePhoto(file.buffer, file.originalname, file.mimetype);
        return this.prisma.$transaction(async (tx) => {
            if (isPrimary || count === 0) {
                await tx.profilePhoto.updateMany({ where: { profileId }, data: { isPrimary: false } });
            }
            return tx.profilePhoto.create({
                data: {
                    profileId,
                    url: stored.path,
                    maskedUrl: stored.maskedPath,
                    width: stored.width,
                    height: stored.height,
                    sizeBytes: stored.size,
                    isPrimary: isPrimary || count === 0,
                    sort: count,
                },
            });
        });
    }
    async auditPhoto(photoId, dto) {
        if (dto.status === 'REJECTED' && !dto.reason?.trim()) {
            throw new all_exceptions_filter_1.BizException('驳回照片必须填写理由', 40034);
        }
        return this.prisma.profilePhoto.update({
            where: { id: photoId },
            data: { auditStatus: dto.status, rejectReason: dto.reason ?? null },
        });
    }
    async deletePhoto(photoId, requesterProfileId, isAdmin) {
        const photo = await this.prisma.profilePhoto.findUnique({ where: { id: photoId } });
        if (!photo)
            throw new common_1.NotFoundException('照片不存在');
        if (!isAdmin && photo.profileId !== requesterProfileId) {
            throw new common_1.ForbiddenException('不能删除他人的照片');
        }
        await this.prisma.profilePhoto.delete({ where: { id: photoId } });
        // 删掉的是主图就把第一张顶上，不然列表页没头像
        if (photo.isPrimary) {
            const next = await this.prisma.profilePhoto.findFirst({
                where: { profileId: photo.profileId },
                orderBy: { sort: 'asc' },
            });
            if (next) {
                await this.prisma.profilePhoto.update({
                    where: { id: next.id },
                    data: { isPrimary: true },
                });
            }
        }
        return { success: true };
    }
    async setPrimaryPhoto(photoId) {
        const photo = await this.prisma.profilePhoto.findUnique({ where: { id: photoId } });
        if (!photo)
            throw new common_1.NotFoundException('照片不存在');
        await this.prisma.$transaction([
            this.prisma.profilePhoto.updateMany({
                where: { profileId: photo.profileId },
                data: { isPrimary: false },
            }),
            this.prisma.profilePhoto.update({ where: { id: photoId }, data: { isPrimary: true } }),
        ]);
        return { success: true };
    }
    // ═══════ 查询 ═══════
    /** 详情。一切对外输出都经过 PrivacyService.project()。 */
    async toDto(profileId, viewer) {
        const profile = await this.prisma.profile.findFirst({
            where: { id: profileId, deletedAt: null },
            include: PROFILE_INCLUDE,
        });
        if (!profile)
            throw new common_1.NotFoundException('档案不存在');
        const ctx = await this.privacy.resolveViewer(profile, viewer);
        // 非本人/非管理员，只能看已通过的资料
        const isPrivileged = ctx.isSelf || ctx.isAdmin || ctx.isMatchmakerOf;
        if (!isPrivileged && profile.status !== 'APPROVED') {
            throw new common_1.NotFoundException('该会员资料不可见');
        }
        return this.privacy.project(profile, ctx);
    }
    /** 详情 + 计入浏览配额（小程序端用；后台看不扣次数） */
    async viewDetail(profileId, viewer) {
        const dto = await this.toDto(profileId, viewer);
        const isSelf = dto.viewerLevel >= shared_1.VisibilityLevel.ADMIN;
        if (!isSelf) {
            // 免费用户也允许看，只是没配额时不扣——扣不动就静默放过，
            // 不能因为"每日查看次数"把整个详情页拦死，那样新用户第一天就流失了。
            await this.privacy
                .recordView(viewer.userId, profileId, { consumeQuota: viewer.isVip })
                .catch((e) => this.logger.debug(`记录浏览失败：${e.message}`));
        }
        return dto;
    }
    /** 后台/红娘列表 */
    async list(query, viewer) {
        const where = { deletedAt: null };
        const isAdmin = viewer.roles.includes(shared_1.RoleCode.SUPER_ADMIN) ||
            viewer.roles.includes(shared_1.RoleCode.ADMIN) ||
            viewer.roles.includes(shared_1.RoleCode.AUDITOR);
        // 红娘只能看自己名下的会员 + 所有已通过的（用于牵线选人）
        if (!isAdmin) {
            if (!viewer.matchmakerId)
                throw new common_1.ForbiddenException('无权查看会员列表');
            where.OR = [{ matchmakerId: viewer.matchmakerId }, { status: 'APPROVED' }];
        }
        if (query.status)
            where.status = query.status;
        if (query.gender)
            where.gender = query.gender;
        if (query.cityCode)
            where.cityCode = query.cityCode;
        if (query.source)
            where.source = query.source;
        if (query.matchmakerId)
            where.matchmakerId = query.matchmakerId;
        if (query.hasPendingPhoto)
            where.photos = { some: { auditStatus: 'PENDING' } };
        if (query.ageMin != null || query.ageMax != null) {
            const r = (0, shared_1.ageRangeToBirthdayRange)(query.ageMin, query.ageMax);
            where.birthday = { ...(r.gte ? { gte: r.gte } : {}), ...(r.lte ? { lte: r.lte } : {}) };
        }
        if (query.keyword?.trim()) {
            const kw = query.keyword.trim();
            where.AND = [
                {
                    OR: [
                        { serialNo: { contains: kw } },
                        { realName: { contains: kw } },
                        { nickname: { contains: kw } },
                        { phone: { contains: kw } },
                    ],
                },
            ];
        }
        const orderBy = query.sortBy
            ? { [query.sortBy]: query.sortOrder }
            : { createdAt: 'desc' };
        const [rows, total] = await Promise.all([
            this.prisma.profile.findMany({
                where,
                orderBy,
                skip: query.skip,
                take: query.take,
                include: { photos: true },
            }),
            this.prisma.profile.count({ where }),
        ]);
        // 后台列表按管理员等级投影（红娘看自己名下的也给完整信息）
        const level = isAdmin ? shared_1.VisibilityLevel.ADMIN : shared_1.VisibilityLevel.MATCHMAKER;
        return (0, pagination_dto_1.buildPageResult)(rows.map((r) => this.privacy.projectBrief(r, level)), total, query.page, query.pageSize);
    }
    /** C 端广场：只有已通过的，且一律按访客等级脱敏 */
    async listPublic(query, viewer) {
        const where = { deletedAt: null, status: 'APPROVED' };
        if (query.gender)
            where.gender = query.gender;
        if (query.cityCode)
            where.cityCode = query.cityCode;
        if (query.ageMin != null || query.ageMax != null) {
            const r = (0, shared_1.ageRangeToBirthdayRange)(query.ageMin, query.ageMax);
            where.birthday = { ...(r.gte ? { gte: r.gte } : {}), ...(r.lte ? { lte: r.lte } : {}) };
        }
        const [rows, total] = await Promise.all([
            this.prisma.profile.findMany({
                where,
                // 置顶的排前面（VIP 权益），其次按活跃时间
                orderBy: [{ isTop: 'desc' }, { lastActiveAt: 'desc' }, { createdAt: 'desc' }],
                skip: query.skip,
                take: query.take,
                include: { photos: true },
            }),
            this.prisma.profile.count({ where }),
        ]);
        const level = !viewer
            ? shared_1.VisibilityLevel.PUBLIC
            : viewer.isVip
                ? shared_1.VisibilityLevel.VIP
                : shared_1.VisibilityLevel.MEMBER;
        return (0, pagination_dto_1.buildPageResult)(rows.map((r) => this.privacy.projectBrief(r, level)), total, query.page, query.pageSize);
    }
    async findRawById(id) {
        return this.prisma.profile.findFirst({
            where: { id, deletedAt: null },
            include: PROFILE_INCLUDE,
        });
    }
    async getMyProfileId(userId) {
        const p = await this.prisma.profile.findFirst({
            where: { userId, deletedAt: null },
            select: { id: true },
        });
        return p?.id ?? null;
    }
    /** 软删除 */
    async remove(profileId) {
        await this.prisma.profile.update({
            where: { id: profileId },
            data: { deletedAt: new Date(), status: 'OFFLINE' },
        });
        return { success: true };
    }
    /** 后台调整归属红娘 */
    async assignMatchmaker(profileId, matchmakerId) {
        if (matchmakerId) {
            const mm = await this.prisma.matchmaker.findFirst({
                where: { id: matchmakerId, deletedAt: null },
                select: { id: true },
            });
            if (!mm)
                throw new common_1.NotFoundException('红娘不存在');
        }
        await this.prisma.profile.update({ where: { id: profileId }, data: { matchmakerId } });
        return { success: true };
    }
};
exports.ProfileService = ProfileService;
exports.ProfileService = ProfileService = ProfileService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        field_service_1.FieldService,
        privacy_service_1.PrivacyService,
        storage_service_1.StorageService])
], ProfileService);
//# sourceMappingURL=profile.service.js.map