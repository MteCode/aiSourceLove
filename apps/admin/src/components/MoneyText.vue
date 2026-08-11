<template>
  <span :class="['mono', colorClass]">{{ prefix }}{{ text }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { fen2yuan } from '@/utils/format';

/** 后端金额单位一律是「分」，展示统一走这个组件，杜绝有的页面除 100 有的没除 */
const props = withDefaults(
  defineProps<{
    /** 金额，单位分 */
    value?: number | null;
    /** 正数显示绿色、负数红色 */
    colored?: boolean;
    prefix?: string;
  }>(),
  { value: null, colored: false, prefix: '¥ ' },
);

const text = computed(() => fen2yuan(props.value));
const colorClass = computed(() => {
  if (!props.colored || props.value == null) return '';
  return props.value >= 0 ? 'text-success' : 'text-danger';
});
</script>
