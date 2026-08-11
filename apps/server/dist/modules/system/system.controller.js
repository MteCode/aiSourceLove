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
exports.SystemController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("../../common/decorators");
const system_service_1 = require("./system.service");
const system_dto_1 = require("./dto/system.dto");
let SystemController = class SystemController {
    system;
    constructor(system) {
        this.system = system;
    }
    // ── 用户 ──
    listUsers(query) {
        return this.system.listUsers(query);
    }
    createUser(dto) {
        return this.system.createUser(dto);
    }
    updateUser(id, dto) {
        return this.system.updateUser(id, dto);
    }
    // ── 角色权限 ──
    listRoles() {
        return this.system.listRoles();
    }
    listPermissions() {
        return this.system.listPermissions();
    }
    updateRolePermissions(id, dto) {
        return this.system.updateRolePermissions(id, dto);
    }
    // ── 日志 ──
    listLogs(query) {
        return this.system.listLogs(query);
    }
    // ── 字典 ──
    listDicts() {
        return this.system.listDictTypes();
    }
    getDict(code) {
        return this.system.getDict(code);
    }
    // ── 行政区划 ──
    regions(parentCode, level) {
        return this.system.regions(parentCode, level ? Number(level) : undefined);
    }
    regionTree() {
        return this.system.regionTree();
    }
};
exports.SystemController = SystemController;
__decorate([
    (0, common_1.Get)('users'),
    (0, decorators_1.RequirePermissions)('system:user:list'),
    (0, swagger_1.ApiOperation)({ summary: '用户列表' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [system_dto_1.QueryUserDto]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "listUsers", null);
__decorate([
    (0, common_1.Post)('users'),
    (0, decorators_1.RequirePermissions)('system:user:edit'),
    (0, decorators_1.LogAction)('系统管理', '新建后台账号'),
    (0, swagger_1.ApiOperation)({ summary: '新建后台账号' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [system_dto_1.CreateSysUserDto]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "createUser", null);
__decorate([
    (0, common_1.Put)('users/:id'),
    (0, decorators_1.RequirePermissions)('system:user:edit'),
    (0, decorators_1.LogAction)('系统管理', '修改用户'),
    (0, swagger_1.ApiOperation)({ summary: '修改用户（角色/状态/重置密码）' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, system_dto_1.UpdateSysUserDto]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "updateUser", null);
__decorate([
    (0, common_1.Get)('roles'),
    (0, decorators_1.RequirePermissions)('system:role:list'),
    (0, swagger_1.ApiOperation)({ summary: '角色列表（含已授权限）' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "listRoles", null);
__decorate([
    (0, common_1.Get)('permissions'),
    (0, decorators_1.RequirePermissions)('system:role:list'),
    (0, swagger_1.ApiOperation)({ summary: '权限点（按模块分组，前端渲染权限树）' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "listPermissions", null);
__decorate([
    (0, common_1.Put)('roles/:id/permissions'),
    (0, decorators_1.RequirePermissions)('system:role:edit'),
    (0, decorators_1.LogAction)('系统管理', '修改角色权限'),
    (0, swagger_1.ApiOperation)({ summary: '设置角色权限（改完该角色用户立即生效）' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, system_dto_1.UpdateRolePermissionsDto]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "updateRolePermissions", null);
__decorate([
    (0, common_1.Get)('logs'),
    (0, decorators_1.RequirePermissions)('system:log:list'),
    (0, swagger_1.ApiOperation)({ summary: '操作日志' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [system_dto_1.QueryLogDto]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "listLogs", null);
__decorate([
    (0, common_1.Get)('dicts'),
    (0, swagger_1.ApiOperation)({ summary: '全部字典' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "listDicts", null);
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)('dicts/:code'),
    (0, swagger_1.ApiOperation)({ summary: '按 code 取字典' }),
    __param(0, (0, common_1.Param)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "getDict", null);
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)('regions'),
    (0, swagger_1.ApiOperation)({ summary: '行政区划（不传 parentCode 返回省份）' }),
    __param(0, (0, common_1.Query)('parentCode')),
    __param(1, (0, common_1.Query)('level')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "regions", null);
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)('regions/tree'),
    (0, swagger_1.ApiOperation)({ summary: '行政区划树（级联选择器用）' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "regionTree", null);
exports.SystemController = SystemController = __decorate([
    (0, swagger_1.ApiTags)('系统管理'),
    (0, common_1.Controller)('system'),
    __metadata("design:paramtypes", [system_service_1.SystemService])
], SystemController);
//# sourceMappingURL=system.controller.js.map