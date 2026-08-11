<script setup lang="ts">
import { onLaunch, onShow } from '@dcloudio/uni-app';
import { useUserStore } from '@/stores/user';

onLaunch(() => {
  // 冷启动先恢复登录态：有 token 就静默拉一次 me，
  // 失败（token 过期或被封）会自动清态，由各页面的守卫引导去登录
  const user = useUserStore();
  void user.restore();
});

onShow(() => {
  const user = useUserStore();
  if (user.logged) void user.refreshQuietly();
});
</script>

<template>
  <router-view v-if="false" />
</template>

<style lang="scss">
page {
  background: $yq-bg;
  color: $yq-text;
  font-size: 28rpx;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif;
}

/* 通用原子类，避免每个页面重复写 */
.yq-page {
  min-height: 100vh;
  padding-bottom: env(safe-area-inset-bottom);
}

.yq-card {
  margin: 20rpx;
  padding: 24rpx;
  background: #fff;
  border-radius: $yq-radius;
}

.yq-muted {
  color: $yq-text-secondary;
}

.yq-danger {
  color: $yq-danger;
}

.yq-success {
  color: $yq-success;
}

.yq-row {
  display: flex;
  align-items: center;
}

.yq-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.yq-ellipsis {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
