<script setup lang="ts">
withDefaults(defineProps<{ text?: string; icon?: string }>(), { text: '暂无数据', icon: '🌱' });
</script>

<template>
  <view class="empty">
    <text class="icon">{{ icon }}</text>
    <text class="text">{{ text }}</text>
    <slot />
  </view>
</template>

<style lang="scss" scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 40rpx;
}

.icon {
  font-size: 80rpx;
}

.text {
  margin-top: 20rpx;
  color: $yq-text-secondary;
  font-size: 26rpx;
}
</style>
