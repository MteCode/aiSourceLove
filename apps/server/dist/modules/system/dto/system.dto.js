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
exports.QueryLogDto = exports.UpdateRolePermissionsDto = exports.UpdateSysUserDto = exports.CreateSysUserDto = exports.QueryUserDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const shared_1 = require("@yuanqiao/shared");
const pagination_dto_1 = require("../../../common/dto/pagination.dto");
class QueryUserDto extends pagination_dto_1.PaginationDto {
    keyword;
    status;
    roleCode;
}
exports.QueryUserDto = QueryUserDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QueryUserDto.prototype, "keyword", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: shared_1.UserStatus }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(shared_1.UserStatus),
    __metadata("design:type", String)
], QueryUserDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '按角色筛选' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QueryUserDto.prototype, "roleCode", void 0);
class CreateSysUserDto {
    phone;
    nickname;
    password;
    roleCodes;
}
exports.CreateSysUserDto = CreateSysUserDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '13800138001' }),
    (0, class_validator_1.Matches)(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' }),
    __metadata("design:type", String)
], CreateSysUserDto.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], CreateSysUserDto.prototype, "nickname", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 8 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8, { message: '密码至少 8 位' }),
    __metadata("design:type", String)
], CreateSysUserDto.prototype, "password", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String], example: ['AUDITOR'] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateSysUserDto.prototype, "roleCodes", void 0);
class UpdateSysUserDto {
    nickname;
    status;
    password;
    roleCodes;
}
exports.UpdateSysUserDto = UpdateSysUserDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], UpdateSysUserDto.prototype, "nickname", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: shared_1.UserStatus }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(shared_1.UserStatus),
    __metadata("design:type", String)
], UpdateSysUserDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '重置密码' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    __metadata("design:type", String)
], UpdateSysUserDto.prototype, "password", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], UpdateSysUserDto.prototype, "roleCodes", void 0);
class UpdateRolePermissionsDto {
    permissionCodes;
}
exports.UpdateRolePermissionsDto = UpdateRolePermissionsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], UpdateRolePermissionsDto.prototype, "permissionCodes", void 0);
class QueryLogDto extends pagination_dto_1.PaginationDto {
    keyword;
    module;
    success;
    startDate;
    endDate;
}
exports.QueryLogDto = QueryLogDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QueryLogDto.prototype, "keyword", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QueryLogDto.prototype, "module", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (value === '' || value == null ? undefined : value === 'true' || value === true)),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], QueryLogDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-08-01' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QueryLogDto.prototype, "startDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-08-31' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QueryLogDto.prototype, "endDate", void 0);
//# sourceMappingURL=system.dto.js.map