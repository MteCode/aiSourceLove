<script setup lang="ts">
import { goVip } from '@/utils/feature';
import { onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import type { ProfileBriefDto } from '@yuanqiao/shared';
import { ApiError, profileApi } from '@/api';
import { useUserStore } from '@/stores/user';
import { fromNow } from '@/utils/format';

/** 「谁看过我」是 VIP 专属，非会员看到的是引导页而不是空列表 */
const user = useUserStore();
const list = ref<{ profile: ProfileBriefDto; viewedAt: string }[]>([]);
const denied = ref(false);

onShow(async () => {
  try {
    list.value = await profileApi.visitors();
    denied.value = false;
  } catch (e) {
    denied.value = (e as ApiError).code !== -1;
  }
});

function open(id: string): void {
  uni.navigateTo({ url: `/pages/profile/detail?id=${id}` });
}

/** 模板里访问不到 uni，跳转统一走包装函数 */
function goto(url: string): void {
  uni.navigateTo({ url });
}
</script>

<template>
  <view class="yq-page">
    <yq-empty v-if="denied || !user.isVip" icon="👀" text="「谁看过我」是会员专属功能">
      <text class="tip yq-muted">开通后可以看到最近谁浏览过你的资料</text>
      <button class="btn" @tap="goVip">去开通会员</button>
    </yq-empty>

    <template v-else>
      <view v-for="v in list" :key="v.profile.id + v.viewedAt" class="item" @tap="open(v.profile.id)">
        <image v-if="v.profile.avatarUrl" class="avatar" :src="v.profile.avatarUrl" mode="aspectFill" />
        <view v-else class="avatar avatar--empty">{{ v.profile.displayName?.[0] || '?' }}</view>
        <view class="info">
          <text class="name">{{ v.profile.displayName }}</text>
          <text class="meta yq-muted">
            {{ v.profile.age }}岁 · {{ v.profile.cityName || '城市未填' }}
          </text>
        </view>
        <text class="time yq-muted">{{ fromNow(v.viewedAt) }}</text>
      </view>

      <yq-empty v-if="!list.length" icon="👀" text="还没有人看过你的资料" />
    </template>
  </view>
</template>

<style lang="scss" scoped>
.item {
  display: flex;
  align-items: center;
  margin: 16rpx 20rpx;
  padding: 20rpx;
  background: $yq-surface;
  border-radius: $yq-radius;
}

.avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 12rpx;
  flex-shrink: 0;
}

.avatar--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: $yq-primary-light;
  color: $yq-primary;
  font-size: 40rpx;
}

.info {
  flex: 1;
  padding: 0 20rpx;
}

.name {
  font-size: 30rpx;
  font-weight: 600;
}

.meta {
  display: block;
  margin-top: 6rpx;
  font-size: 23rpx;
}

.time {
  font-size: 22rpx;
}

.tip {
  margin-top: 10rpx;
  font-size: 24rpx;
}

.btn {
  margin-top: 30rpx;
  padding: 0 60rpx;
  background: $yq-primary;
  color: $yq-on-primary;
  border-radius: 40rpx;
  font-size: 28rpx;
  line-height: 76rpx;
}
</style>
