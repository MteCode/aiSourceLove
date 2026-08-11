<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { RESET_CYCLE_LABEL, type UserBenefitDto } from '@yuanqiao/shared';
import { vipApi } from '@/api';
import { useUserStore } from '@/stores/user';
import { formatDate } from '@/utils/format';
import { hideLoading, loading } from '@/utils/ui';

const user = useUserStore();
const benefits = ref<UserBenefitDto[]>([]);

async function load(): Promise<void> {
  loading();
  try {
    benefits.value = await vipApi.myBenefits();
  } finally {
    hideLoading();
  }
}

function ratio(b: UserBenefitDto): number {
  if (!b.total) return 0;
  return Math.round((b.remaining / b.total) * 100);
}

onShow(load);
</script>

<template>
  <view class="yq-page">
    <view class="head">
      <text class="status">{{ user.isVip ? '会员生效中' : '未开通会员' }}</text>
      <text v-if="user.isVip" class="expire">有效期至 {{ formatDate(user.user?.vipExpireAt) }}</text>
      <button v-else class="head-btn" @tap="() => uni.navigateTo({ url: '/pages/vip/index' })">去开通</button>
    </view>

    <view class="yq-card">
      <view v-for="b in benefits" :key="b.code" class="item">
        <view class="yq-between">
          <text class="name">{{ b.label }}</text>
          <text class="count">
            <text class="remain">{{ b.remaining }}</text>
            <text class="total yq-muted"> / {{ b.total }} {{ b.unit }}</text>
          </text>
        </view>
        <view class="bar">
          <view class="bar-fill" :style="{ width: ratio(b) + '%' }" />
        </view>
        <view class="yq-between meta">
          <text class="yq-muted">{{ RESET_CYCLE_LABEL[b.cycle] }}</text>
          <text v-if="b.resetAt" class="yq-muted">{{ formatDate(b.resetAt, true) }} 重置</text>
          <text v-else-if="b.expireAt" class="yq-muted">{{ formatDate(b.expireAt) }} 到期</text>
        </view>
      </view>

      <yq-empty v-if="!benefits.length" icon="🎫" text="还没有任何权益">
        <button class="empty-btn" @tap="() => uni.navigateTo({ url: '/pages/vip/index' })">去开通会员</button>
      </yq-empty>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.head {
  padding: 40rpx;
  background: linear-gradient(120deg, #e05a7d, #f0a0b6);
  color: #fff;
}

.status {
  display: block;
  font-size: 36rpx;
  font-weight: 600;
}

.expire {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  opacity: 0.9;
}

.head-btn {
  display: inline-block;
  margin-top: 20rpx;
  padding: 0 40rpx;
  background: #fff;
  color: $yq-primary;
  border-radius: 32rpx;
  font-size: 26rpx;
  line-height: 64rpx;
}

.item {
  padding: 24rpx 0;
  border-bottom: 1rpx solid $yq-border;
}

.item:last-child {
  border-bottom: none;
}

.name {
  font-size: 28rpx;
}

.remain {
  color: $yq-primary;
  font-size: 32rpx;
  font-weight: 700;
}

.total {
  font-size: 22rpx;
}

.bar {
  height: 12rpx;
  margin: 14rpx 0 10rpx;
  background: $yq-bg;
  border-radius: 6rpx;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: $yq-primary;
}

.meta {
  font-size: 22rpx;
}

.empty-btn {
  margin-top: 30rpx;
  padding: 0 60rpx;
  background: $yq-primary;
  color: #fff;
  border-radius: 40rpx;
  font-size: 28rpx;
  line-height: 76rpx;
}
</style>
