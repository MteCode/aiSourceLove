<template>
  <div ref="el" :style="{ height }"></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';

/** ECharts 薄封装：负责实例生命周期和自适应，图表配置由调用方给 */
const props = withDefaults(defineProps<{ option: echarts.EChartsOption; height?: string }>(), {
  height: '320px',
});

const el = ref<HTMLElement>();
let chart: echarts.ECharts | null = null;
let observer: ResizeObserver | null = null;

onMounted(() => {
  if (!el.value) return;
  chart = echarts.init(el.value);
  chart.setOption(props.option);
  // 侧栏折叠会改变容器宽度，监听容器而不是 window 才靠谱
  observer = new ResizeObserver(() => chart?.resize());
  observer.observe(el.value);
});

watch(
  () => props.option,
  (opt) => chart?.setOption(opt, true),
  { deep: true },
);

onBeforeUnmount(() => {
  observer?.disconnect();
  chart?.dispose();
  chart = null;
});
</script>
