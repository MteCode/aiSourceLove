<script setup lang="ts">
defineProps<{ title?: string }>();
</script>

<template>
  <view class="yq-card">
    <view v-if="title || $slots.extra" class="head">
      <text class="title">{{ title }}</text>
      <slot name="extra" />
    </view>
    <slot />
  </view>
</template>

<style lang="scss" scoped>
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.title {
  font-size: 30rpx;
  font-weight: 600;
}
</style>
