<script setup lang="ts">
withDefaults(
  defineProps<{ type?: 'primary' | 'success' | 'warning' | 'danger' | 'info'; plain?: boolean }>(),
  { type: 'primary', plain: false },
);
</script>

<template>
  <text :class="['tag', `tag--${type}`, { 'tag--plain': plain }]">
    <slot />
  </text>
</template>

<style lang="scss" scoped>
.tag {
  display: inline-block;
  padding: 4rpx 14rpx;
  margin-right: 8rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
  line-height: 1.6;
}

.tag--primary {
  background: $yq-primary-light;
  color: $yq-primary;
}

.tag--success {
  background: rgba(74, 222, 128, 0.12);
  color: $yq-success;
}

.tag--warning {
  background: rgba(251, 191, 36, 0.12);
  color: $yq-warning;
}

.tag--danger {
  background: rgba(248, 113, 113, 0.12);
  color: $yq-danger;
}

.tag--info {
  background: rgba(255, 255, 255, 0.07);
  color: $yq-text-secondary;
}

.tag--plain {
  background: transparent;
  border: 1rpx solid currentColor;
}
</style>
