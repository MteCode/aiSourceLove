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
exports.ScorePairDto = exports.MatchQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const pagination_dto_1 = require("../../../common/dto/pagination.dto");
class MatchQueryDto extends pagination_dto_1.PaginationDto {
    profileId;
    enableAi;
    weights;
    cityCode;
    minScore;
}
exports.MatchQueryDto = MatchQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '给谁匹配。红娘可传名下任意会员；普通用户只能传自己' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: '请指定要匹配的档案' }),
    __metadata("design:type", String)
], MatchQueryDto.prototype, "profileId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '是否启用 AI 层（会消耗 AI_MATCH 权益）', default: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => value === true || value === 'true'),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], MatchQueryDto.prototype, "enableAi", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '临时覆盖权重，后台调参用', example: { mutualPreference: 0.5 } }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], MatchQueryDto.prototype, "weights", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '只看某城市' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MatchQueryDto.prototype, "cityCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '最低分过滤', minimum: 0, maximum: 100 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (value === '' || value == null ? undefined : Number(value))),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], MatchQueryDto.prototype, "minScore", void 0);
class ScorePairDto {
    aProfileId;
    bProfileId;
}
exports.ScorePairDto = ScorePairDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ScorePairDto.prototype, "aProfileId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ScorePairDto.prototype, "bProfileId", void 0);
//# sourceMappingURL=match.dto.js.map