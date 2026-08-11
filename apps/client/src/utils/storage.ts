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

export const inviteStore = {
  get(): string {
    return uni.getStorageSync(K.invite) || '';
  },
  set(id: string): void {
    if (id) uni.setStorageSync(K.invite, id);
  },
  clear(): void {
    uni.removeStorageSync(K.invite);
  },
};
