<script setup lang="ts">
import { onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { INTRODUCTION_STATUS_LABEL, type MatchmakerStatsDto } from '@yuanqiao/shared';
import { matchmakerApi } from '@/api';
import { useUserStore } from '@/stores/user';
import { fen2yuan } from '@/utils/format';
import { hideLoading, loading, navigateTo } from '@/utils/ui';

const stats = ref<MatchmakerStatsDto | null>(null);
const user = useUserStore();

/**
 * 分享链接带上自己的红娘 id，客户注册时自动挂到名下。
 *
 * 落地页选登录页而不是广场：从分享进来的多半是新用户，
 * 直接给广场他会先看到一堆"登录后可见"，反而流失。
 * 参数名用 mm，短一点——小程序码里的 query 有长度限制。
 */
function sharePath(): string {
  const id = user.user?.matchmakerId ?? '';
  return id ? `/pages/login/index?mm=${id}` : '/pages/login/index';
}

onShareAppMessage(() => ({
  title: '缘桥 · 认真的人，值得被认真对待',
  path: sharePath(),
}));

// 分享到朋友圈，安卓微信支持
onShareTimeline(() => ({
  title: '缘桥 · 认真的人，值得被认真对待',
  query: user.user?.matchmakerId ? `mm=${user.user.matchmakerId}` : '',
}));

/**
 * 主动唤起分享面板。
 * 小程序不允许代码直接调起转发，只能由 button open-type=share 触发，
 * 所以这里只负责在没配好时给出可读的提示，真正的转发在模板里。
 */
function onShareTap(): void {
  if (!user.user?.matchmakerId) {
    uni.showModal({ title: '暂不可用', content: '红娘身份审核通过后才能分享拉新。', showCancel: false });
  }
}

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
    <!-- 拉新入口。小程序禁止代码直接调起转发，必须用 open-type="share" 的 button -->
    <view class="share-card">
      <view class="share-text">
        <text class="share-title">邀请客户加入</text>
        <text class="share-sub">通过你分享的链接注册的客户，自动归到你名下</text>
      </view>
      <button class="share-btn" open-type="share" @tap="onShareTap">分享给客户</button>
    </view>

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
.share-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 20rpx;
  padding: 28rpx;
  background: linear-gradient(135deg, #e05a7d 0%, #e87492 100%);
  border-radius: $yq-radius;
}

.share-title {
  display: block;
  color: #fff;
  font-size: 32rpx;
  font-weight: 600;
}

.share-sub {
  display: block;
  margin-top: 8rpx;
  color: rgba(255, 255, 255, 0.85);
  font-size: 24rpx;
}

.share-btn {
  flex-shrink: 0;
  margin: 0 0 0 20rpx;
  padding: 0 28rpx;
  height: 64rpx;
  line-height: 64rpx;
  font-size: 26rpx;
  color: #e05a7d;
  background: #fff;
  border-radius: 32rpx;

  &::after { border: none; }
}

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
