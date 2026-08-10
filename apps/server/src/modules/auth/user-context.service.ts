import { Injectable } from '@nestjs/common';
import { RoleCode } from '@yuanqiao/shared';
import type { AuthUser } from '@/common/types/auth-user';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { RedisService } from '@/infra/redis/redis.service';

const CACHE_TTL_SECONDS = 60;

/**
 * 装配 req.user 的鉴权上下文。
 *
 * 每次请求都要用，所以加了 60 秒 Redis 缓存。
 * 60 秒是"撤权生效延迟"和"DB 压力"的折中；
 * 后台改角色/封号时会主动 invalidate，所以实际是即时生效。
 */
@Injectable()
export class UserContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private key(userId: string): string {
    return `authctx:${userId}`;
  }

  async load(userId: string): Promise<AuthUser | null> {
    const cached = await this.redis.getJson<AuthUser>(this.key(userId));
    if (cached) {
      // JSON 里 Date 变成了字符串，还原一下
      return { ...cached, vipExpireAt: cached.vipExpireAt ? new Date(cached.vipExpireAt) : null };
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        profile: { select: { id: true } },
        matchmaker: { select: { id: true, status: true } },
      },
    });
    if (!user || user.status !== 'ACTIVE') return null;

    const roles = user.roles.map((ur) => ur.role.code);
    const permissions = [
      ...new Set(
        user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.code)),
      ),
    ];

    // VIP 过期了但定时任务还没跑到，这里实时判一次，避免过期用户还享受权益
    const isVip = user.isVip && (!user.vipExpireAt || user.vipExpireAt > new Date());

    const ctx: AuthUser = {
      userId: user.id,
      phone: user.phone,
      nickname: user.nickname,
      roles,
      permissions,
      profileId: user.profile?.id ?? null,
      // 停用的红娘不给红娘身份
      matchmakerId: user.matchmaker?.status === 'ACTIVE' ? user.matchmaker.id : null,
      isVip,
      vipExpireAt: user.vipExpireAt,
    };

    await this.redis.setJson(this.key(userId), ctx, CACHE_TTL_SECONDS);
    return ctx;
  }

  /** 改角色、改 VIP、封号后调它，让权限立即生效 */
  async invalidate(userId: string): Promise<void> {
    await this.redis.del(this.key(userId));
  }

  /** 判断某用户是不是这份档案的归属红娘 */
  async isMatchmakerOf(user: AuthUser | null, profileId: string): Promise<boolean> {
    if (!user) return false;
    if (user.roles.includes(RoleCode.SUPER_ADMIN) || user.roles.includes(RoleCode.ADMIN)) {
      return true;
    }
    if (!user.matchmakerId) return false;
    const n = await this.prisma.profile.count({
      where: { id: profileId, matchmakerId: user.matchmakerId },
    });
    return n > 0;
  }
}
