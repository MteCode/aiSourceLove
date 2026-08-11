import { reactive, ref, onMounted } from 'vue';
import type { PageResult } from '@yuanqiao/shared';

/**
 * 分页表格的通用逻辑。
 *
 * 12 个列表页都是「查询表单 + 分页 + 表格」这一套，
 * 抽出来后每个页面只剩查询条件和列定义。
 */
export function usePagedTable<Row, Query extends Record<string, unknown>>(
  fetcher: (query: Query & { page: number; pageSize: number }) => Promise<PageResult<Row>>,
  initialQuery: Query,
  options?: { pageSize?: number; immediate?: boolean },
) {
  const loading = ref(false);
  const rows = ref<Row[]>([]) as { value: Row[] };
  const total = ref(0);
  const page = ref(1);
  const pageSize = ref(options?.pageSize ?? 20);
  const query = reactive({ ...initialQuery }) as Query;

  async function load(): Promise<void> {
    loading.value = true;
    try {
      const res = await fetcher({ ...(query as Query), page: page.value, pageSize: pageSize.value });
      rows.value = res.list;
      total.value = res.total;
    } finally {
      loading.value = false;
    }
  }

  /** 查询条件变了要回第一页，否则会出现「第 5 页没数据」的空白 */
  function search(): void {
    page.value = 1;
    void load();
  }

  function reset(): void {
    Object.assign(query, initialQuery);
    // 清掉初始值里没有、后来才加上的键
    for (const k of Object.keys(query)) {
      if (!(k in initialQuery)) delete (query as Record<string, unknown>)[k];
    }
    search();
  }

  function onPageChange(p: number): void {
    page.value = p;
    void load();
  }

  function onSizeChange(s: number): void {
    pageSize.value = s;
    page.value = 1;
    void load();
  }

  if (options?.immediate !== false) {
    onMounted(() => void load());
  }

  return { loading, rows, total, page, pageSize, query, load, search, reset, onPageChange, onSizeChange };
}
