import type { App, Directive } from 'vue';
import { useUserStore } from '@/stores';

/**
 * 按钮级鉴权：v-perm="'profile:audit'" 或 v-perm="['a','b']"（任一即可）。
 *
 * 没权限直接把元素从 DOM 摘掉，而不是置灰——
 * 置灰的按钮会让用户以为「找运营开一下就能点」，摘掉更干净。
 */
const perm: Directive<HTMLElement, string | string[]> = {
  mounted(el, binding) {
    const store = useUserStore();
    if (!store.can(binding.value)) {
      el.parentNode?.removeChild(el);
    }
  },
};

export function setupDirectives(app: App): void {
  app.directive('perm', perm);
}
