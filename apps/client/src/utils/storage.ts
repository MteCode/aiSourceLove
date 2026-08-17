/** 小程序没有 localStorage，统一走 uni.getStorageSync */
const K = {
  access: 'yq_access_token',
  refresh: 'yq_refresh_token',
  /** 扫红娘的邀请码进来时暂存，注册成功后绑定归属 */
  invite: 'yq_invite_matchmaker',
} as const;

export const tokenStore = {
  get access(): string {
    return uni.getStorageSync(K.access) || '';
  },
  get refresh(): string {
    return uni.getStorageSync(K.refresh) || '';
  },
  set(accessToken: string, refreshToken: string): void {
    uni.setStorageSync(K.access, accessToken);
    uni.setStorageSync(K.refresh, refreshToken);
  },
  clear(): void {
    uni.removeStorageSync(K.access);
    uni.removeStorageSync(K.refresh);
  },
};

export interface InviteInfo {
  /** 红娘 id，来自红娘分享 */
  mm?: string;
  /** 管理员邀请码，带它注册的人才允许申请成为红娘 */
  inv?: string;
  /** 写入时间戳，用来判过期 */
  at: number;
}

/**
 * 邀请归属暂存。
 *
 * 必须落存储不能只放内存：用户从分享进来多半先逛半天才注册，
 * 中途还可能杀掉小程序重进，一丢红娘的拉新就白干了。
 *
 * 有效期 7 天——太短，用户过两天回来注册就归不上；
 * 太长，半年前随手点开的分享还在生效，归属成糊涂账。
 */
const INVITE_TTL_MS = 7 * 24 * 3600 * 1000;

export const inviteStore = {
  get(): InviteInfo | null {
    const v = uni.getStorageSync(K.invite) as InviteInfo | '' | null;
    if (!v || typeof v !== 'object' || !v.at) return null;
    if (Date.now() - v.at > INVITE_TTL_MS) {
      // 过期即清，别让它悄悄影响以后的注册
      uni.removeStorageSync(K.invite);
      return null;
    }
    return v;
  },

  /**
   * 从启动参数里捡邀请信息。冷启动、分享卡片、扫码走的是不同回调但 query 同构，
   * 所以统一走这里。
   */
  capture(query?: Record<string, string | undefined> | null): void {
    const mm = query?.mm?.trim() || query?.invite?.trim() || query?.inviteMatchmakerId?.trim();
    const inv = query?.inv?.trim();
    if (!mm && !inv) return;

    // 已有未过期的红娘归属就不覆盖：先到先得是业务规则，
    // 用户中途点了别的红娘的分享不该把原归属冲掉。
    const cur = this.get();
    if (cur?.mm && mm) return;

    uni.setStorageSync(K.invite, { mm: mm || cur?.mm, inv: inv || cur?.inv, at: Date.now() } as InviteInfo);
  },

  clear(): void {
    uni.removeStorageSync(K.invite);
  },
};
