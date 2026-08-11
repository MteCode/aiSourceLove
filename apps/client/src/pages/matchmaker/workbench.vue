<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { INTRODUCTION_STATUS_LABEL, type MatchmakerStatsDto } from '@yuanqiao/shared';
import { matchmakerApi } from '@/api';
import { fen2yuan } from '@/utils/format';
import { hideLoading, loading, navigateTo } from '@/utils/ui';

const stats = ref<MatchmakerStatsDto | null>(null);

async function load(): Promise<void> {
  loading();
  try {
    stats.value = await matchmakerApi.myStats();
  } finally {
    hideLoading();
  }
}

/** 漏斗每一层按最大值归一化画条形，比堆数字直观 */
function barWidth(count: number): string {
  const max = Math.max(...(stats.value?.funnel ?? []).map((f) => f.count), 1);
  return `${Math.round((count / max) * 100)}%`;
}

onShow(load);

function gotoTab(url: string): void {
  uni.switchTab({ url });
}
</script>

<template>
  <view class="yq-page">
    <view class="head">
      <view class="head-item">
        <text class="num">{{ stats?.memberCount ?? 0 }}</text>
        <text class="label">名下会员</text>
        <text class="sub">本月 +{{ stats?.memberCountThisMonth ?? 0 }}</text>
      </view>
      <view class="head-item">
        <text class="num">{{ stats?.introCount ?? 0 }}</text>
        <text class="label">累计牵线</text>
        <text class="sub">本月 +{{ stats?.introCountThisMonth ?? 0 }}</text>
      </view>
      <view class="head-item">
        <text class="num">{{ stats?.successCount ?? 0 }}</text>
        <text class="label">成功撮合</text>
        <text class="sub">成功率 {{ Math.round((stats?.successRate ?? 0) * 100) }}%</text>
      </view>
    </view>

    <view class="yq-card money">
      <view class="money-row">
        <view class="money-item">
          <text class="money-num">¥{{ fen2yuan(stats?.availableBalance) }}</text>
          <text class="money-label yq-muted">可提现</text>
        </view>
        <view class="money-item">
          <text class="money-num money-num--sm">¥{{ fen2yuan(stats?.pendingCommission) }}</text>
          <text class="money-label yq-muted">待结算</text>
        </view>
        <view class="money-item">
          <text class="money-num money-num--sm">¥{{ fen2yuan(stats?.totalCommission) }}</text>
          <text class="money-label yq-muted">累计收益</text>
        </view>
      </view>
      <button class="money-btn" @tap="navigateTo('/pages/matchmaker/commission')">收益明细与提现</button>
    </view>

    <view class="actions">
      <view class="action" @tap="navigateTo('/pages/matchmaker/members')">
        <text class="action-icon">👥</text>
        <text class="action-text">我的会员</text>
      </view>
      <view class="action" @tap="navigateTo('/pages/matchmaker/create-intro')">
        <text class="action-icon">🔗</text>
        <text class="action-text">发起牵线</text>
      </view>
      <view class="action" @tap="gotoTab('/pages/intro/list')">
        <text class="action-icon">📋</text>
        <text class="action-text">牵线记录</text>
      </view>
      <view class="action" @tap="navigateTo('/pages/matchmaker/apply')">
        <text class="action-icon">⚙️</text>
        <text class="action-text">我的资料</text>
      </view>
    </view>

    <yq-card title="牵线漏斗">
      <view v-for="f in stats?.funnel ?? []" :key="f.status" class="funnel">
        <text class="f-label">{{ f.label || INTRODUCTION_STATUS_LABEL[f.status] }}</text>
        <view class="f-bar">
          <view class="f-fill" :style="{ width: barWidth(f.count) }" />
        </view>
        <text class="f-count">{{ f.count }}</text>
      </view>
      <yq-empty v-if="!stats?.funnel?.length" icon="📊" text="还没有牵线数据" />
    </yq-card>
  </view>
</template>

<style lang="scss" scoped>
.head {
  display: flex;
  padding: 40rpx 20rpx;
  background: linear-gradient(120deg, #e05a7d, #f0a0b6);
  color: #fff;
}

.head-item {
  flex: 1;
  text-align: center;
}

.num {
  display: block;
  font-size: 46rpx;
  font-weight: 700;
  line-height: 1.2;
}

.label {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
}

.sub {
  display: block;
  margin-top: 4rpx;
  font-size: 20rpx;
  opacity: 0.85;
}

.money {
  margin-top: -20rpx;
}

.money-row {
  display: flex;
}

.money-item {
  flex: 1;
  text-align: center;
}

.money-num {
  display: block;
  color: $yq-primary;
  font-size: 38rpx;
  font-weight: 700;
}

.money-num--sm {
  color: $yq-text;
  font-size: 30rpx;
}

.money-label {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
}

.money-btn {
  margin-top: 24rpx;
  background: $yq-primary;
  color: #fff;
  border-radius: 40rpx;
  font-size: 28rpx;
  line-height: 76rpx;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  margin: 20rpx;
  padding: 20rpx 0;
  background: #fff;
  border-radius: $yq-radius;
}

.action {
  width: 25%;
  padding: 16rpx 0;
  text-align: center;
}

.action-icon {
  display: block;
  font-size: 48rpx;
}

.action-text {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
}

.funnel {
  display: flex;
  align-items: center;
  padding: 14rpx 0;
}

.f-label {
  width: 180rpx;
  font-size: 24rpx;
}

.f-bar {
  flex: 1;
  height: 24rpx;
  margin: 0 16rpx;
  background: $yq-bg;
  border-radius: 12rpx;
  overflow: hidden;
}

.f-fill {
  height: 100%;
  background: $yq-primary;
  border-radius: 12rpx;
}

.f-count {
  width: 60rpx;
  font-size: 24rpx;
  text-align: right;
}
</style>
