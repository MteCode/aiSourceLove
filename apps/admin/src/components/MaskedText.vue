<template>
  <span v-if="locked" class="masked">
    <el-icon><Lock /></el-icon>
    <span>{{ display }}</span>
  </span>
  <span v-else>{{ display }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { isMaskedValue, plain } from '@/utils/format';

/**
 * 展示可能被脱敏的字段。
 * 后端对没权限的字段下发的是 MaskedValue，直接渲染会变成 [object Object]。
 */
const props = defineProps<{ value?: unknown }>();

const locked = computed(() => isMaskedValue(props.value));
const display = computed(() => plain(props.value));
</script>

<style scoped>
.masked {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--yq-text-secondary);
}
</style>
