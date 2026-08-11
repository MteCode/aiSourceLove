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
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryWithdrawalDto = exports.ReviewWithdrawalDto = exports.CreateWithdrawalDto = exports.QueryCommissionDto = exports.QueryIntroductionDto = exports.AgreeIntroductionDto = exports.AdvanceIntroductionDto = exports.CreateIntroductionDto = exports.QueryMatchmakerDto = exports.ReviewMatchmakerDto = exports.ApplyMatchmakerDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const shared_1 = require("@yuanqiao/shared");
const pagination_dto_1 = require("../../../common/dto/pagination.dto");
class ApplyMatchmakerDto {
    name;
    phone;
    cityCode;
    cityName;
    bio;
    certImages;
}
exports.ApplyMatchmakerDto = ApplyMatchmakerDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '王红娘' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], ApplyMatchmakerDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '13800138000' }),
    (0, class_validator_1.Matches)(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' }),
    __metadata("design:type", String)
], ApplyMatchmakerDto.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(12),
    __metadata("design:type", String)
], ApplyMatchmakerDto.prototype, "cityCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], ApplyMatchmakerDto.prototype, "cityName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '个人简介' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], ApplyMatchmakerDto.prototype, "bio", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String], description: '入驻材料图片地址' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], ApplyMatchmakerDto.prototype, "certImages", void 0);
class ReviewMatchmakerDto {
    status;
    commissionRate;
    remark;
}
exports.ReviewMatchmakerDto = ReviewMatchmakerDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: shared_1.MatchmakerStatus }),
    (0, class_validator_1.IsEnum)(shared_1.MatchmakerStatus),
    __metadata("design:type", String)
], ReviewMatchmakerDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '分润比例 0~1', example: 0.2 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(1),
    __metadata("design:type", Number)
], ReviewMatchmakerDto.prototype, "commissionRate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], ReviewMatchmakerDto.prototype, "remark", void 0);
class QueryMatchmakerDto extends pagination_dto_1.PaginationDto {
    keyword;
    status;
    cityCode;
}
exports.QueryMatchmakerDto = QueryMatchmakerDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QueryMatchmakerDto.prototype, "keyword", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: shared_1.MatchmakerStatus }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(shared_1.MatchmakerStatus),
    __metadata("design:type", String)
], QueryMatchmakerDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QueryMatchmakerDto.prototype, "cityCode", void 0);
// ───────── 牵线 ─────────
class CreateIntroductionDto {
    aProfileId;
    bProfileId;
    remark;
}
exports.CreateIntroductionDto = CreateIntroductionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'A 方档案 id' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateIntroductionDto.prototype, "aProfileId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'B 方档案 id' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateIntroductionDto.prototype, "bProfileId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '给双方的推荐语' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], CreateIntroductionDto.prototype, "remark", void 0);
class AdvanceIntroductionDto {
    targetStatus;
    note;
}
exports.AdvanceIntroductionDto = AdvanceIntroductionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: shared_1.IntroductionStatus, description: '目标状态，会做状态机校验' }),
    (0, class_validator_1.IsEnum)(shared_1.IntroductionStatus),
    __metadata("design:type", String)
], AdvanceIntroductionDto.prototype, "targetStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '备注/结果反馈' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], AdvanceIntroductionDto.prototype, "note", void 0);
class AgreeIntroductionDto {
    agree;
    note;
}
exports.AgreeIntroductionDto = AgreeIntroductionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '同意还是拒绝' }),
    (0, class_transformer_1.Transform)(({ value }) => value === true || value === 'true'),
    __metadata("design:type", Boolean)
], AgreeIntroductionDto.prototype, "agree", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], AgreeIntroductionDto.prototype, "note", void 0);
class QueryIntroductionDto extends pagination_dto_1.PaginationDto {
    status;
    matchmakerId;
    profileId;
    keyword;
}
exports.QueryIntroductionDto = QueryIntroductionDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: shared_1.IntroductionStatus }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(shared_1.IntroductionStatus),
    __metadata("design:type", String)
], QueryIntroductionDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QueryIntroductionDto.prototype, "matchmakerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '涉及某个会员的所有牵线' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QueryIntroductionDto.prototype, "profileId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QueryIntroductionDto.prototype, "keyword", void 0);
// ───────── 分润 / 提现 ─────────
class QueryCommissionDto extends pagination_dto_1.PaginationDto {
    status;
    matchmakerId;
}
exports.QueryCommissionDto = QueryCommissionDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: shared_1.CommissionStatus }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(shared_1.CommissionStatus),
    __metadata("design:type", String)
], QueryCommissionDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QueryCommissionDto.prototype, "matchmakerId", void 0);
class CreateWithdrawalDto {
    amount;
    method;
    account;
    realName;
}
exports.CreateWithdrawalDto = CreateWithdrawalDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '提现金额，单位分', example: 20000 }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateWithdrawalDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['WECHAT', 'ALIPAY', 'BANK'], default: 'WECHAT' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateWithdrawalDto.prototype, "method", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '收款账号' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], CreateWithdrawalDto.prototype, "account", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '收款人真实姓名' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], CreateWithdrawalDto.prototype, "realName", void 0);
class ReviewWithdrawalDto {
    status;
    rejectReason;
    remark;
}
exports.ReviewWithdrawalDto = ReviewWithdrawalDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: shared_1.WithdrawalStatus }),
    (0, class_validator_1.IsEnum)(shared_1.WithdrawalStatus),
    __metadata("design:type", String)
], ReviewWithdrawalDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '拒绝理由' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], ReviewWithdrawalDto.prototype, "rejectReason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], ReviewWithdrawalDto.prototype, "remark", void 0);
class QueryWithdrawalDto extends pagination_dto_1.PaginationDto {
    status;
    matchmakerId;
}
exports.QueryWithdrawalDto = QueryWithdrawalDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: shared_1.WithdrawalStatus }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(shared_1.WithdrawalStatus),
    __metadata("design:type", String)
], QueryWithdrawalDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QueryWithdrawalDto.prototype, "matchmakerId", void 0);
//# sourceMappingURL=matchmaker.dto.js.map