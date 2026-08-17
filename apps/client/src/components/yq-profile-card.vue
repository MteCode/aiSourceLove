<script setup lang="ts">
import { computed } from 'vue';
import { EDUCATION_LABEL, Gender, zodiacOf, type ProfileBriefDto } from '@yuanqiao/shared';

/** 广场和推荐列表共用的会员卡片 */
const props = defineProps<{ profile: ProfileBriefDto; score?: number }>();

/**
 * 照片不对外展示，头像位用生肖顶上。
 *
 * 选生肖不是为了好看：相亲场景里"你属什么"本来就是必问的一句，
 * 而且它只需要出生年——我们的存量数据恰好只有年份。
 * 12 个生肖 × 男女配色，几百张卡片才有区分度；
 * 原来一律显示编号首字母，整屏都是同一个"L"。
 */
const zodiac = computed(() => zodiacOf(props.profile.birthYear));

function open(id: string): void {
  uni.navigateTo({ url: `/pages/profile/detail?id=${id}` });
}
</script>

<template>
  <view class="card" @tap="open(profile.id)">
    <view class="avatar-wrap">
      <image v-if="profile.avatarUrl" class="avatar" :src="profile.avatarUrl" mode="aspectFill" />
      <view
        v-else
        class="avatar avatar--zodiac"
        :class="profile.gender === Gender.MALE ? 'avatar--male' : 'avatar--female'"
      >
        <text class="zodiac-emoji">{{ zodiac?.emoji ?? '🙂' }}</text>
        <text v-if="zodiac" class="zodiac-label">属{{ zodiac.label }}</text>
      </view>
      <!-- 有照片但没权限。说清楚是"不对外展示"而不是"这人没传照片" -->
      <view v-if="profile.avatarMasked" class="masked">
        <text>照片保护</text>
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

.avatar--zodiac {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* 男女分色，让整屏卡片有节奏；同色系不跳脱，仍在品牌调性内 */
.avatar--male {
  background: linear-gradient(150deg, #e8eefb 0%, #d6e2f7 100%);
}

.avatar--female {
  background: linear-gradient(150deg, #fdeef2 0%, #fbdde6 100%);
}

.zodiac-emoji {
  font-size: 64rpx;
  line-height: 1.1;
}

.zodiac-label {
  margin-top: 4rpx;
  font-size: 20rpx;
  color: rgba(0, 0, 0, 0.45);
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
