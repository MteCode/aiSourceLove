<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { computed, ref } from 'vue';
import { PROFILE_STATUS_LABEL, ProfileStatus } from '@yuanqiao/shared';
import { matchmakerApi } from '@/api';
import { useUserStore } from '@/stores/user';
import { formatDate } from '@/utils/format';
import { confirm, navigateTo } from '@/utils/ui';

const user = useUserStore();
const matchmakerStatus = ref<string>('');

const statusText = computed(() =>
  user.profileStatus ? PROFILE_STATUS_LABEL[user.profileStatus] : '未创建',
);

const statusTip = computed(() => {
  if (!user.profileId) return '完善资料后才能开始匹配';
  if (user.profileStatus === ProfileStatus.PENDING) return '审核中，通常 24 小时内完成';
  if (user.profileStatus === ProfileStatus.REJECTED) return '资料被驳回，点击查看原因并修改';
  if (user.profileStatus === ProfileStatus.OFFLINE) return '资料已下架，不会被推荐';
  return '资料已通过审核';
});

async function loadMatchmaker(): Promise<void> {
  if (!user.logged) return;
  try {
    const mm = await matchmakerApi.me();
    matchmakerStatus.value = mm?.status ?? '';
  } catch {
    matchmakerStatus.value = '';
  }
}

function go(url: string): void {
  if (!user.requireLogin()) return;
  navigateTo(url);
}

function goMatchmaker(): void {
  if (!user.requireLogin()) return;
  // 已通过入驻的进工作台，否则走申请流程
  if (matchmakerStatus.value === 'ACTIVE') navigateTo('/pages/matchmaker/workbench');
  else navigateTo('/pages/matchmaker/apply');
}

async function logout(): Promise<void> {
  if (!(await confirm('确定退出登录吗？'))) return;
  await user.logout();
  uni.reLaunch({ url: '/pages/login/index' });
}

onShow(() => {
  void user.refreshQuietly();
  void loadMatchmaker();
});
</script>

