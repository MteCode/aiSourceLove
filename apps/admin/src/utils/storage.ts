/** token 与登录态的本地存储。key 加前缀，避免和同域其它应用打架。 */
const PREFIX = 'yq_admin_';

const K = {
  access: `${PREFIX}access_token`,
  refresh: `${PREFIX}refresh_token`,
  username: `${PREFIX}remember_username`,
} as const;

export const tokenStore = {
  get access(): string {
    return localStorage.getItem(K.access) ?? '';
  },
  get refresh(): string {
    return localStorage.getItem(K.refresh) ?? '';
  },
  set(accessToken: string, refreshToken: string): void {
    localStorage.setItem(K.access, accessToken);
    localStorage.setItem(K.refresh, refreshToken);
  },
  clear(): void {
    localStorage.removeItem(K.access);
    localStorage.removeItem(K.refresh);
  },
};

export const rememberedUsername = {
  get(): string {
    return localStorage.getItem(K.username) ?? '';
  },
  set(v: string): void {
    if (v) localStorage.setItem(K.username, v);
    else localStorage.removeItem(K.username);
  },
};
