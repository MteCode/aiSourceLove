import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_OPTIONAL_AUTH_KEY, IS_PUBLIC_KEY } from '../decorators';

/**
 * 全局 JWT 守卫。默认所有接口都要登录，
 * 用 @Public() 放行，用 @OptionalAuth() 表示"登录可选"。
 *
 * 默认拒绝而不是默认放行——漏加装饰器时的后果是"接口 401"，
 * 而不是"接口裸奔"。
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    return super.canActivate(context);
  }

  handleRequest<TUser>(err: unknown, user: TUser, _info: unknown, context: ExecutionContext): TUser {
    const targets = [context.getHandler(), context.getClass()];
    const optional = this.reflector.getAllAndOverride<boolean>(IS_OPTIONAL_AUTH_KEY, targets);

    // 登录可选：没带 token 或 token 失效都放行，只是 req.user 为空
    if (optional && (err || !user)) return null as TUser;

    return super.handleRequest(err, user, _info, context) as TUser;
  }
}
