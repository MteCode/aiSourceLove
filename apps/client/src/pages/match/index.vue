<script setup lang="ts">
import { onReachBottom, onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import type { MatchResultDto } from '@yuanqiao/shared';
import { ApiError, BENEFIT_EXHAUSTED, matchApi } from '@/api';
import { promptUpgrade } from '@/utils/feature';
import { useUserStore } from '@/stores/user';
import { confirm, toast } from '@/utils/ui';

/**
 * AI 推荐。
 *
 * 打分明细一定要展示出来：只给一个「92分」用户不会信，
 * 看到「年龄差 3 岁、同城、双方条件互相满足」才会去点开。
 */

const user = useUserStore();

const list = ref<MatchResultDto[]>([]);
const page = ref(1);
const loading = ref(false);
const finished = ref(false);
const blocked = ref('');
const enableAi = ref(false);
const expanded = ref<Record<string, boolean>>({});

async function load(reset = false): Promise<void> {
  if (loading.value) return;
  if (!user.profileId) {
    blocked.value = 'need-profile';
    return;
  }
  if (!user.profileApproved) {
    blocked.value = 'need-approve';
    return;
  }
  blocked.value = '';

  if (reset) {
    page.value = 1;
    finished.value = false;
    list.value = [];
  }
  if (finished.value) return;

  loading.value = true;
  try {
    const res = await matchApi.run({
      profileId: user.profileId,
      page: page.value,
      pageSize: 10,
      enableAi: enableAi.value,
    });
    list.value = reset ? res.list : [...list.value, ...res.list];
    finished.value = list.value.length >= res.total;
    page.value += 1;
  } catch (e) {
    const err = e as ApiError;
    if (err.code === BENEFIT_EXHAUSTED) {
      enableAi.value = false;
      const go = await promptUpgrade(err.message, 'AI 次数不足');
      if (go) uni.navigateTo({ url: '/pages/vip/index' });
      else void load(true);
    } else {
      toast(err.message || '推荐加载失败');
    }
  } finally {
    loading.value = false;
  }
}

async function toggleAi(): Promise<void> {
  enableAi.value = !enableAi.value;
  if (enableAi.value && !user.isVip) {
    toast('AI 精准匹配会消耗每日次数');
  }
  await load(true);
}

function toggleDetail(id: string): void {
  expanded.value[id] = !expanded.value[id];
}

function open(id: string): void {
  uni.navigateTo({ url: `/pages/profile/detail?id=${id}` });
}

function scoreColor(score: number): string {
  if (score >= 80) return '#67c23a';
  if (score >= 60) return '#e6a23c';
  return '#909399';
}

onShow(() => {
  if (user.logged) void load(true);
});

onReachBottom(() => void load());

/** 模板里访问不到 uni，跳转统一走包装函数 */
function goto(url: string): void {
  uni.navigateTo({ url });
}
</script>

<template>
  <view class="yq-page">
    <view class="header">
      <view>
        <text class="title">为你推荐</text>
        <text class="sub yq-muted">按双向匹配度排序，越靠前越合适</text>
      </view>
      <view :class="['ai-toggle', { 'ai-toggle--on': enableAi }]" @tap="toggleAi">
        <text>AI 精准</text>
      </view>
    </view>

    <yq-empty v-if="blocked === 'need-profile'" icon="📝" text="完善资料后才能开始匹配">
      <button class="empty-btn" @tap="goto('/pages/profile/edit')">去填资料</button>
    </yq-empty>
    <yq-empty v-else-if="blocked === 'need-approve'" icon="⏳" text="资料审核通过后就会为你推荐" />

    <view v-for="r in list" :key="r.profile.id" class="item">
      <view class="main" @tap="open(r.profile.id)">
        <image v-if="r.profile.avatarUrl" class="avatar" :src="r.profile.avatarUrl" mode="aspectFill" />
        <view v-else class="avatar avatar--empty">{{ r.profile.displayName?.[0] || '?' }}</view>

        <view class="info">
          <text class="name">{{ r.profile.displayName }}</text>
          <text class="meta yq-muted">
            {{ r.profile.age }}岁 · {{ r.profile.heightCm ? r.profile.heightCm + 'cm' : '身高保密' }} ·
            {{ r.profile.cityName || '城市未填' }}
          </text>
          <view class="hl">
            <yq-tag v-for="h in r.highlights.slice(0, 3)" :key="h" type="success">{{ h }}</yq-tag>
            <yq-tag v-for="c in r.concerns.slice(0, 2)" :key="c" type="warning">{{ c }}</yq-tag>
          </view>
        </view>

        <view class="score">
          <text class="score-num" :style="{ color: scoreColor(r.score) }">{{ r.score }}</text>
          <text class="score-label yq-muted">匹配度</text>
        </view>
      </view>

      <!-- 双向满足度：单向高不算合适，这是这套匹配和别家的主要差别 -->
      <view class="bi">
        <view class="bi-item">
          <text class="bi-label yq-muted">你满足 TA 的要求</text>
          <view class="bar"><view class="bar-fill" :style="{ width: Math.round(r.aSatisfiesB * 100) + '%' }" /></view>
        </view>
        <view class="bi-item">
          <text class="bi-label yq-muted">TA 满足你的要求</text>
          <view class="bar"><view class="bar-fill bar-fill--blue" :style="{ width: Math.round(r.bSatisfiesA * 100) + '%' }" /></view>
        </view>
      </view>

      <view class="detail-toggle" @tap="toggleDetail(r.profile.id)">
        <text>{{ expanded[r.profile.id] ? '收起打分明细' : '为什么推荐 TA' }}</text>
      </view>

      <view v-if="expanded[r.profile.id]" class="details">
        <view v-for="d in r.details" :key="d.key" class="detail-row">
          <text class="d-label">{{ d.label }}</text>
          <view class="bar bar--sm"><view class="bar-fill" :style="{ width: Math.round(d.raw * 100) + '%' }" /></view>
          <text class="d-note yq-muted">{{ d.note }}</text>
        </view>
        <view v-if="r.aiReason" class="ai-reason">
          <text>{{ r.aiReason }}</text>
        </view>
      </view>
    </view>

    <yq-empty v-if="!list.length && !loading && !blocked" icon="💫" text="暂时没有匹配的人，完善择偶要求会更容易匹配到" />
    <view v-if="loading" class="loading yq-muted">加载中…</view>
    <view v-else-if="finished && list.length" class="loading yq-muted">没有更多了</view>
  </view>
</template>

<style lang="scss" scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 30rpx;
  background: #fff;
}

