<template>
  <el-select
    :model-value="modelValue"
    :placeholder="placeholder"
    filterable
    remote
    clearable
    :remote-method="search"
    :loading="loading"
    style="width: 100%"
    @update:model-value="onChange"
  >
    <el-option v-for="p in options" :key="p.id" :label="labelOf(p)" :value="p.id">
      <div class="opt">
        <span>{{ p.displayName }}</span>
        <span class="text-muted">
          {{ GENDER_LABEL[p.gender] }} · {{ p.age }}岁 · {{ p.cityName ?? '未填城市' }} ·
          <span class="mono">{{ p.serialNo }}</span>
        </span>
      </div>
    </el-option>
  </el-select>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { GENDER_LABEL, ProfileStatus, type Gender, type ProfileBriefDto } from '@yuanqiao/shared';
import { profileApi } from '@/api';

/** 会员搜索选择器。只查已通过的——草稿/待审的不该参与匹配 */
const props = withDefaults(
  defineProps<{ modelValue?: string; placeholder?: string; gender?: Gender }>(),
  { modelValue: '', placeholder: '搜索姓名 / 编号 / 手机号' },
);
const emit = defineEmits<{ 'update:modelValue': [v: string]; change: [p: ProfileBriefDto | undefined] }>();

const loading = ref(false);
const options = ref<ProfileBriefDto[]>([]);

function labelOf(p: ProfileBriefDto): string {
  return `${p.displayName}（${p.serialNo}）`;
}

async function search(keyword?: string): Promise<void> {
  loading.value = true;
  try {
    const res = await profileApi.list({
      keyword: keyword || undefined,
      status: ProfileStatus.APPROVED,
      gender: props.gender,
      page: 1,
      pageSize: 20,
    });
    options.value = res.list;
  } finally {
    loading.value = false;
  }
}

function onChange(v: unknown): void {
  const id = (v as string) ?? '';
  emit('update:modelValue', id);
  emit('change', options.value.find((p) => p.id === id));
}

onMounted(() => void search());
</script>

<style scoped>
.opt {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}
</style>
