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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminProfileController = exports.ProfileController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const shared_1 = require("@yuanqiao/shared");
const decorators_1 = require("../../common/decorators");
const auth_user_1 = require("../../common/types/auth-user");
const matchmaker_service_1 = require("../matchmaker/matchmaker.service");
const privacy_service_1 = require("../privacy/privacy.service");
const profile_service_1 = require("./profile.service");
const profile_dto_1 = require("./dto/profile.dto");
let ProfileController = class ProfileController {
    profile;
    privacy;
    matchmaker;
    constructor(profile, privacy, matchmaker) {
        this.profile = profile;
        this.privacy = privacy;
        this.matchmaker = matchmaker;
    }
    // ───────── 我的档案 ─────────
    async me(user) {
        if (!user.profileId)
            return null;
        return this.profile.toDto(user.profileId, user);
    }
    upsertMe(userId, dto) {
        return this.profile.upsertSelf(userId, dto);
    }
    async submitMe(user) {
        if (!user.profileId)
            throw new common_1.BadRequestException('请先填写档案');
        await this.profile.submit(user.profileId, {
            id: user.userId,
            name: user.nickname ?? user.phone,
        });
        return this.profile.toDto(user.profileId, user);
    }
    claim(userId, dto) {
        return this.profile.claim(userId, dto.serialNo);
    }
    async myAuditLogs(user) {
        if (!user.profileId)
            return [];
        return this.profile.getAuditLogs(user.profileId);
    }
    async visitors(user) {
        if (!user.profileId)
            return [];
        if (!user.isVip) {
            throw new common_1.ForbiddenException('「谁看过我」是 VIP 专属功能');
        }
        return this.privacy.listVisitors(user.profileId);
    }
    // ───────── 广场 / 详情 ─────────
    square(query, user) {
        return this.profile.listPublic(query, user);
    }
    detail(id, user) {
        return this.profile.viewDetail(id, user);
    }
    unlock(id, userId) {
        return this.privacy.unlockContact(userId, id);
    }
    // ───────── 照片 ─────────
    async uploadPhoto(user, file, primary) {
        if (!file)
            throw new common_1.BadRequestException('请选择要上传的文件');
        if (!user.profileId)
            throw new common_1.BadRequestException('请先填写档案');
        return this.profile.addPhoto(user.profileId, file, primary === 'true');
    }
    deletePhoto(photoId, user) {
        return this.profile.deletePhoto(photoId, user.profileId, (0, auth_user_1.isAdminUser)(user));
    }
    setPrimary(photoId) {
        return this.profile.setPrimaryPhoto(photoId);
    }
    auditPhoto(photoId, dto) {
        return this.profile.auditPhoto(photoId, dto);
    }
};
exports.ProfileController = ProfileController;
__decorate([
    (0, common_1.Get)('me'),
    (0, swagger_1.ApiOperation)({ summary: '我的档案' }),
    __param(0, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProfileController.prototype, "me", null);
__decorate([
    (0, common_1.Put)('me'),
    (0, decorators_1.LogAction)('会员档案', '填写/修改自己的档案'),
    (0, swagger_1.ApiOperation)({ summary: '创建或更新我的档案（改关键字段会自动重新送审）' }),
    __param(0, (0, decorators_1.CurrentUser)('userId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, profile_dto_1.UpsertProfileDto]),
    __metadata("design:returntype", void 0)
], ProfileController.prototype, "upsertMe", null);
__decorate([
    (0, common_1.Post)('me/submit'),
    (0, decorators_1.LogAction)('会员档案', '提交审核'),
    (0, swagger_1.ApiOperation)({ summary: '提交审核' }),
    __param(0, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProfileController.prototype, "submitMe", null);
__decorate([
    (0, common_1.Post)('me/claim'),
    (0, decorators_1.LogAction)('会员档案', '认领档案'),
    (0, swagger_1.ApiOperation)({ summary: '用编号认领红娘代录的档案' }),
    __param(0, (0, decorators_1.CurrentUser)('userId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, profile_dto_1.ClaimProfileDto]),
    __metadata("design:returntype", void 0)
], ProfileController.prototype, "claim", null);
__decorate([
    (0, common_1.Get)('me/audit-logs'),
    (0, swagger_1.ApiOperation)({ summary: '我的审核记录（看驳回理由）' }),
    __param(0, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProfileController.prototype, "myAuditLogs", null);
__decorate([
    (0, common_1.Get)('me/visitors'),
    (0, swagger_1.ApiOperation)({ summary: '谁看过我' }),
    __param(0, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProfileController.prototype, "visitors", null);
__decorate([
    (0, decorators_1.OptionalAuth)(),
    (0, common_1.Get)('square'),
    (0, swagger_1.ApiOperation)({ summary: '会员广场（游客可见，按等级脱敏）' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [profile_dto_1.QueryProfileDto, Object]),
    __metadata("design:returntype", void 0)
], ProfileController.prototype, "square", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: '档案详情（会计入每日查看配额）' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ProfileController.prototype, "detail", null);
__decorate([
    (0, common_1.Post)(':id/unlock-contact'),
    (0, decorators_1.LogAction)('隐私', '解锁联系方式'),
    (0, swagger_1.ApiOperation)({ summary: '消耗权益解锁对方联系方式（幂等，重复点不重复扣）' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, decorators_1.CurrentUser)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ProfileController.prototype, "unlock", null);
__decorate([
    (0, common_1.Post)('me/photos'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, decorators_1.LogAction)('会员档案', '上传照片'),
    (0, swagger_1.ApiOperation)({ summary: '上传照片（服务端同步生成打码图）' }),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Query)('primary')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ProfileController.prototype, "uploadPhoto", null);
__decorate([
    (0, common_1.Delete)('photos/:photoId'),
    (0, decorators_1.LogAction)('会员档案', '删除照片'),
    (0, swagger_1.ApiOperation)({ summary: '删除照片' }),
    __param(0, (0, common_1.Param)('photoId')),
    __param(1, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ProfileController.prototype, "deletePhoto", null);
__decorate([
    (0, common_1.Put)('photos/:photoId/primary'),
    (0, swagger_1.ApiOperation)({ summary: '设为主图' }),
    __param(0, (0, common_1.Param)('photoId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProfileController.prototype, "setPrimary", null);
__decorate([
    (0, common_1.Put)('photos/:photoId/audit'),
    (0, decorators_1.RequirePermissions)('profile:audit'),
    (0, decorators_1.LogAction)('审核', '审核照片'),
    (0, swagger_1.ApiOperation)({ summary: '审核照片' }),
    __param(0, (0, common_1.Param)('photoId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, profile_dto_1.AuditPhotoDto]),
    __metadata("design:returntype", void 0)
], ProfileController.prototype, "auditPhoto", null);
exports.ProfileController = ProfileController = __decorate([
    (0, swagger_1.ApiTags)('会员档案'),
    (0, common_1.Controller)('profiles'),
    __metadata("design:paramtypes", [profile_service_1.ProfileService,
        privacy_service_1.PrivacyService,
        matchmaker_service_1.MatchmakerService])
], ProfileController);
let AdminProfileController = class AdminProfileController {
    profile;
    matchmaker;
    constructor(profile, matchmaker) {
        this.profile = profile;
        this.matchmaker = matchmaker;
    }
    list(query, user) {
        return this.profile.list(query, user);
    }
    async pendingCount(user) {
        const [profiles, photos] = await Promise.all([
            this.profile.list(Object.assign(new profile_dto_1.QueryProfileDto(), { status: shared_1.ProfileStatus.PENDING, page: 1, pageSize: 1 }), user),
            this.profile.list(Object.assign(new profile_dto_1.QueryProfileDto(), { hasPendingPhoto: true, page: 1, pageSize: 1 }), user),
        ]);
        return { profilePending: profiles.total, photoPending: photos.total };
    }
    detail(id, user) {
        return this.profile.toDto(id, user);
    }
    auditLogs(id) {
        return this.profile.getAuditLogs(id);
    }
    async createByMatchmaker(user, dto) {
        const mmId = await this.matchmaker.requireMatchmakerId(user.userId);
        return this.profile.createByMatchmaker(mmId, dto, {
            id: user.userId,
            name: user.nickname ?? user.phone,
        });
    }
    async audit(id, dto, user) {
        await this.profile.audit(id, dto, { id: user.userId, name: user.nickname ?? user.phone });
        return this.profile.toDto(id, user);
    }
    assign(id, matchmakerId) {
        return this.profile.assignMatchmaker(id, matchmakerId);
    }
    remove(id) {
        return this.profile.remove(id);
    }
};
exports.AdminProfileController = AdminProfileController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: '会员列表（管理员看全部 / 红娘看名下+已通过）' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [profile_dto_1.QueryProfileDto, Object]),
    __metadata("design:returntype", void 0)
], AdminProfileController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('pending-count'),
    (0, decorators_1.RequirePermissions)('profile:audit'),
    (0, swagger_1.ApiOperation)({ summary: '待审数量（后台角标）' }),
    __param(0, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminProfileController.prototype, "pendingCount", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: '档案详情（后台，不扣查看配额）' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AdminProfileController.prototype, "detail", null);
__decorate([
    (0, common_1.Get)(':id/audit-logs'),
    (0, swagger_1.ApiOperation)({ summary: '审核流水' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminProfileController.prototype, "auditLogs", null);
__decorate([
    (0, common_1.Post)('by-matchmaker'),
    (0, decorators_1.RequireRoles)(shared_1.RoleCode.MATCHMAKER),
    (0, decorators_1.LogAction)('会员档案', '红娘代录'),
    (0, swagger_1.ApiOperation)({
        summary: '红娘代录档案',
        description: '线下地推收上来的资料先录进系统，本人之后用编号认领。不需要对方已注册。',
    }),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, profile_dto_1.MatchmakerCreateProfileDto]),
    __metadata("design:returntype", Promise)
], AdminProfileController.prototype, "createByMatchmaker", null);
__decorate([
    (0, common_1.Put)(':id/audit'),
    (0, decorators_1.RequirePermissions)('profile:audit'),
    (0, decorators_1.LogAction)('审核', '审核档案'),
    (0, swagger_1.ApiOperation)({ summary: '审核档案（走状态机校验，驳回必须填理由）' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, profile_dto_1.AuditProfileDto, Object]),
    __metadata("design:returntype", Promise)
], AdminProfileController.prototype, "audit", null);
__decorate([
    (0, common_1.Put)(':id/matchmaker'),
    (0, decorators_1.RequirePermissions)('profile:edit'),
    (0, decorators_1.LogAction)('会员档案', '调整归属红娘'),
    (0, swagger_1.ApiOperation)({ summary: '调整归属红娘' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('matchmakerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AdminProfileController.prototype, "assign", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, decorators_1.RequirePermissions)('profile:delete'),
    (0, decorators_1.LogAction)('会员档案', '删除档案'),
    (0, swagger_1.ApiOperation)({ summary: '删除档案（软删）' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminProfileController.prototype, "remove", null);
exports.AdminProfileController = AdminProfileController = __decorate([
    (0, swagger_1.ApiTags)('会员档案 / 后台与红娘'),
    (0, common_1.Controller)('admin/profiles'),
    __metadata("design:paramtypes", [profile_service_1.ProfileService,
        matchmaker_service_1.MatchmakerService])
], AdminProfileController);
//# sourceMappingURL=profile.controller.js.map