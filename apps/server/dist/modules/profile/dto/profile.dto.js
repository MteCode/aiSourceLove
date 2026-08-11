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
exports.ClaimProfileDto = exports.QueryProfileDto = exports.AuditPhotoDto = exports.AuditProfileDto = exports.MatchmakerCreateProfileDto = exports.UpsertProfileDto = exports.PreferenceInputDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const shared_1 = require("@yuanqiao/shared");
const pagination_dto_1 = require("../../../common/dto/pagination.dto");
class PreferenceInputDto {
    ageMin;
    ageMax;
    heightMin;
    heightMax;
    educationMin;
    incomeMin;
    maritalStatus;
    childrenStatus;
    cityCodes;
    requireHouse;
    requireCar;
    description;
}
exports.PreferenceInputDto = PreferenceInputDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 18, maximum: 80 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(18),
    (0, class_validator_1.Max)(80),
    __metadata("design:type", Number)
], PreferenceInputDto.prototype, "ageMin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 18, maximum: 80 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(18),
    (0, class_validator_1.Max)(80),
    __metadata("design:type", Number)
], PreferenceInputDto.prototype, "ageMax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(130),
    (0, class_validator_1.Max)(230),
    __metadata("design:type", Number)
], PreferenceInputDto.prototype, "heightMin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(130),
    (0, class_validator_1.Max)(230),
    __metadata("design:type", Number)
], PreferenceInputDto.prototype, "heightMax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: shared_1.Education }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(shared_1.Education),
    __metadata("design:type", String)
], PreferenceInputDto.prototype, "educationMin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '期望年收入下限，单位元' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], PreferenceInputDto.prototype, "incomeMin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: shared_1.MaritalStatus, isArray: true, description: '空数组=不限' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsEnum)(shared_1.MaritalStatus, { each: true }),
    __metadata("design:type", Array)
], PreferenceInputDto.prototype, "maritalStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: shared_1.ChildrenStatus, isArray: true, description: '空数组=不限' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsEnum)(shared_1.ChildrenStatus, { each: true }),
    __metadata("design:type", Array)
], PreferenceInputDto.prototype, "childrenStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String], description: '期望城市 adcode，空=不限' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], PreferenceInputDto.prototype, "cityCodes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PreferenceInputDto.prototype, "requireHouse", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PreferenceInputDto.prototype, "requireCar", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '择偶自由描述，AI 层做语义匹配用' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], PreferenceInputDto.prototype, "description", void 0);
/** 档案录入。两条路径共用这个 DTO：用户自填 和 红娘代录。 */
class UpsertProfileDto {
    realName;
    nickname;
    gender;
    birthday;
    heightCm;
    weightKg;
    education;
    school;
    occupation;
    company;
    annualIncome;
    maritalStatus;
    childrenStatus;
    houseStatus;
    carStatus;
    provinceCode;
    cityCode;
    districtCode;
    hometownCityCode;
    introduction;
    phone;
    wechat;
    preference;
    extras;
}
exports.UpsertProfileDto = UpsertProfileDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '真实姓名（默认脱敏展示）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], UpsertProfileDto.prototype, "realName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '昵称' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], UpsertProfileDto.prototype, "nickname", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: shared_1.Gender }),
    (0, class_validator_1.IsEnum)(shared_1.Gender, { message: '请选择性别' }),
    __metadata("design:type", String)
], UpsertProfileDto.prototype, "gender", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '生日 YYYY-MM-DD', example: '1996-05-20' }),
    (0, class_validator_1.IsDateString)({}, { message: '生日格式应为 YYYY-MM-DD' }),
    __metadata("design:type", String)
], UpsertProfileDto.prototype, "birthday", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(130),
    (0, class_validator_1.Max)(230),
    __metadata("design:type", Number)
], UpsertProfileDto.prototype, "heightCm", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(30),
    (0, class_validator_1.Max)(200),
    __metadata("design:type", Number)
], UpsertProfileDto.prototype, "weightKg", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: shared_1.Education }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(shared_1.Education),
    __metadata("design:type", String)
], UpsertProfileDto.prototype, "education", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], UpsertProfileDto.prototype, "school", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], UpsertProfileDto.prototype, "occupation", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], UpsertProfileDto.prototype, "company", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '年收入，单位元' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100000000),
    __metadata("design:type", Number)
], UpsertProfileDto.prototype, "annualIncome", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: shared_1.MaritalStatus }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(shared_1.MaritalStatus),
    __metadata("design:type", String)
], UpsertProfileDto.prototype, "maritalStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: shared_1.ChildrenStatus }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(shared_1.ChildrenStatus),
    __metadata("design:type", String)
], UpsertProfileDto.prototype, "childrenStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: shared_1.HouseStatus }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(shared_1.HouseStatus),
    __metadata("design:type", String)
], UpsertProfileDto.prototype, "houseStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: shared_1.CarStatus }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(shared_1.CarStatus),
    __metadata("design:type", String)
], UpsertProfileDto.prototype, "carStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(12),
    __metadata("design:type", String)
], UpsertProfileDto.prototype, "provinceCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(12),
    __metadata("design:type", String)
], UpsertProfileDto.prototype, "cityCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(12),
    __metadata("design:type", String)
], UpsertProfileDto.prototype, "districtCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(12),
    __metadata("design:type", String)
], UpsertProfileDto.prototype, "hometownCityCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '自我介绍' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], UpsertProfileDto.prototype, "introduction", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '手机号' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' }),
    __metadata("design:type", String)
], UpsertProfileDto.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], UpsertProfileDto.prototype, "wechat", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: PreferenceInputDto }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => PreferenceInputDto),
    __metadata("design:type", PreferenceInputDto)
], UpsertProfileDto.prototype, "preference", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: '扩展字段（EAV），key 为 fieldDef.code。会按字段定义校验。',
        example: { hobby: ['旅行', '健身'], acceptLongDistance: true },
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpsertProfileDto.prototype, "extras", void 0);
/** 红娘代录：多一个"给谁录"的信息，且不需要对方有账号 */
class MatchmakerCreateProfileDto extends UpsertProfileDto {
    userId;
    submitNow;
}
exports.MatchmakerCreateProfileDto = MatchmakerCreateProfileDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '若该会员已注册，传其 userId 直接关联' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MatchmakerCreateProfileDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '是否立即提交审核', default: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], MatchmakerCreateProfileDto.prototype, "submitNow", void 0);
class AuditProfileDto {
    targetStatus;
    reason;
    rejectedFields;
}
exports.AuditProfileDto = AuditProfileDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: [shared_1.ProfileStatus.APPROVED, shared_1.ProfileStatus.REJECTED, shared_1.ProfileStatus.OFFLINE] }),
    (0, class_validator_1.IsEnum)(shared_1.ProfileStatus),
    __metadata("design:type", String)
], AuditProfileDto.prototype, "targetStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '驳回/下架理由（驳回必填）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], AuditProfileDto.prototype, "reason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String], description: '有问题的字段 code，前端高亮用' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], AuditProfileDto.prototype, "rejectedFields", void 0);
class AuditPhotoDto {
    status;
    reason;
}
exports.AuditPhotoDto = AuditPhotoDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['APPROVED', 'REJECTED'] }),
    (0, class_validator_1.IsEnum)(['APPROVED', 'REJECTED']),
    __metadata("design:type", String)
], AuditPhotoDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], AuditPhotoDto.prototype, "reason", void 0);
class QueryProfileDto extends pagination_dto_1.PaginationDto {
    keyword;
    status;
    gender;
    cityCode;
    source;
    matchmakerId;
    ageMin;
    ageMax;
    hasPendingPhoto;
}
exports.QueryProfileDto = QueryProfileDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '编号/姓名/手机号 模糊搜索' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QueryProfileDto.prototype, "keyword", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: shared_1.ProfileStatus }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(shared_1.ProfileStatus),
    __metadata("design:type", String)
], QueryProfileDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: shared_1.Gender }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(shared_1.Gender),
    __metadata("design:type", String)
], QueryProfileDto.prototype, "gender", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QueryProfileDto.prototype, "cityCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: shared_1.ProfileSource }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(shared_1.ProfileSource),
    __metadata("design:type", String)
], QueryProfileDto.prototype, "source", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '归属红娘 id' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QueryProfileDto.prototype, "matchmakerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(18),
    (0, class_validator_1.Max)(80),
    (0, class_transformer_1.Transform)(({ value }) => (value === '' || value == null ? undefined : Number(value))),
    __metadata("design:type", Number)
], QueryProfileDto.prototype, "ageMin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(18),
    (0, class_validator_1.Max)(80),
    (0, class_transformer_1.Transform)(({ value }) => (value === '' || value == null ? undefined : Number(value))),
    __metadata("design:type", Number)
], QueryProfileDto.prototype, "ageMax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '只看有待审照片的' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => value === 'true' || value === true),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], QueryProfileDto.prototype, "hasPendingPhoto", void 0);
class ClaimProfileDto {
    serialNo;
}
exports.ClaimProfileDto = ClaimProfileDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '要认领的档案编号，如 YQ26081000001' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ClaimProfileDto.prototype, "serialNo", void 0);
//# sourceMappingURL=profile.dto.js.map