<template>
  <el-cascader
    :model-value="modelValue"
    :options="app.regions"
    :props="cascaderProps"
    :placeholder="placeholder"
    clearable
    filterable
    @update:model-value="onChange"
  />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useAppStore } from '@/stores';

/** 省市联动。区划树全站只拉一次，缓存在 app store */
withDefaults(defineProps<{ modelValue?: string[]; placeholder?: string }>(), {
  modelValue: () => [],
  placeholder: '请选择地区',
});

const emit = defineEmits<{
  'update:modelValue': [value: string[]];
  /** 末级 adcode，大多数查询只需要这个 */
  change: [cityCode: string | undefined];
}>();

const app = useAppStore();

const cascaderProps = { value: 'code', label: 'name', children: 'children', checkStrictly: true };

function onChange(v: unknown): void {
  const arr = (v as string[] | null) ?? [];
  emit('update:modelValue', arr);
  emit('change', arr.length ? arr[arr.length - 1] : undefined);
}

onMounted(() => {
  void app.loadRegions();
});
</script>
