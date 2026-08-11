<template>
  <el-breadcrumb separator="/">
    <el-breadcrumb-item v-for="(item, i) in items" :key="i">{{ item }}</el-breadcrumb-item>
  </el-breadcrumb>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

/** matched 里带 title 的层级就是面包屑，布局路由没 title 会被自然跳过 */
const items = computed(() =>
  route.matched.map((r) => r.meta?.title).filter((t): t is string => !!t),
);
</script>
