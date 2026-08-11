<template>
  <div class="page-card">
    <div v-if="$slots.toolbar || title" class="table-toolbar">
      <span class="title">{{ title }}</span>
      <div><slot name="toolbar" /></div>
    </div>

    <el-table v-loading="loading" :data="rows" stripe border :row-key="rowKey" style="width: 100%">
      <slot />
      <template #empty>
        <el-empty :description="emptyText" :image-size="80" />
      </template>
    </el-table>

    <div class="pagination-bar">
      <el-pagination
        :current-page="page"
        :page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @current-change="$emit('page-change', $event)"
        @size-change="$emit('size-change', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
/** 表格 + 分页的壳，列通过默认插槽传入 */
withDefaults(
  defineProps<{
    rows: unknown[];
    total: number;
    page: number;
    pageSize: number;
    loading?: boolean;
    title?: string;
    rowKey?: string;
    emptyText?: string;
  }>(),
  { loading: false, title: '', rowKey: 'id', emptyText: '暂无数据' },
);

defineEmits<{ 'page-change': [page: number]; 'size-change': [size: number] }>();
</script>
