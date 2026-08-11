<script setup lang="ts">
import { EDUCATION_LABEL, type ProfileBriefDto } from '@yuanqiao/shared';

/** 广场和推荐列表共用的会员卡片 */
defineProps<{ profile: ProfileBriefDto; score?: number }>();

function open(id: string): void {
  uni.navigateTo({ url: `/pages/profile/detail?id=${id}` });
}
</script>

<template>
  <view class="card" @tap="open(profile.id)">
    <view class="avatar-wrap">
      <image v-if="profile.avatarUrl" class="avatar" :src="profile.avatarUrl" mode="aspectFill" />
      <view v-else class="avatar avatar--empty">
        <text>{{ profile.displayName?.[0] || '?' }}</text>
      </view>
      <!-- 打码是隐私分级的结果，明确告诉用户「有照片但看不到」比直接不显示好 -->
      <view v-if="profile.avatarMasked" class="masked">
        <text>照片已保护</text>
      </view>
      <view v-if="score !== undefined" class="score">{{ score }}分</view>
    </view>

    <view class="info">
      <view class="name-row">
        <text class="name yq-ellipsis">{{ profile.displayName }}</text>
        <yq-tag v-if="profile.isTop" type="danger">置顶</yq-tag>
      </view>
      <text class="meta yq-ellipsis">
        {{ profile.age }}岁 · {{ profile.heightCm ? profile.heightCm + 'cm' : '身高保密' }}
      </text>
      <text class="meta yq-ellipsis">
        {{ profile.education ? EDUCATION_LABEL[profile.education] : '学历未填' }} ·
        {{ profile.cityName || '城市未填' }}
      </text>
      <text v-if="profile.occupation" class="meta yq-ellipsis">{{ profile.occupation }}</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.card {
  width: 100%;
  background: #fff;
  border-radius: $yq-radius;
  overflow: hidden;
}

.avatar-wrap {
  position: relative;
  width: 100%;
  height: 320rpx;
}

.avatar {
  width: 100%;
  height: 100%;
}

.avatar--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: $yq-primary-light;
  color: $yq-primary;
  font-size: 72rpx;
}

.masked {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 8rpx;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 20rpx;
  text-align: center;
}

.score {
  position: absolute;
  top: 12rpx;
  right: 12rpx;
  padding: 4rpx 14rpx;
  background: $yq-primary;
  color: #fff;
  border-radius: 20rpx;
  font-size: 22rpx;
}

.info {
  padding: 16rpx;
}

.name-row {
  display: flex;
  align-items: center;
}

.name {
  max-width: 200rpx;
  margin-right: 8rpx;
  font-size: 30rpx;
  font-weight: 600;
}

.meta {
  display: block;
  margin-top: 6rpx;
  color: $yq-text-secondary;
  font-size: 24rpx;
}
</style>
