<script setup lang="ts">
import { onReachBottom, onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { EDUCATION_LABEL, PROFILE_STATUS_LABEL, type ProfileBriefDto } from '@yuanqiao/shared';
import { matchmakerApi } from '@/api';

const list = ref<ProfileBriefDto[]>([]);
const page = ref(1);
const total = ref(0);
const loading = ref(false);
const finished = ref(false);

async function load(reset = false): Promise<void> {
  if (loading.value) return;
  if (reset) {
    page.value = 1;
    finished.value = false;
  }
  if (finished.value) return;

  loading.value = true;
  try {
    const res = await matchmakerApi.myMembers({ page: page.value, pageSize: 20 });
    list.value = reset ? res.list : [...list.value, ...res.list];
    total.value = res.total;
    finished.value = list.value.length >= res.total;
    page.value += 1;
  } finally {
    loading.value = false;
  }
}

function open(id: string): void {
  uni.navigateTo({ url: `/pages/profile/detail?id=${id}` });
}

function createIntro(id: string): void {
  uni.navigateTo({ url: `/pages/matchmaker/create-intro?a=${id}` });
}

function statusType(s: string): 'success' | 'warning' | 'danger' | 'info' {
  if (s === 'APPROVED') return 'success';
  if (s === 'PENDING') return 'warning';
  if (s === 'REJECTED') return 'danger';
  return 'info';
}

onShow(() => void load(true));
onReachBottom(() => void load());
</script>

<template>
  <view class="yq-page">
    <view class="head yq-muted">共 {{ total }} 位名下会员</view>

    <view v-for="m in list" :key="m.id" class="item">
      <view class="main" @tap="open(m.id)">
        <image v-if="m.avatarUrl" class="avatar" :src="m.avatarUrl" mode="aspectFill" />
        <view v-else class="avatar avatar--empty">{{ m.displayName?.[0] || '?' }}</view>
        <view class="info">
          <view class="name-row">
            <text class="name">{{ m.displayName }}</text>
            <yq-tag :type="statusType(m.status)">{{ PROFILE_STATUS_LABEL[m.status] }}</yq-tag>
          </view>
          <text class="meta yq-muted">
            {{ m.age }}岁 · {{ m.heightCm ? m.heightCm + 'cm' : '身高未填' }} ·
            {{ m.education ? EDUCATION_LABEL[m.education] : '学历未填' }}
          </text>
          <text class="meta yq-muted">{{ m.cityName || '城市未填' }} · {{ m.serialNo }}</text>
        </view>
      </view>
      <button class="intro-btn" @tap="createIntro(m.id)">为 TA 牵线</button>
    </view>

    <yq-empty v-if="!list.length && !loading" icon="👥" text="名下还没有会员">
      <text class="tip yq-muted">把你的邀请码分享给会员，注册后会自动归到你名下</text>
    </yq-empty>
    <view v-if="loading" class="loading yq-muted">加载中…</view>
  </view>
</template>

<style lang="scss" scoped>
.head {
  padding: 20rpx 30rpx;
  font-size: 24rpx;
}

.item {
  margin: 0 20rpx 20rpx;
  padding: 24rpx;
  background: #fff;
  border-radius: $yq-radius;
}

.main {
  display: flex;
  align-items: center;
}

.avatar {
  width: 110rpx;
  height: 110rpx;
  border-radius: 12rpx;
  flex-shrink: 0;
}

.avatar--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: $yq-primary-light;
  color: $yq-primary;
  font-size: 44rpx;
}

.info {
  flex: 1;
  padding-left: 20rpx;
}

.name-row {
  display: flex;
  align-items: center;
}

.name {
  margin-right: 10rpx;
  font-size: 30rpx;
  font-weight: 600;
}

.meta {
  display: block;
  margin-top: 6rpx;
  font-size: 23rpx;
}

.intro-btn {
  margin-top: 20rpx;
  background: $yq-primary-light;
  color: $yq-primary;
  border-radius: 36rpx;
  font-size: 26rpx;
  line-height: 68rpx;
}

.tip {
  margin-top: 16rpx;
  font-size: 24rpx;
  text-align: center;
}

.loading {
  padding: 30rpx;
  font-size: 24rpx;
  text-align: center;
}
</style>
