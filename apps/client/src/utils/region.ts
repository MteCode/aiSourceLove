import { systemApi } from '@/api';

/**
 * 行政区划树。
 *
 * 字段名跟着接口走：后端返回的是 value/label（给级联选择器用的形状），
 * 不是 code/name——按直觉写成 code/name 会静默拿到 undefined，
 * 表现是选择器里一片空白，很难查。
 */
export interface RegionNode {
  value: string;
  label: string;
  children?: RegionNode[];
}

/**
 * 模块级缓存：一个表单里「常住城市」和「籍贯」都是 REGION 字段，
 * 不缓存就各拉一次；这份数据一次会话内不会变。
 * 缓存的是 promise 而不是结果，两个字段同时挂载时才不会并发拉两遍。
 */
let cache: Promise<RegionNode[]> | null = null;

export function loadRegionTree(): Promise<RegionNode[]> {
  if (!cache) {
    cache = systemApi.regionTree().then(
      (r) => r as unknown as RegionNode[],
      (e) => {
        cache = null; // 失败不缓存，下次进页面还能重试
        throw e;
      },
    );
  }
  return cache;
}
