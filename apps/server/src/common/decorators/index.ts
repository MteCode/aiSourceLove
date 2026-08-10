import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../types/auth-user';

/** 标记接口无需登录 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * 标记接口"登录可选"：未登录也能访问，但登录了就能拿到 req.user。
 * 用于档案详情这类接口——游客看脱敏版，会员看完整版。
 */
export const IS_OPTIONAL_AUTH_KEY = 'isOptionalAuth';
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);

/** 要求具备指定权限点（任一即可） */
export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...codes: string[]) => SetMetadata(PERMISSIONS_KEY, codes);

/** 要求具备指定角色（任一即可） */
export const ROLES_KEY = 'roles';
export const RequireRoles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/** 操作日志标记：@LogAction('会员管理', '审核档案') */
export const LOG_ACTION_KEY = 'logAction';
export const LogAction = (module: string, action: string) =>
  SetMetadata(LOG_ACTION_KEY, { module, action });

/** 取当前登录用户；@CurrentUser('userId') 可直接取字段 */
export const CurrentUser = createParamDecorator(
  (key: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = req.user;
    if (!user) return null;
    return key ? user[key] : user;
  },
);

/** 取客户端 IP，兼容 Nginx 反代 */
export const ClientIp = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<Request>();
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff) return xff.split(',')[0].trim();
  return req.ip ?? req.socket?.remoteAddress ?? '';
});
