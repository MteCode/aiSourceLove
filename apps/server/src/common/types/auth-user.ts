import { RoleCode } from '@yuanqiao/shared';

/**
 * 挂在 req.user 上的鉴权上下文。
 *
 * 注意 roles/permissions 不放进 JWT payload：
 * 放进去的话，后台把某人的红娘角色撤了，他手上的 token 还能用到过期为止。
 * 这里每次请求从缓存/DB 现取，撤权立即生效（缓存 TTL 60 秒）。
 */
export interface AuthUser {
  userId: string;
  phone: string;
  nickname: string | null;
  roles: string[];
  permissions: string[];
  /** 该用户的档案 id，没建档为 null */
  profileId: string | null;
  /** 该用户是红娘时有值 */
  matchmakerId: string | null;
  isVip: boolean;
  vipExpireAt: Date | null;
}

export function hasRole(user: AuthUser | null | undefined, ...roles: RoleCode[]): boolean {
  if (!user) return false;
  return roles.some((r) => user.roles.includes(r));
}

/** 管理员口径：超管或普通管理员 */
export function isAdminUser(user: AuthUser | null | undefined): boolean {
  return hasRole(user, RoleCode.SUPER_ADMIN, RoleCode.ADMIN);
}

/** 后台可登录口径：管理员 + 审核员 + 红娘 */
export function isBackofficeUser(user: AuthUser | null | undefined): boolean {
  return hasRole(user, RoleCode.SUPER_ADMIN, RoleCode.ADMIN, RoleCode.AUDITOR, RoleCode.MATCHMAKER);
}

export function hasPermission(user: AuthUser | null | undefined, code: string): boolean {
  if (!user) return false;
  // 超管拥有一切
  if (user.roles.includes(RoleCode.SUPER_ADMIN)) return true;
  return user.permissions.includes(code);
}
