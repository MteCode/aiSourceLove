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
exports.QueryOrderDto = exports.RefundOrderDto = exports.MockPayDto = exports.CreateOrderDto = exports.UpdateVipPackageDto = exports.CreateVipPackageDto = exports.BenefitSpecDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const shared_1 = require("@yuanqiao/shared");
const pagination_dto_1 = require("../../../common/dto/pagination.dto");
class BenefitSpecDto {
    code;
    quota;
    cycle;
}
exports.BenefitSpecDto = BenefitSpecDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: shared_1.BenefitCode }),
    (0, class_validator_1.IsEnum)(shared_1.BenefitCode),
    __metadata("design:type", String)
], BenefitSpecDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '额度：次数或天数', example: 10 }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], BenefitSpecDto.prototype, "quota", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: shared_1.ResetCycle, description: '不传则用该权益的默认周期' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(shared_1.ResetCycle),
    __metadata("design:type", String)
], BenefitSpecDto.prototype, "cycle", void 0);
class CreateVipPackageDto {
    name;
    subtitle;
    price;
    originalPrice;
    durationDays;
    benefits;
    isRecommended;
    sort;
    enabled;
}
exports.CreateVipPackageDto = CreateVipPackageDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '月卡' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], CreateVipPackageDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], CreateVipPackageDto.prototype, "subtitle", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '售价，单位分', example: 9900 }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateVipPackageDto.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '划线原价，单位分' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateVipPackageDto.prototype, "originalPrice", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '有效天数', example: 30 }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateVipPackageDto.prototype, "durationDays", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [BenefitSpecDto], description: '权益清单，全部按次数/天数配' }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => BenefitSpecDto),
    __metadata("design:type", Array)
], CreateVipPackageDto.prototype, "benefits", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateVipPackageDto.prototype, "isRecommended", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateVipPackageDto.prototype, "sort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateVipPackageDto.prototype, "enabled", void 0);
class UpdateVipPackageDto extends (0, swagger_1.PartialType)(CreateVipPackageDto) {
}
exports.UpdateVipPackageDto = UpdateVipPackageDto;
class CreateOrderDto {
    packageId;
    payChannel;
    openid;
}
exports.CreateOrderDto = CreateOrderDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '套餐 id' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "packageId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: shared_1.PayChannel, description: '不传则用系统配置的默认通道' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(shared_1.PayChannel),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "payChannel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '微信小程序支付需要' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "openid", void 0);
class MockPayDto {
    outTradeNo;
    success;
}
exports.MockPayDto = MockPayDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '商户交易号' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], MockPayDto.prototype, "outTradeNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], MockPayDto.prototype, "success", void 0);
class RefundOrderDto {
    amount;
    reason;
}
exports.RefundOrderDto = RefundOrderDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '退款金额（分），不传则全额退' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], RefundOrderDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '退款原因' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], RefundOrderDto.prototype, "reason", void 0);
class QueryOrderDto extends pagination_dto_1.PaginationDto {
    status;
    keyword;
    userId;
    matchmakerId;
}
exports.QueryOrderDto = QueryOrderDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: shared_1.OrderStatus }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(shared_1.OrderStatus),
    __metadata("design:type", String)
], QueryOrderDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '订单号/手机号 模糊搜索' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QueryOrderDto.prototype, "keyword", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QueryOrderDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QueryOrderDto.prototype, "matchmakerId", void 0);
//# sourceMappingURL=vip.dto.js.map