.title {
  display: block;
  font-size: 34rpx;
  font-weight: 600;
}

.sub {
  font-size: 22rpx;
}

.ai-toggle {
  padding: 10rpx 26rpx;
  border: 1rpx solid $yq-primary;
  border-radius: 30rpx;
  color: $yq-primary;
  font-size: 24rpx;
}

.ai-toggle--on {
  background: $yq-primary;
  color: #fff;
}

.item {
  margin: 20rpx;
  padding: 24rpx;
  background: #fff;
  border-radius: $yq-radius;
}

.main {
  display: flex;
  align-items: center;
}

.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 12rpx;
  flex-shrink: 0;
}

.avatar--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: $yq-primary-light;
  color: $yq-primary;
  font-size: 48rpx;
}

.info {
  flex: 1;
  padding: 0 20rpx;
  overflow: hidden;
}

.name {
  font-size: 32rpx;
  font-weight: 600;
}

.meta {
  display: block;
  margin: 6rpx 0 10rpx;
  font-size: 24rpx;
}

.hl {
  display: flex;
  flex-wrap: wrap;
}

.score {
  text-align: center;
}

.score-num {
  display: block;
  font-size: 48rpx;
  font-weight: 700;
  line-height: 1;
}

.score-label {
  font-size: 20rpx;
}

.bi {
  display: flex;
  margin-top: 20rpx;
}

.bi-item {
  flex: 1;
  padding-right: 20rpx;
}

.bi-label {
  font-size: 22rpx;
}

.bar {
  height: 10rpx;
  margin-top: 8rpx;
  background: $yq-bg;
  border-radius: 6rpx;
  overflow: hidden;
}

.bar--sm {
  flex: 1;
  margin: 0 16rpx;
}

.bar-fill {
  height: 100%;
  background: $yq-primary;
}

.bar-fill--blue {
  background: #409eff;
}

.detail-toggle {
  margin-top: 20rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid $yq-border;
  color: $yq-primary;
  font-size: 24rpx;
  text-align: center;
}

.details {
  margin-top: 16rpx;
}

.detail-row {
  display: flex;
  align-items: center;
  padding: 12rpx 0;
}

.d-label {
  width: 200rpx;
  font-size: 24rpx;
}

.d-note {
  width: 200rpx;
  font-size: 22rpx;
  text-align: right;
}

.ai-reason {
  margin-top: 16rpx;
  padding: 20rpx;
  background: $yq-primary-light;
  border-radius: 12rpx;
  font-size: 24rpx;
  line-height: 1.8;
}

.loading {
  padding: 30rpx;
  font-size: 24rpx;
  text-align: center;
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
