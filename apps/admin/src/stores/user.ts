import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { CurrentUser } from '@yuanqiao/shared';
import { RoleCode } from '@yuanqiao/shared';
import { authApi, profileApi } from '@/api';
import { tokenStore } from '@/utils/storage';

export const useUserStore = defineStore('user', () => {
  const user = ref<CurrentUser | null>(null);
  /** 侧栏待审角标 */
  const pending = ref({ profilePending: 0, photoPending: 0 });

  const logged = computed(() => !!tokenStore.access);
  const permissions = computed(() => new Set(user.value?.permissions ?? []));
  const roles = computed(() => user.value?.roles ?? []);
  const isSuperAdmin = computed(() => roles.value.includes(RoleCode.SUPER_ADMIN));

  /**
   * 权限判定。超管直通——后端 guard 也是这么放行的，两边必须一致，
   * 否则会出现「菜单看得到、接口 403」的割裂体验。
   */
  function can(code?: string | string[]): boolean {
    if (!code) return true;
    if (isSuperAdmin.value) return true;
    const list = Array.isArray(code) ? code : [code];
    return list.some((c) => permissions.value.has(c));
  }

  function hasRole(code: string): boolean {
    return roles.value.includes(code);
  }

  async function login(username: string, password: string): Promise<void> {
    const res = await authApi.passwordLogin(username, password);
    tokenStore.set(res.accessToken, res.refreshToken);
    user.value = res.user;
  }

  async function loadMe(): Promise<CurrentUser> {
    const me = await authApi.me();
    user.value = me;
    return me;
  }

  /** 刷新待审角标；没有审核权限的账号直接跳过，避免刷 403 日志 */
  async function loadPending(): Promise<void> {
    if (!can('profile:audit')) return;
    try {
      pending.value = await profileApi.pendingCount();
    } catch {
      // 角标失败无所谓，不打扰用户
    }
  }

  function reset(): void {
    user.value = null;
    pending.value = { profilePending: 0, photoPending: 0 };
    tokenStore.clear();
  }

  async function logout(): Promise<void> {
    try {
      await authApi.logout();
    } catch {
      // 服务端登出失败不影响本地清态
    }
    reset();
  }

  return { user, pending, logged, roles, isSuperAdmin, can, hasRole, login, loadMe, loadPending, logout, reset };
});
