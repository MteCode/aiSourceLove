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
exports.CommissionController = exports.IntroductionController = exports.MatchmakerController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const shared_1 = require("@yuanqiao/shared");
const decorators_1 = require("../../common/decorators");
const pagination_dto_1 = require("../../common/dto/pagination.dto");
const commission_service_1 = require("./commission.service");
const introduction_service_1 = require("./introduction.service");
const matchmaker_service_1 = require("./matchmaker.service");
const matchmaker_dto_1 = require("./dto/matchmaker.dto");
let MatchmakerController = class MatchmakerController {
    matchmaker;
    introduction;
    commission;
    constructor(matchmaker, introduction, commission) {
        this.matchmaker = matchmaker;
        this.introduction = introduction;
        this.commission = commission;
    }
    // ───────── 入驻 ─────────
    apply(userId, dto) {
        return this.matchmaker.apply(userId, dto);
    }
    async me(userId) {
        const mm = await this.matchmaker.findByUserId(userId);
        return mm ? this.matchmaker.toDto(mm.id) : null;
    }
    async myStats(userId) {
        const id = await this.matchmaker.requireMatchmakerId(userId);
        return this.matchmaker.stats(id);
    }
    async myMembers(userId, page) {
        const id = await this.matchmaker.requireMatchmakerId(userId);
        return this.matchmaker.members(id, page.page, page.pageSize);
    }
    // ───────── 后台管理 ─────────
    list(query) {
        return this.matchmaker.list(query);
    }
    detail(id) {
        return this.matchmaker.toDto(id);
    }
    stats(id) {
        return this.matchmaker.stats(id);
    }
    review(id, dto) {
        return this.matchmaker.review(id, dto);
    }
};
exports.MatchmakerController = MatchmakerController;
__decorate([
    (0, common_1.Post)('apply'),
    (0, decorators_1.LogAction)('红娘', '提交入驻申请'),
    (0, swagger_1.ApiOperation)({ summary: '申请成为红娘' }),
    __param(0, (0, decorators_1.CurrentUser)('userId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, matchmaker_dto_1.ApplyMatchmakerDto]),
    __metadata("design:returntype", void 0)
], MatchmakerController.prototype, "apply", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, swagger_1.ApiOperation)({ summary: '我的红娘信息' }),
    __param(0, (0, decorators_1.CurrentUser)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MatchmakerController.prototype, "me", null);
__decorate([
    (0, common_1.Get)('me/stats'),
    (0, decorators_1.RequireRoles)(shared_1.RoleCode.MATCHMAKER),
    (0, swagger_1.ApiOperation)({ summary: '我的业绩看板（含牵线漏斗）' }),
    __param(0, (0, decorators_1.CurrentUser)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MatchmakerController.prototype, "myStats", null);
__decorate([
    (0, common_1.Get)('me/members'),
    (0, decorators_1.RequireRoles)(shared_1.RoleCode.MATCHMAKER),
    (0, swagger_1.ApiOperation)({ summary: '我名下的会员' }),
    __param(0, (0, decorators_1.CurrentUser)('userId')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, pagination_dto_1.PaginationDto]),
    __metadata("design:returntype", Promise)
], MatchmakerController.prototype, "myMembers", null);
__decorate([
    (0, common_1.Get)(),
    (0, decorators_1.RequirePermissions)('matchmaker:list'),
    (0, swagger_1.ApiOperation)({ summary: '红娘列表' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [matchmaker_dto_1.QueryMatchmakerDto]),
    __metadata("design:returntype", void 0)
], MatchmakerController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, decorators_1.RequirePermissions)('matchmaker:list'),
    (0, swagger_1.ApiOperation)({ summary: '红娘详情' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MatchmakerController.prototype, "detail", null);
__decorate([
    (0, common_1.Get)(':id/stats'),
    (0, decorators_1.RequirePermissions)('matchmaker:list'),
    (0, swagger_1.ApiOperation)({ summary: '红娘业绩' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MatchmakerController.prototype, "stats", null);
__decorate([
    (0, common_1.Put)(':id/review'),
    (0, decorators_1.RequirePermissions)('matchmaker:review'),
    (0, decorators_1.LogAction)('红娘', '审核入驻'),
    (0, swagger_1.ApiOperation)({ summary: '审核红娘入驻 / 调整分润比例' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, matchmaker_dto_1.ReviewMatchmakerDto]),
    __metadata("design:returntype", void 0)
], MatchmakerController.prototype, "review", null);
exports.MatchmakerController = MatchmakerController = __decorate([
    (0, swagger_1.ApiTags)('红娘系统'),
    (0, common_1.Controller)('matchmakers'),
    __metadata("design:paramtypes", [matchmaker_service_1.MatchmakerService,
        introduction_service_1.IntroductionService,
        commission_service_1.CommissionService])
], MatchmakerController);
let IntroductionController = class IntroductionController {
    introduction;
    matchmaker;
    constructor(introduction, matchmaker) {
        this.introduction = introduction;
        this.matchmaker = matchmaker;
    }
    async create(user, dto) {
        const mmId = await this.matchmaker.requireMatchmakerId(user.userId);
        return this.introduction.create(mmId, dto, {
            id: user.userId,
            name: user.nickname ?? user.phone,
        });
    }
    list(query, user) {
        return this.introduction.list(query, user);
    }
    detail(id, user) {
        return this.introduction.toDto(id, user);
    }
    advance(id, dto, user) {
        return this.introduction.advance(id, dto, { id: user.userId, name: user.nickname ?? user.phone }, user);
    }
    agree(id, dto, user) {
        return this.introduction.agree(id, dto, user);
    }
};
exports.IntroductionController = IntroductionController;
__decorate([
    (0, common_1.Post)(),
    (0, decorators_1.RequireRoles)(shared_1.RoleCode.MATCHMAKER),
    (0, decorators_1.LogAction)('牵线', '发起牵线'),
    (0, swagger_1.ApiOperation)({ summary: '发起牵线' }),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, matchmaker_dto_1.CreateIntroductionDto]),
    __metadata("design:returntype", Promise)
], IntroductionController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: '牵线列表（管理员看全部 / 红娘看自己的 / 会员看参与的）' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [matchmaker_dto_1.QueryIntroductionDto, Object]),
    __metadata("design:returntype", void 0)
], IntroductionController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: '牵线详情（含完整事件流水）' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], IntroductionController.prototype, "detail", null);
__decorate([
    (0, common_1.Put)(':id/advance'),
    (0, decorators_1.LogAction)('牵线', '推进状态'),
    (0, swagger_1.ApiOperation)({
        summary: '推进牵线状态',
        description: '走状态机校验。→CONTACT_EXCHANGED 会自动解锁双方联系方式；→SUCCESS 会记红娘分润。',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, matchmaker_dto_1.AdvanceIntroductionDto, Object]),
    __metadata("design:returntype", void 0)
], IntroductionController.prototype, "advance", null);
__decorate([
    (0, common_1.Put)(':id/agree'),
    (0, decorators_1.LogAction)('牵线', '当事人表态'),
    (0, swagger_1.ApiOperation)({ summary: '当事人同意/婉拒（只能本人操作，红娘不能代点）' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, matchmaker_dto_1.AgreeIntroductionDto, Object]),
    __metadata("design:returntype", void 0)
], IntroductionController.prototype, "agree", null);
exports.IntroductionController = IntroductionController = __decorate([
    (0, swagger_1.ApiTags)('红娘系统 / 牵线'),
    (0, common_1.Controller)('introductions'),
    __metadata("design:paramtypes", [introduction_service_1.IntroductionService,
        matchmaker_service_1.MatchmakerService])
], IntroductionController);
let CommissionController = class CommissionController {
    commission;
    matchmaker;
    constructor(commission, matchmaker) {
        this.commission = commission;
        this.matchmaker = matchmaker;
    }
    async mine(userId, query) {
        const id = await this.matchmaker.requireMatchmakerId(userId);
        return this.commission.listCommissions({ ...query, matchmakerId: id });
    }
    list(query) {
        return this.commission.listCommissions(query);
    }
    async withdraw(userId, dto) {
        const id = await this.matchmaker.requireMatchmakerId(userId);
        return this.commission.createWithdrawal(id, dto);
    }
    async listWithdrawals(query, user) {
        // 红娘只能看自己的
        if (user.matchmakerId && !user.permissions.includes('withdrawal:list')) {
            return this.commission.listWithdrawals({
                ...query,
                matchmakerId: user.matchmakerId,
            });
        }
        return this.commission.listWithdrawals(query);
    }
    reviewWithdrawal(id, dto, operatorId) {
        return this.commission.reviewWithdrawal(id, dto, operatorId);
    }
    settle() {
        return this.commission.settleDue();
    }
};
exports.CommissionController = CommissionController;
__decorate([
    (0, common_1.Get)('me'),
    (0, decorators_1.RequireRoles)(shared_1.RoleCode.MATCHMAKER),
    (0, swagger_1.ApiOperation)({ summary: '我的分润记录' }),
    __param(0, (0, decorators_1.CurrentUser)('userId')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, matchmaker_dto_1.QueryCommissionDto]),
    __metadata("design:returntype", Promise)
], CommissionController.prototype, "mine", null);
__decorate([
    (0, common_1.Get)(),
    (0, decorators_1.RequirePermissions)('commission:list'),
    (0, swagger_1.ApiOperation)({ summary: '分润记录（后台）' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [matchmaker_dto_1.QueryCommissionDto]),
    __metadata("design:returntype", void 0)
], CommissionController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('withdrawals'),
    (0, decorators_1.RequireRoles)(shared_1.RoleCode.MATCHMAKER),
    (0, decorators_1.LogAction)('提现', '发起提现'),
    (0, swagger_1.ApiOperation)({ summary: '发起提现' }),
    __param(0, (0, decorators_1.CurrentUser)('userId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, matchmaker_dto_1.CreateWithdrawalDto]),
    __metadata("design:returntype", Promise)
], CommissionController.prototype, "withdraw", null);
__decorate([
    (0, common_1.Get)('withdrawals'),
    (0, swagger_1.ApiOperation)({ summary: '提现单列表' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [matchmaker_dto_1.QueryWithdrawalDto, Object]),
    __metadata("design:returntype", Promise)
], CommissionController.prototype, "listWithdrawals", null);
__decorate([
    (0, common_1.Put)('withdrawals/:id/review'),
    (0, decorators_1.RequirePermissions)('withdrawal:review'),
    (0, decorators_1.LogAction)('提现', '审核提现'),
    (0, swagger_1.ApiOperation)({ summary: '审核提现（拒绝会把钱退回余额）' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentUser)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, matchmaker_dto_1.ReviewWithdrawalDto, String]),
    __metadata("design:returntype", void 0)
], CommissionController.prototype, "reviewWithdrawal", null);
__decorate([
    (0, common_1.Post)('settle'),
    (0, decorators_1.RequirePermissions)('commission:settle'),
    (0, decorators_1.LogAction)('分润', '手动结算'),
    (0, swagger_1.ApiOperation)({ summary: '手动触发结算（把过冷静期的分润转为可提现）' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CommissionController.prototype, "settle", null);
exports.CommissionController = CommissionController = __decorate([
    (0, swagger_1.ApiTags)('红娘系统 / 分润提现'),
    (0, common_1.Controller)('commissions'),
    __metadata("design:paramtypes", [commission_service_1.CommissionService,
        matchmaker_service_1.MatchmakerService])
], CommissionController);
//# sourceMappingURL=matchmaker.controller.js.map