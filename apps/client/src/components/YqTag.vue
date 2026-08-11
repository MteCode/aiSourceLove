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
  background: #f0f9eb;
  color: $yq-success;
}

.tag--warning {
  background: #fdf6ec;
  color: $yq-warning;
}

.tag--danger {
  background: #fef0f0;
  color: $yq-danger;
}

.tag--info {
  background: #f4f4f5;
  color: $yq-text-secondary;
}

.tag--plain {
  background: transparent;
  border: 1rpx solid currentColor;
}
</style>
