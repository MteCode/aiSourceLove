<template>
  <div class="side-card">
    <div class="head">
      <el-tag size="small" effect="dark">{{ side }} 方</el-tag>
      <el-tag :type="agreed ? 'success' : 'info'" size="small">
        {{ agreed ? '已同意' : '待表态' }}
      </el-tag>
    </div>
    <div class="body">
      <el-avatar :size="44" shape="square" :src="profile.avatarUrl || undefined">
        {{ profile.displayName?.[0] ?? '?' }}
      </el-avatar>
      <div>
        <div class="name">
          {{ profile.displayName }}
          <DictTag dict="gender" :value="profile.gender" />
        </div>
        <div class="text-muted">
          {{ profile.age }} 岁 ·
          {{ profile.heightCm ? `${profile.heightCm}cm` : '身高未填' }} ·
          {{ profile.cityName ?? '未填城市' }}
        </div>
        <div class="text-muted mono">{{ profile.serialNo }}</div>
      </div>
    </div>
    <el-button link type="primary" @click="$router.push(`/member/detail/${profile.id}`)">查看资料</el-button>
  </div>
</template>

<script setup lang="ts">
import type { ProfileBriefDto } from '@yuanqiao/shared';
import DictTag from '@/components/DictTag.vue';

defineProps<{ side: 'A' | 'B'; profile: ProfileBriefDto; agreed: boolean }>();
</script>

<style scoped>
.side-card {
  padding: 12px;
  border: 1px solid var(--yq-border);
  border-radius: 8px;
}

.head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}

.body {
  display: flex;
  gap: 10px;
  font-size: 12px;
  line-height: 1.6;
}

.body .name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
}
</style>
