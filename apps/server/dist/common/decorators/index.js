"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientIp = exports.CurrentUser = exports.LogAction = exports.LOG_ACTION_KEY = exports.RequireRoles = exports.ROLES_KEY = exports.RequirePermissions = exports.PERMISSIONS_KEY = exports.OptionalAuth = exports.IS_OPTIONAL_AUTH_KEY = exports.Public = exports.IS_PUBLIC_KEY = void 0;
const common_1 = require("@nestjs/common");
/** 标记接口无需登录 */
exports.IS_PUBLIC_KEY = 'isPublic';
const Public = () => (0, common_1.SetMetadata)(exports.IS_PUBLIC_KEY, true);
exports.Public = Public;
/**
 * 标记接口"登录可选"：未登录也能访问，但登录了就能拿到 req.user。
 * 用于档案详情这类接口——游客看脱敏版，会员看完整版。
 */
exports.IS_OPTIONAL_AUTH_KEY = 'isOptionalAuth';
const OptionalAuth = () => (0, common_1.SetMetadata)(exports.IS_OPTIONAL_AUTH_KEY, true);
exports.OptionalAuth = OptionalAuth;
/** 要求具备指定权限点（任一即可） */
exports.PERMISSIONS_KEY = 'permissions';
const RequirePermissions = (...codes) => (0, common_1.SetMetadata)(exports.PERMISSIONS_KEY, codes);
exports.RequirePermissions = RequirePermissions;
/** 要求具备指定角色（任一即可） */
exports.ROLES_KEY = 'roles';
const RequireRoles = (...roles) => (0, common_1.SetMetadata)(exports.ROLES_KEY, roles);
exports.RequireRoles = RequireRoles;
/** 操作日志标记：@LogAction('会员管理', '审核档案') */
exports.LOG_ACTION_KEY = 'logAction';
const LogAction = (module, action) => (0, common_1.SetMetadata)(exports.LOG_ACTION_KEY, { module, action });
exports.LogAction = LogAction;
/** 取当前登录用户；@CurrentUser('userId') 可直接取字段 */
exports.CurrentUser = (0, common_1.createParamDecorator)((key, ctx) => {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user)
        return null;
    return key ? user[key] : user;
});
/** 取客户端 IP，兼容 Nginx 反代 */
exports.ClientIp = (0, common_1.createParamDecorator)((_data, ctx) => {
    const req = ctx.switchToHttp().getRequest();
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff)
        return xff.split(',')[0].trim();
    return req.ip ?? req.socket?.remoteAddress ?? '';
});
//# sourceMappingURL=index.js.map