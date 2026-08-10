import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import {
  CurrentUser as CurrentUserDto,
  LoginResult,
  RoleCode,
  SMS_CODE_INTERVAL_SECONDS,
  SMS_CODE_TTL_SECONDS,
} from '@yuanqiao/shared';
import type { AppConfig, ExpiresIn } from '@/config/configuration';
import type { AuthUser } from '@/common/types/auth-user';
import { BizException } from '@/common/filters/all-exceptions.filter';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { RedisService } from '@/infra/redis/redis.service';
import type { JwtPayload } from './jwt.strategy';
import { UserContextService } from './user-context.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly userContext: UserContextService,
  ) {}

  // ───────── 短信验证码 ─────────

  private smsKey(phone: string, scene: string): string {
    return `sms:${scene}:${phone}`;
  }

  async sendSmsCode(phone: string, scene: string): Promise<{ sent: boolean; devCode?: string }> {
    const key = this.smsKey(phone, scene);

    // 频率限制：同一手机号 60 秒内只能发一次
    const ttl = await this.redis.ttl(key);
    if (ttl > SMS_CODE_TTL_SECONDS - SMS_CODE_INTERVAL_SECONDS) {
      const wait = ttl - (SMS_CODE_TTL_SECONDS - SMS_CODE_INTERVAL_SECONDS);
      throw new BizException(`发送太频繁，请 ${wait} 秒后再试`, 42901);
    }
    // 同一手机号每天上限，防刷短信费
    const dayCount = await this.redis.incr(`sms:count:${phone}`, 24 * 3600);
    if (dayCount > 10) {
      throw new BizException('今日验证码发送次数已达上限', 42902);
    }

    const smsCfg = this.config.get('sms', { infer: true });
    const code =
      smsCfg.provider === 'mock'
        ? smsCfg.mockCode
        : String(Math.floor(100000 + Math.random() * 900000));

    await this.redis.set(key, code, SMS_CODE_TTL_SECONDS);

    if (smsCfg.provider === 'mock') {
      this.logger.warn(`【模拟短信】${phone} 验证码：${code}（SMS_PROVIDER=mock）`);
      // 开发环境把验证码直接回给前端，省去翻日志
      return { sent: true, devCode: this.config.get('isProd', { infer: true }) ? undefined : code };
    }

    // TODO 接入真实短信通道（阿里云/腾讯云）：此处调 SDK
    this.logger.error(`短信通道 ${smsCfg.provider} 尚未接入，验证码未实际发送`);
    throw new BizException('短信服务未配置，请联系管理员', 50002);
  }

  private async verifySmsCode(phone: string, scene: string, code: string): Promise<void> {
    const key = this.smsKey(phone, scene);
    const expected = await this.redis.get(key);
    if (!expected) throw new BizException('验证码已过期，请重新获取', 40010);
    if (expected !== code) {
      // 错误次数限制，防爆破
      const fails = await this.redis.incr(`sms:fail:${phone}`, SMS_CODE_TTL_SECONDS);
      if (fails >= 5) await this.redis.del(key);
      throw new BizException('验证码不正确', 40011);
    }
    // 用过即焚，防重放
    await this.redis.del(key, `sms:fail:${phone}`);
  }

  // ───────── 登录 ─────────

  /** 手机号验证码登录；号码不存在则自动注册为普通会员 */
  async smsLogin(
    phone: string,
    code: string,
    ip: string,
    inviteMatchmakerId?: string,
  ): Promise<LoginResult> {
    await this.verifySmsCode(phone, 'login', code);

    let user = await this.prisma.user.findUnique({ where: { phone } });

    if (!user) {
      user = await this.registerMember(phone, inviteMatchmakerId);
    } else if (user.deletedAt) {
      throw new BizException('该账号已注销', 40312);
    } else if (user.status === 'BANNED') {
      throw new BizException('该账号已被封禁，如有疑问请联系客服', 40313);
    }

    return this.issueTokens(user.id, phone, ip);
  }

  /** 密码登录，主要给后台用（管理员/审核员/红娘） */
  async passwordLogin(username: string, password: string, ip: string): Promise<LoginResult> {
    const user = await this.prisma.user.findFirst({
      where: { phone: username, deletedAt: null },
    });

    // 用户不存在和密码错误返回同样的提示，不给撞库的人区分信号
    const invalid = new UnauthorizedException('账号或密码不正确');
    if (!user?.passwordHash) throw invalid;

    // 登录失败次数限制
    const failKey = `login:fail:${username}`;
    const fails = Number((await this.redis.get(failKey)) ?? 0);
    if (fails >= 8) {
      throw new BizException('密码错误次数过多，请 15 分钟后再试', 42903);
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      await this.redis.incr(failKey, 15 * 60);
      throw invalid;
    }
    if (user.status !== 'ACTIVE') throw new BizException('账号已被停用', 40313);

    await this.redis.del(failKey);
    return this.issueTokens(user.id, user.phone, ip);
  }

  /** 微信小程序登录 */
  async wxMiniLogin(
    code: string,
    ip: string,
    extra?: { nickname?: string; avatar?: string },
  ): Promise<LoginResult> {
    const cfg = this.config.get('wxMini', { infer: true });
    if (!cfg.appId || !cfg.appSecret) {
      throw new BizException(
        '微信小程序登录未配置（缺 WX_MINI_APP_ID / WX_MINI_APP_SECRET）',
        50003,
      );
    }

    const url =
      `https://api.weixin.qq.com/sns/jscode2session?appid=${cfg.appId}` +
      `&secret=${cfg.appSecret}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
    const res = await fetch(url).then((r) => r.json() as Promise<Record<string, unknown>>);
    const openid = res.openid as string | undefined;
    if (!openid) {
      throw new BizException(`微信登录失败：${res.errmsg ?? '未知错误'}`, 40014);
    }

    let user = await this.prisma.user.findUnique({ where: { wxOpenid: openid } });
    if (!user) {
      // 没绑手机号的用户先建号，手机号用 openid 占位，后续用 getPhoneNumber 补
      user = await this.prisma.user.create({
        data: {
          phone: `wx_${openid.slice(0, 16)}`,
          wxOpenid: openid,
          wxUnionid: (res.unionid as string) ?? null,
          nickname: extra?.nickname ?? '微信用户',
          avatar: extra?.avatar ?? null,
          roles: { create: { role: { connect: { code: RoleCode.MEMBER } } } },
        },
      });
    }
    return this.issueTokens(user.id, user.phone, ip);
  }

  private async registerMember(phone: string, inviteMatchmakerId?: string) {
    const memberRole = await this.prisma.role.findUnique({ where: { code: RoleCode.MEMBER } });
    if (!memberRole) {
      throw new BizException('系统未初始化（缺少 MEMBER 角色），请先执行 db:seed', 50004);
    }

    // 邀请人必须是启用中的红娘，否则忽略这个参数
    let matchmakerId: string | null = null;
    if (inviteMatchmakerId) {
      const mm = await this.prisma.matchmaker.findFirst({
        where: { id: inviteMatchmakerId, status: 'ACTIVE', deletedAt: null },
        select: { id: true },
      });
      matchmakerId = mm?.id ?? null;
    }

    return this.prisma.user.create({
      data: {
        phone,
        nickname: `缘友${phone.slice(-4)}`,
        roles: { create: { roleId: memberRole.id } },
        // 此刻还没有档案，先把归属红娘挂在用户上，建档案时转写过去
        inviteMatchmakerId: matchmakerId,
      },
    });
  }

  private async issueTokens(userId: string, phone: string, ip: string): Promise<LoginResult> {
    const jwtCfg = this.config.get('jwt', { infer: true });

    const accessToken = await this.jwt.signAsync(
      { sub: userId, phone, typ: 'access' } satisfies JwtPayload,
      { expiresIn: jwtCfg.expiresIn },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, phone, typ: 'refresh' } satisfies JwtPayload,
      { expiresIn: jwtCfg.refreshExpiresIn },
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date(), lastLoginIp: ip.slice(0, 64) },
    });
    await this.userContext.invalidate(userId);

    const ctx = await this.userContext.load(userId);
    if (!ctx) throw new UnauthorizedException('账号状态异常');

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiry(jwtCfg.expiresIn),
      user: await this.toCurrentUser(ctx),
    };
  }

  async refresh(refreshToken: string, ip: string): Promise<LoginResult> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('登录已过期，请重新登录');
    }
    if (payload.typ !== 'refresh') throw new UnauthorizedException('token 类型不正确');
    return this.issueTokens(payload.sub, payload.phone, ip);
  }

  async toCurrentUser(ctx: AuthUser): Promise<CurrentUserDto> {
    const profile = ctx.profileId
      ? await this.prisma.profile.findUnique({
          where: { id: ctx.profileId },
          select: { status: true },
        })
      : null;
    const user = await this.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { avatar: true },
    });

    return {
      id: ctx.userId,
      phone: ctx.phone,
      nickname: ctx.nickname,
      avatar: user?.avatar ?? null,
      roles: ctx.roles,
      permissions: ctx.permissions,
      profileId: ctx.profileId,
      profileStatus: profile?.status ?? null,
      isVip: ctx.isVip,
      vipExpireAt: ctx.vipExpireAt?.toISOString() ?? null,
      matchmakerId: ctx.matchmakerId,
    };
  }

  async changePassword(userId: string, oldPassword: string | undefined, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BizException('用户不存在', 40401);

    if (user.passwordHash) {
      if (!oldPassword) throw new BadRequestException('请输入原密码');
      const ok = await bcrypt.compare(oldPassword, user.passwordHash);
      if (!ok) throw new BizException('原密码不正确', 40015);
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
    await this.userContext.invalidate(userId);
    return { success: true };
  }

  /** "7d" / "30m" / 3600 → 秒 */
  private parseExpiry(v: ExpiresIn): number {
    if (typeof v === 'number') return v;
    const m = /^(\d+)([smhd])?$/.exec(v.trim());
    if (!m) return 7 * 24 * 3600;
    const n = Number(m[1]);
    switch (m[2]) {
      case 's':
        return n;
      case 'm':
        return n * 60;
      case 'h':
        return n * 3600;
      case 'd':
        return n * 86400;
      default:
        return n;
    }
  }
}
