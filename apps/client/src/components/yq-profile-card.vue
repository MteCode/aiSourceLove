<script setup lang="ts">
import { computed } from 'vue';
import {
  CAR_LABEL,
  CHILDREN_LABEL,
  EDUCATION_LABEL,
  HOUSE_LABEL,
  MARITAL_LABEL,
  ChildrenStatus,
  type ProfileBriefDto,
} from '@yuanqiao/shared';

/**
 * 会员资料卡（广场与推荐列表共用）。
 *
 * 这是「线下婚介所那张纸」的线上版，不是社交产品的照片流卡片。
 * 照片不对外展示，所以信息本身就是产品：年龄身高学历放大，
 * 条件做成标签一眼扫完，末尾给一句自我介绍摘要。
 */
const props = defineProps<{ profile: ProfileBriefDto; score?: number }>();

/** 主行：相亲场景最先被问的三件事，缺的自动跳过不留占位 */
const headline = computed(() => {
  const p = props.profile;
  return [
    `${p.age} 岁`,
    p.heightCm ? `${p.heightCm} cm` : null,
    p.education ? EDUCATION_LABEL[p.education] : null,
  ].filter(Boolean);
});

/** 次行：地域和职业。地域在本地相亲里权重很高，单独成行 */
const subline = computed(() => {
  const p = props.profile;
  return [p.cityName, p.occupation].filter(Boolean).join(' · ');
});

/**
 * 条件标签。
 *
 * 只显示「有」的那些：没房没车不标出来——列表页把缺点排开展示，
 * 对会员不体面，红娘也不会这么递资料。无子女是加分项所以保留。
 */
const tags = computed(() => {
  const p = props.profile;
  const out: { text: string; type?: 'danger' | 'warning' | 'info' }[] = [];
  out.push({ text: MARITAL_LABEL[p.maritalStatus] });
  if (p.childrenStatus === ChildrenStatus.NONE) out.push({ text: '无子女', type: 'info' });
  else out.push({ text: CHILDREN_LABEL[p.childrenStatus], type: 'info' });
  if (p.houseStatus && p.houseStatus !== 'NONE') out.push({ text: `房·${HOUSE_LABEL[p.houseStatus]}`, type: 'warning' });
  if (p.carStatus && p.carStatus !== 'NONE') out.push({ text: `车·${CAR_LABEL[p.carStatus]}`, type: 'warning' });
  return out;
});

function open(id: string): void {
  uni.navigateTo({ url: `/pages/profile/detail?id=${id}` });
}
</script>

<template>
  <view class="card" @tap="open(profile.id)">
    <view class="head">
      <view class="headline">
        <text v-for="(h, i) in headline" :key="h" class="hl">
          <text v-if="i" class="dot">·</text>{{ h }}
        </text>
      </view>
      <view class="head-right">
        <yq-tag v-if="profile.isTop" type="danger">置顶</yq-tag>
        <text v-if="score !== undefined" class="score">{{ score }}<text class="score-unit">分</text></text>
      </view>
    </view>

    <text v-if="subline" class="subline yq-ellipsis">{{ subline }}</text>

    <view class="tags">
      <yq-tag v-for="t in tags" :key="t.text" :type="t.type">{{ t.text }}</yq-tag>
    </view>

    <text v-if="profile.introBrief" class="intro">{{ profile.introBrief }}</text>

    <view class="foot">
      <text class="serial yq-muted">编号 {{ profile.serialNo }}</text>
      <!-- 照片保护是承诺不是缺陷，明说出来比让用户自己发现头像位是空的要好 -->
      <text v-if="profile.avatarMasked" class="guard">🔒 照片由红娘保管</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.card {
  padding: 26rpx 24rpx;
  background: #fff;
  border-radius: $yq-radius;
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.headline {
  flex: 1;
  min-width: 0;
}

/* 主行放大：照片没了，这一行就是卡片的视觉重心 */
.hl {
  font-size: 36rpx;
  font-weight: 600;
  color: $yq-text;
}

.dot {
  margin: 0 12rpx;
  font-weight: 400;
  color: $yq-text-secondary;
}

.head-right {
  display: flex;
  align-items: center;
  gap: 10rpx;
  flex-shrink: 0;
  margin-left: 16rpx;
}

.score {
  font-size: 34rpx;
  font-weight: 600;
  color: $yq-primary;
}

.score-unit {
  font-size: 22rpx;
  font-weight: 400;
}

.subline {
  display: block;
  margin-top: 10rpx;
  font-size: 26rpx;
  color: $yq-text-secondary;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 16rpx;
}

.intro {
  display: block;
  margin-top: 16rpx;
  padding: 14rpx 16rpx;
  font-size: 25rpx;
  line-height: 1.6;
  color: $yq-text-secondary;
  background: $yq-bg;
  border-radius: 8rpx;
}

.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16rpx;
}

.serial {
  font-size: 22rpx;
}

.guard {
  font-size: 22rpx;
  color: $yq-text-secondary;
}
</style>
