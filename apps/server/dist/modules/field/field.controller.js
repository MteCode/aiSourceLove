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
exports.FieldController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("../../common/decorators");
const field_service_1 = require("./field.service");
const field_dto_1 = require("./dto/field.dto");
let FieldController = class FieldController {
    field;
    constructor(field) {
        this.field = field;
    }
    // ── 前端渲染用 ──
    getSchema() {
        return this.field.getFormSchema();
    }
    getPreferenceSchema() {
        return this.field.getPreferenceSchema();
    }
    // ── 后台配置 ──
    listGroups() {
        return this.field.listGroups();
    }
    createGroup(dto) {
        return this.field.createGroup(dto);
    }
    updateGroup(id, dto) {
        return this.field.updateGroup(id, dto);
    }
    deleteGroup(id) {
        return this.field.deleteGroup(id);
    }
    createField(dto) {
        return this.field.createField(dto);
    }
    updateField(id, dto) {
        return this.field.updateField(id, dto);
    }
    deleteField(id, hard) {
        return this.field.deleteField(id, hard === 'true');
    }
};
exports.FieldController = FieldController;
__decorate([
    (0, decorators_1.OptionalAuth)(),
    (0, common_1.Get)('schema'),
    (0, swagger_1.ApiOperation)({ summary: '获取档案录入表单 schema' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FieldController.prototype, "getSchema", null);
__decorate([
    (0, decorators_1.OptionalAuth)(),
    (0, common_1.Get)('schema/preference'),
    (0, swagger_1.ApiOperation)({ summary: '获取择偶要求表单 schema' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FieldController.prototype, "getPreferenceSchema", null);
__decorate([
    (0, common_1.Get)('groups'),
    (0, decorators_1.RequirePermissions)('field:list'),
    (0, swagger_1.ApiOperation)({ summary: '字段分组列表（含字段）' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FieldController.prototype, "listGroups", null);
__decorate([
    (0, common_1.Post)('groups'),
    (0, decorators_1.RequirePermissions)('field:edit'),
    (0, decorators_1.LogAction)('字段字典', '新建分组'),
    (0, swagger_1.ApiOperation)({ summary: '新建字段分组' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [field_dto_1.CreateFieldGroupDto]),
    __metadata("design:returntype", Promise)
], FieldController.prototype, "createGroup", null);
__decorate([
    (0, common_1.Put)('groups/:id'),
    (0, decorators_1.RequirePermissions)('field:edit'),
    (0, decorators_1.LogAction)('字段字典', '修改分组'),
    (0, swagger_1.ApiOperation)({ summary: '修改字段分组' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, field_dto_1.UpdateFieldGroupDto]),
    __metadata("design:returntype", Promise)
], FieldController.prototype, "updateGroup", null);
__decorate([
    (0, common_1.Delete)('groups/:id'),
    (0, decorators_1.RequirePermissions)('field:edit'),
    (0, decorators_1.LogAction)('字段字典', '删除分组'),
    (0, swagger_1.ApiOperation)({ summary: '删除字段分组' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FieldController.prototype, "deleteGroup", null);
__decorate([
    (0, common_1.Post)(),
    (0, decorators_1.RequirePermissions)('field:edit'),
    (0, decorators_1.LogAction)('字段字典', '新建字段'),
    (0, swagger_1.ApiOperation)({ summary: '新建字段（运营加字段不用发版）' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [field_dto_1.CreateFieldDefDto]),
    __metadata("design:returntype", Promise)
], FieldController.prototype, "createField", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, decorators_1.RequirePermissions)('field:edit'),
    (0, decorators_1.LogAction)('字段字典', '修改字段'),
    (0, swagger_1.ApiOperation)({ summary: '修改字段' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, field_dto_1.UpdateFieldDefDto]),
    __metadata("design:returntype", Promise)
], FieldController.prototype, "updateField", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, decorators_1.RequirePermissions)('field:edit'),
    (0, decorators_1.LogAction)('字段字典', '删除字段'),
    (0, swagger_1.ApiOperation)({ summary: '删除字段（默认软删=停用，hard=true 才真删）' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('hard')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], FieldController.prototype, "deleteField", null);
exports.FieldController = FieldController = __decorate([
    (0, swagger_1.ApiTags)('字段字典 / 动态表单'),
    (0, common_1.Controller)('fields'),
    __metadata("design:paramtypes", [field_service_1.FieldService])
], FieldController);
//# sourceMappingURL=field.controller.js.map