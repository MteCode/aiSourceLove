import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { RegionNode } from '@/api';
import { systemApi } from '@/api';

const SIDEBAR_KEY = 'yq_admin_sidebar_collapsed';

export const useAppStore = defineStore('app', () => {
  const collapsed = ref(localStorage.getItem(SIDEBAR_KEY) === '1');
  /** 行政区划树全站共用，懒加载一次就够 */
  const regions = ref<RegionNode[]>([]);
  let regionLoading: Promise<RegionNode[]> | null = null;

  function toggleSidebar(): void {
    collapsed.value = !collapsed.value;
    localStorage.setItem(SIDEBAR_KEY, collapsed.value ? '1' : '0');
  }

  async function loadRegions(): Promise<RegionNode[]> {
    if (regions.value.length) return regions.value;
    // 并发调用只发一次请求
    regionLoading ??= systemApi.regionTree().then((tree) => {
      regions.value = tree;
      return tree;
    });
    try {
      return await regionLoading;
    } catch (e) {
      regionLoading = null;
      throw e;
    }
  }

  return { collapsed, regions, toggleSidebar, loadRegions };
});
