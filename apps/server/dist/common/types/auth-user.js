"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasRole = hasRole;
exports.isAdminUser = isAdminUser;
exports.isBackofficeUser = isBackofficeUser;
exports.hasPermission = hasPermission;
const shared_1 = require("@yuanqiao/shared");
function hasRole(user, ...roles) {
    if (!user)
        return false;
    return roles.some((r) => user.roles.includes(r));
}
/** 管理员口径：超管或普通管理员 */
function isAdminUser(user) {
    return hasRole(user, shared_1.RoleCode.SUPER_ADMIN, shared_1.RoleCode.ADMIN);
}
/** 后台可登录口径：管理员 + 审核员 + 红娘 */
function isBackofficeUser(user) {
    return hasRole(user, shared_1.RoleCode.SUPER_ADMIN, shared_1.RoleCode.ADMIN, shared_1.RoleCode.AUDITOR, shared_1.RoleCode.MATCHMAKER);
}
function hasPermission(user, code) {
    if (!user)
        return false;
    // 超管拥有一切
    if (user.roles.includes(shared_1.RoleCode.SUPER_ADMIN))
        return true;
    return user.permissions.includes(code);
}
//# sourceMappingURL=auth-user.js.map