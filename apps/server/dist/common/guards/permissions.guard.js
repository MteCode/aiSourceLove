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
exports.PermissionsGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const shared_1 = require("@yuanqiao/shared");
const decorators_1 = require("../decorators");
/**
 * 权限点 / 角色守卫。@RequirePermissions('profile:audit') 或 @RequireRoles('MATCHMAKER')。
 * 两者都标时，满足任一即可通过（取并集，方便"管理员或本人"这种场景）。
 */
let PermissionsGuard = class PermissionsGuard {
    reflector;
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(context) {
        const targets = [context.getHandler(), context.getClass()];
        const needPerms = this.reflector.getAllAndOverride(decorators_1.PERMISSIONS_KEY, targets);
        const needRoles = this.reflector.getAllAndOverride(decorators_1.ROLES_KEY, targets);
        if (!needPerms?.length && !needRoles?.length)
            return true;
        const req = context.switchToHttp().getRequest();
        const user = req.user;
        if (!user)
            throw new common_1.ForbiddenException('请先登录');
        // 超管直通
        if (user.roles.includes(shared_1.RoleCode.SUPER_ADMIN))
            return true;
        if (needRoles?.length && needRoles.some((r) => user.roles.includes(r)))
            return true;
        if (needPerms?.length && needPerms.some((p) => user.permissions.includes(p)))
            return true;
        const want = [...(needRoles ?? []), ...(needPerms ?? [])].join(' / ');
        throw new common_1.ForbiddenException(`权限不足，需要：${want}`);
    }
};
exports.PermissionsGuard = PermissionsGuard;
exports.PermissionsGuard = PermissionsGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], PermissionsGuard);
//# sourceMappingURL=permissions.guard.js.map