<template>
  <view class="yq-page">
    <!-- 头部 -->
    <view class="header">
      <view v-if="!user.logged" class="login-tip" @tap="() => uni.navigateTo({ url: '/pages/login/index' })">
        <view class="avatar avatar--empty">?</view>
        <view class="head-info">
          <text class="nick">点击登录</text>
          <text class="sub">登录后开始你的缘分之旅</text>
        </view>
      </view>

      <view v-else class="head-row">
        <image v-if="user.user?.avatar" class="avatar" :src="user.user.avatar" mode="aspectFill" />
        <view v-else class="avatar avatar--empty">{{ (user.user?.nickname || '缘')[0] }}</view>
        <view class="head-info">
          <view class="nick-row">
            <text class="nick">{{ user.user?.nickname || user.user?.phone }}</text>
            <yq-tag v-if="user.isVip" type="warning">VIP</yq-tag>
          </view>
          <text class="sub">{{ user.isVip ? `会员至 ${formatDate(user.user?.vipExpireAt)}` : '未开通会员' }}</text>
        </view>
      </view>
    </view>

    <!-- 资料状态 -->
    <view class="yq-card status-card" @tap="go('/pages/profile/edit')">
      <view class="yq-between">
        <text class="status-title">我的资料</text>
        <yq-tag :type="user.profileApproved ? 'success' : user.profileStatus === 'REJECTED' ? 'danger' : 'warning'">
          {{ statusText }}
        </yq-tag>
      </view>
      <text class="status-tip yq-muted">{{ statusTip }}</text>
    </view>

    <!-- VIP 卡片 -->
    <view class="vip-card" @tap="go('/pages/vip/index')">
      <view>
        <text class="vip-title">{{ user.isVip ? '续费会员' : '开通会员' }}</text>
        <text class="vip-sub">解锁联系方式 · AI 精准匹配 · 查看访客</text>
      </view>
      <text class="vip-btn">{{ user.isVip ? '去续费' : '去开通' }}</text>
    </view>

    <!-- 功能入口 -->
    <view class="yq-card">
      <view class="row" @tap="go('/pages/vip/benefits')">
        <text class="row-label">我的权益</text>
        <text class="arrow">›</text>
      </view>
      <view class="row" @tap="go('/pages/mine/visitors')">
        <text class="row-label">谁看过我</text>
        <view class="row-right">
          <yq-tag v-if="!user.isVip" type="warning">VIP</yq-tag>
          <text class="arrow">›</text>
        </view>
      </view>
      <view class="row" @tap="go('/pages/order/list')">
        <text class="row-label">我的订单</text>
        <text class="arrow">›</text>
      </view>
      <view class="row" @tap="go('/pages/profile/photos')">
        <text class="row-label">我的照片</text>
        <text class="arrow">›</text>
      </view>
      <view class="row" @tap="go('/pages/profile/preference')">
        <text class="row-label">择偶要求</text>
        <text class="arrow">›</text>
      </view>
      <view class="row" @tap="go('/pages/profile/audit-log')">
        <text class="row-label">审核记录</text>
        <text class="arrow">›</text>
      </view>
    </view>

    <!-- 红娘入口 -->
    <view class="yq-card">
      <view class="row" @tap="goMatchmaker">
        <text class="row-label">
          {{ matchmakerStatus === 'ACTIVE' ? '红娘工作台' : '成为红娘' }}
        </text>
        <view class="row-right">
          <yq-tag v-if="matchmakerStatus === 'PENDING'" type="warning">审核中</yq-tag>
          <yq-tag v-else-if="matchmakerStatus === 'SUSPENDED'" type="danger">已停用</yq-tag>
          <yq-tag v-else-if="matchmakerStatus === 'ACTIVE'" type="success">服务中</yq-tag>
          <text class="arrow">›</text>
        </view>
      </view>
      <text class="mm-tip yq-muted">
        牵线成功可获得分润，名下会员购买会员卡也有分成
      </text>
    </view>

    <view class="yq-card">
      <view class="row" @tap="go('/pages/profile/claim')">
        <text class="row-label">认领档案</text>
        <text class="arrow">›</text>
      </view>
      <view v-if="user.logged" class="row" @tap="logout">
        <text class="row-label yq-danger">退出登录</text>
      </view>
    </view>

    <view class="bottom-space" />
  </view>
</template>

<style lang="scss" scoped>
.header {
  padding: 50rpx 40rpx;
  background: linear-gradient(120deg, #e05a7d, #f0a0b6);
  color: #fff;
}

.head-row,
.login-tip {
  display: flex;
  align-items: center;
}

.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  flex-shrink: 0;
}

.avatar--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.3);
  color: #fff;
  font-size: 50rpx;
}

.head-info {
  padding-left: 24rpx;
}

.nick-row {
  display: flex;
  align-items: center;
}

.nick {
  margin-right: 10rpx;
  font-size: 36rpx;
  font-weight: 600;
}

.sub {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  opacity: 0.9;
}

.status-card {
  margin-top: -20rpx;
}

.status-title {
  font-size: 30rpx;
  font-weight: 600;
}

.status-tip {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
}

.vip-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 20rpx;
  padding: 28rpx;
  background: linear-gradient(120deg, #3a3a44, #5a5a68);
  border-radius: $yq-radius;
  color: #f5d9a8;
}

.vip-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
}

.vip-sub {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  opacity: 0.85;
}

.vip-btn {
  padding: 10rpx 28rpx;
  background: #f5d9a8;
  color: #3a3a44;
  border-radius: 30rpx;
  font-size: 24rpx;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 26rpx 0;
  border-bottom: 1rpx solid $yq-border;
}

.row:last-child {
  border-bottom: none;
}

.row-label {
  font-size: 28rpx;
}

.row-right {
  display: flex;
  align-items: center;
}

.arrow {
  color: $yq-text-secondary;
}

.mm-tip {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  line-height: 1.6;
}

.bottom-space {
  height: 40rpx;
}
</style>
