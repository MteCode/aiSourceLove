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
exports.PaginationDto = void 0;
exports.buildPageResult = buildPageResult;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class PaginationDto {
    page = 1;
    pageSize = 20;
    sortBy;
    sortOrder = 'desc';
    get skip() {
        return (this.page - 1) * this.pageSize;
    }
    get take() {
        return this.pageSize;
    }
}
exports.PaginationDto = PaginationDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '页码，从 1 开始', default: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => Number.parseInt(value, 10) || 1),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], PaginationDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '每页条数', default: 20, maximum: 100 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => Number.parseInt(value, 10) || 20),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], PaginationDto.prototype, "pageSize", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '排序字段' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PaginationDto.prototype, "sortBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '排序方向', enum: ['asc', 'desc'], default: 'desc' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['asc', 'desc']),
    __metadata("design:type", String)
], PaginationDto.prototype, "sortOrder", void 0);
function buildPageResult(list, total, page, pageSize) {
    return {
        list,
        total,
        page,
        pageSize,
        totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
    };
}
//# sourceMappingURL=pagination.dto.js.map