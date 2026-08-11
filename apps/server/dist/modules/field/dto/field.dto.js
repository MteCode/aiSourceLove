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
exports.UpdateFieldDefDto = exports.CreateFieldDefDto = exports.UpdateFieldGroupDto = exports.CreateFieldGroupDto = exports.FieldOptionDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const shared_1 = require("@yuanqiao/shared");
class FieldOptionDto {
    value;
    label;
    score;
}
exports.FieldOptionDto = FieldOptionDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], FieldOptionDto.prototype, "value", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], FieldOptionDto.prototype, "label", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '用于打分的数值映射，如收入档位' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], FieldOptionDto.prototype, "score", void 0);
class CreateFieldGroupDto {
    code;
    name;
    sort;
    enabled;
}
exports.CreateFieldGroupDto = CreateFieldGroupDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'basic' }),
    (0, class_validator_1.Matches)(/^[a-z][a-z0-9_]{1,29}$/, { message: 'code 只能用小写字母数字下划线，字母开头' }),
    __metadata("design:type", String)
], CreateFieldGroupDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '基本信息' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateFieldGroupDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateFieldGroupDto.prototype, "sort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateFieldGroupDto.prototype, "enabled", void 0);
class UpdateFieldGroupDto extends (0, swagger_1.PartialType)(CreateFieldGroupDto) {
}
exports.UpdateFieldGroupDto = UpdateFieldGroupDto;
class CreateFieldDefDto {
    code;
    label;
    type;
    groupId;
    options;
    placeholder;
    helpText;
    required;
    visibility;
    isCore;
    isPreference;
    weightKey;
    minValue;
    maxValue;
    maxLength;
    regex;
    sort;
    enabled;
}
exports.CreateFieldDefDto = CreateFieldDefDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'hobby' }),
    (0, class_validator_1.Matches)(/^[a-zA-Z][a-zA-Z0-9_]{1,49}$/, { message: 'code 只能用字母数字下划线，字母开头' }),
    __metadata("design:type", String)
], CreateFieldDefDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '兴趣爱好' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateFieldDefDto.prototype, "label", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: shared_1.FieldType }),
    (0, class_validator_1.IsEnum)(shared_1.FieldType),
    __metadata("design:type", String)
], CreateFieldDefDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateFieldDefDto.prototype, "groupId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [FieldOptionDto] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => FieldOptionDto),
    __metadata("design:type", Array)
], CreateFieldDefDto.prototype, "options", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFieldDefDto.prototype, "placeholder", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFieldDefDto.prototype, "helpText", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateFieldDefDto.prototype, "required", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '0公开 1会员 2VIP 3解锁后 4红娘 5管理员', default: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(5),
    __metadata("design:type", Number)
], CreateFieldDefDto.prototype, "visibility", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '是否映射到 Profile 固定列（只有内置字段能是 true）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateFieldDefDto.prototype, "isCore", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '是否同时出现在择偶要求表单' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateFieldDefDto.prototype, "isPreference", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '参与打分的权重键' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFieldDefDto.prototype, "weightKey", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateFieldDefDto.prototype, "minValue", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateFieldDefDto.prototype, "maxValue", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateFieldDefDto.prototype, "maxLength", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '校验正则' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFieldDefDto.prototype, "regex", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateFieldDefDto.prototype, "sort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateFieldDefDto.prototype, "enabled", void 0);
class UpdateFieldDefDto extends (0, swagger_1.PartialType)(CreateFieldDefDto) {
}
exports.UpdateFieldDefDto = UpdateFieldDefDto;
//# sourceMappingURL=field.dto.js.map