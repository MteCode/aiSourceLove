import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { RoleCode } from '@yuanqiao/shared';
import { PERMISSIONS_KEY, ROLES_KEY } from '../decorators';
import type { AuthUser } from '../types/auth-user';

/**
 * 权限点 / 角色守卫。@RequirePermissions('profile:audit') 或 @RequireRoles('MATCHMAKER')。
 * 两者都标时，满足任一即可通过（取并集，方便"管理员或本人"这种场景）。
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const needPerms = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, targets);
    const needRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, targets);

    if (!needPerms?.length && !needRoles?.length) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = req.user;
    if (!user) throw new ForbiddenException('请先登录');

    // 超管直通
    if (user.roles.includes(RoleCode.SUPER_ADMIN)) return true;

    if (needRoles?.length && needRoles.some((r) => user.roles.includes(r))) return true;
    if (needPerms?.length && needPerms.some((p) => user.permissions.includes(p))) return true;

    const want = [...(needRoles ?? []), ...(needPerms ?? [])].join(' / ');
    throw new ForbiddenException(`权限不足，需要：${want}`);
  }
}
