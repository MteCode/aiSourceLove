<script setup lang="ts">
import { useUserStore } from '@/stores/user';
import { confirm, toast } from '@/utils/ui';

const user = useUserStore();

async function logout(): Promise<void> {
  if (!(await confirm('确定退出登录吗？'))) return;
  await user.logout();
  uni.reLaunch({ url: '/pages/login/index' });
}

function clearCache(): void {
  // 只清业务缓存，token 不动——清了会莫名其妙被登出
  uni.removeStorageSync('yq_square_cache');
  toast('缓存已清理');
}
</script>

<template>
  <view class="yq-page">
    <view class="yq-card">
      <view class="row">
        <text>账号</text>
        <text class="yq-muted">{{ user.user?.phone || '未登录' }}</text>
      </view>
      <view class="row" @tap="clearCache">
        <text>清理缓存</text>
        <text class="arrow">›</text>
      </view>
    </view>

    <view class="yq-card">
      <view class="row" @tap="logout">
        <text class="yq-danger">退出登录</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 26rpx 0;
  border-bottom: 1rpx solid $yq-border;
  font-size: 28rpx;
}

.row:last-child {
  border-bottom: none;
}

.arrow {
  color: $yq-text-secondary;
}
</style>
