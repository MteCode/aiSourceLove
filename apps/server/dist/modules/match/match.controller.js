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
exports.MatchController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const shared_1 = require("@yuanqiao/shared");
const decorators_1 = require("../../common/decorators");
const match_dto_1 = require("./dto/match.dto");
const match_service_1 = require("./match.service");
let MatchController = class MatchController {
    match;
    constructor(match) {
        this.match = match;
    }
    run(query, user) {
        return this.match.run(query, user);
    }
    scorePair(dto) {
        return this.match.scorePair(dto.aProfileId, dto.bProfileId);
    }
    weights() {
        return Object.entries(shared_1.DEFAULT_MATCH_WEIGHTS).map(([key, value]) => ({
            key,
            label: shared_1.MATCH_WEIGHT_LABEL[key],
            value,
        }));
    }
    preview(dto, user) {
        return this.match.run(dto, user);
    }
};
exports.MatchController = MatchController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: '三层匹配推荐',
        description: 'L1 SQL 硬过滤 → L2 双向加权打分 → L3 AI 语义匹配（enableAi=true 时开启，消耗权益）',
    }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [match_dto_1.MatchQueryDto, Object]),
    __metadata("design:returntype", Promise)
], MatchController.prototype, "run", null);
__decorate([
    (0, common_1.Post)('score-pair'),
    (0, swagger_1.ApiOperation)({ summary: '给指定两人打分（红娘牵线前看契合度）' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [match_dto_1.ScorePairDto]),
    __metadata("design:returntype", void 0)
], MatchController.prototype, "scorePair", null);
__decorate([
    (0, common_1.Get)('weights'),
    (0, swagger_1.ApiOperation)({ summary: '获取默认权重配置（后台调参页展示）' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MatchController.prototype, "weights", null);
__decorate([
    (0, common_1.Post)('preview'),
    (0, decorators_1.LogAction)('匹配引擎', '权重调参预览'),
    (0, swagger_1.ApiOperation)({ summary: '用自定义权重预览匹配结果（后台调参）' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [match_dto_1.MatchQueryDto, Object]),
    __metadata("design:returntype", void 0)
], MatchController.prototype, "preview", null);
exports.MatchController = MatchController = __decorate([
    (0, swagger_1.ApiTags)('匹配引擎'),
    (0, common_1.Controller)('match'),
    __metadata("design:paramtypes", [match_service_1.MatchService])
], MatchController);
//# sourceMappingURL=match.controller.js.map