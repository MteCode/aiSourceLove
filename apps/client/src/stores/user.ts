import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { ProfileStatus, RoleCode, type CurrentUser } from '@yuanqiao/shared';
import { authApi, setUnauthorizedHandler } from '@/api';
import { inviteStore, tokenStore } from '@/utils/storage';
import { redirectTo, toast } from '@/utils/ui';

export const useUserStore = defineStore('user', () => {
  const user = ref<CurrentUser | null>(null);
  /** 冷启动恢复登录态是否已经跑完，页面守卫要等它 */
  const ready = ref(false);

  const logged = computed(() => !!tokenStore.access && !!user.value);
  const isVip = computed(() => !!user.value?.isVip);
  const isMatchmaker = computed(() => !!user.value?.matchmakerId || (user.value?.roles ?? []).includes(RoleCode.MATCHMAKER));
  const profileId = computed(() => user.value?.profileId ?? null);
  const profileStatus = computed(() => user.value?.profileStatus ?? null);
  /** 已通过审核才能被推荐、才能用匹配 */
  const profileApproved = computed(() => profileStatus.value === ProfileStatus.APPROVED);

  async function loginBySms(phone: string, code: string): Promise<void> {
    const invite = inviteStore.get();
    const res = await authApi.smsLogin(phone, code, invite?.mm, invite?.inv);
    tokenStore.set(res.accessToken, res.refreshToken);
    user.value = res.user;
    // 归属只在注册那一刻绑定，绑过就不该再留着
    inviteStore.clear();
  }

  async function loginByWx(): Promise<void> {
    const code = await new Promise<string>((resolve, reject) => {
      uni.login({
        provider: 'weixin',
        success: (res) => resolve(res.code),
        fail: () => reject(new Error('微信登录失败')),
      });
    });
    const res = await authApi.wxMiniLogin(code);
    tokenStore.set(res.accessToken, res.refreshToken);
    user.value = res.user;
    inviteStore.clear();
  }

  async function loadMe(): Promise<CurrentUser> {
    const me = await authApi.me();
    user.value = me;
    return me;
  }

  /**
   * 冷启动恢复：失败就当没登录，不打扰用户。
   *
   * 用 inflight 去重：App.onLaunch 会调一次，页面守卫发现还没 ready 时也会调，
   * 不去重就会同时打好几个 /auth/me。
   */
  let inflight: Promise<void> | null = null;

  function restore(): Promise<void> {
    if (inflight) return inflight;
    inflight = (async () => {
      if (!tokenStore.access) {
        ready.value = true;
        return;
      }
      try {
        await loadMe();
      } catch {
        reset();
      } finally {
        ready.value = true;
      }
    })().finally(() => {
      inflight = null;
    });
    return inflight;
  }

  /** 每次回到前台静默刷新，VIP 到期、审核结果这些要及时反映 */
  async function refreshQuietly(): Promise<void> {
    try {
      await loadMe();
    } catch {
      // 静默失败，让下一次真实操作去触发 401 流程
    }
  }

  function reset(): void {
    user.value = null;
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

  /** 页面级守卫：没登录就跳登录页并返回 false */
  /**
   * 页面守卫。
   *
   * 必须是异步的：冷启动时 App.onLaunch 里的 restore() 还在飞，
   * user 尚未加载完，而页面 onShow 已经跑到这儿了。
   * 只看 logged 会把「token 有效但还没恢复完」误判成未登录，
   * 把人一路弹回登录页——用户看到的现象是"明明注册成功了却进不去"。
   */
  /**
   * 页面守卫。判定以**票据**为准，不以内存里的用户信息为准。
   *
   * 原来用 logged（= 有票据 && 有用户信息）。用户信息要异步拉，
   * 于是"刚登录完、user 还没落到这个页面能看到的状态"就被判成未登录，
   * 一路弹回登录页——现象是"登录成功了却进不去"，而且时序敏感、时好时坏。
   *
   * 票据无效的情况不需要在这里判：restore() 拉不到 me 会 reset() 清票据，
   * 请求层遇到 401 也会清并跳登录。让那两条路径去处理，守卫只管放行。
   */
  async function requireLogin(): Promise<boolean> {
    if (!tokenStore.access) {
      redirectTo('/pages/login/index');
      return false;
    }

    // 有票据但还没拿到用户信息，补一次；失败会清票据
    if (!user.value) await restore();

    if (tokenStore.access) return true;

    redirectTo('/pages/login/index');
    return false;
  }

  /** 需要先有已通过的档案才能用的功能（匹配、被牵线） */
  async function requireProfile(): Promise<boolean> {
    if (!(await requireLogin())) return false;
    if (!profileId.value) {
      toast('请先完善你的资料');
      uni.navigateTo({ url: '/pages/profile/edit' });
      return false;
    }
    if (!profileApproved.value) {
      toast('资料审核通过后才能使用该功能');
      return false;
    }
    return true;
  }

  // token 彻底失效时统一踢回登录页
  setUnauthorizedHandler(() => {
    reset();
    redirectTo('/pages/login/index');
  });

  return {
    user,
    ready,
    logged,
    isVip,
    isMatchmaker,
    profileId,
    profileStatus,
    profileApproved,
    loginBySms,
    loginByWx,
    loadMe,
    restore,
    refreshQuietly,
    logout,
    reset,
    requireLogin,
    requireProfile,
  };
});
