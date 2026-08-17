<script setup lang="ts">
withDefaults(defineProps<{ text?: string; icon?: string; retryable?: boolean }>(), {
  text: '暂无数据',
  icon: '🌱',
  retryable: false,
});
defineEmits<{ retry: [] }>();
</script>

<template>
  <view class="empty">
    <text class="icon">{{ icon }}</text>
    <text class="text">{{ text }}</text>
    <!-- 加载失败要能自己重试。让用户杀掉小程序重进才能刷新是很糟的体验 -->
    <text v-if="retryable" class="retry" @tap="$emit('retry')">点击重试</text>
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

.retry {
  margin-top: 20rpx;
  padding: 12rpx 40rpx;
  font-size: 26rpx;
  color: #e05a7d;
  border: 1rpx solid #e05a7d;
  border-radius: 32rpx;
}
</style>
