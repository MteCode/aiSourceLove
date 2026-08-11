<template>
  <div class="stat-card">
    <div class="icon" :style="{ background: color + '18', color }">
      <el-icon :size="20"><component :is="icon" /></el-icon>
    </div>
    <div class="body">
      <div class="label">{{ label }}</div>
      <div class="value">
        {{ value }}<span v-if="unit" class="unit">{{ unit }}</span>
      </div>
      <div v-if="sub" class="sub text-muted">{{ sub }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    value: string | number;
    icon: string;
    color?: string;
    unit?: string;
    sub?: string;
  }>(),
  { color: '#e05a7d', unit: '', sub: '' },
);
</script>

<style scoped>
.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgb(0 0 0 / 4%);
}

.icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  flex-shrink: 0;
}

.label {
  font-size: 13px;
  color: var(--yq-text-secondary);
}

.value {
  margin-top: 2px;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.2;
}

.unit {
  margin-left: 3px;
  font-size: 13px;
  font-weight: 400;
  color: var(--yq-text-secondary);
}

.sub {
  margin-top: 2px;
  font-size: 12px;
}
</style>
