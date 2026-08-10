import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AppConfig } from '@/config/configuration';
import type { AuthUser } from '@/common/types/auth-user';
import { UserContextService } from './user-context.service';

export interface JwtPayload {
  /** userId */
  sub: string;
  phone: string;
  /** access | refresh */
  typ: 'access' | 'refresh';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly userContext: UserContextService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('jwt', { infer: true }).secret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    // refresh token 不能当 access token 用
    if (payload.typ !== 'access') {
      throw new UnauthorizedException('token 类型不正确');
    }
    const user = await this.userContext.load(payload.sub);
    if (!user) {
      throw new UnauthorizedException('账号不存在或已被停用');
    }
    return user;
  }
}
