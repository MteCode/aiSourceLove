<script setup lang="ts">
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app';
import { computed, ref } from 'vue';
import { INTRODUCTION_STATUS_LABEL, IntroductionStatus, type IntroductionDto } from '@yuanqiao/shared';
import { introApi } from '@/api';
import { useUserStore } from '@/stores/user';
import { fromNow } from '@/utils/format';

const user = useUserStore();

const TABS = [
  { key: '', label: '全部' },
  { key: 'ACTIVE', label: '进行中' },
  { key: IntroductionStatus.SUCCESS, label: '已成功' },
] as const;

const tab = ref<string>('');
const list = ref<IntroductionDto[]>([]);
const page = ref(1);
const loading = ref(false);
/** 请求失败和「确实没数据」要分开：都显示成空态会把故障说成没结果，很难查 */
const failed = ref(false);
const finished = ref(false);

/** 「进行中」不是一个后端状态，是「非终态」的集合，前端过滤 */
const visible = computed(() => {
  if (tab.value === 'ACTIVE') {
    const done: string[] = [IntroductionStatus.SUCCESS, IntroductionStatus.FAILED, IntroductionStatus.CANCELLED];
    return list.value.filter((i) => !done.includes(i.status));
  }
  if (tab.value) return list.value.filter((i) => i.status === tab.value);
  return list.value;
});

async function load(reset = false): Promise<void> {
  if (loading.value || !user.logged) return;
  if (reset) {
    page.value = 1;
    finished.value = false;
  }
  if (finished.value) return;

  loading.value = true;
  failed.value = false;
  try {
    const res = await introApi.list({ page: page.value, pageSize: 20 });
    list.value = reset ? res.list : [...list.value, ...res.list];
    finished.value = list.value.length >= res.total;
    page.value += 1;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}

/** 我是 A 方还是 B 方，决定卡片上「对方」显示谁 */
function counterpart(intro: IntroductionDto) {
  const mine = user.profileId;
  return intro.sideA.id === mine ? intro.sideB : intro.sideA;
}

function myAgreed(intro: IntroductionDto): boolean {
  return intro.sideA.id === user.profileId ? intro.aAgreed : intro.bAgreed;
}

function needMyAction(intro: IntroductionDto): boolean {
  const waiting: string[] = [IntroductionStatus.RECOMMENDED, IntroductionStatus.PARTIALLY_AGREED];
  return waiting.includes(intro.status) && !myAgreed(intro);
}

function statusType(status: string): 'success' | 'warning' | 'danger' | 'info' | 'primary' {
  if (status === IntroductionStatus.SUCCESS) return 'success';
  if (status === IntroductionStatus.FAILED || status === IntroductionStatus.CANCELLED) return 'info';
  if (status === IntroductionStatus.RECOMMENDED) return 'warning';
  return 'primary';
}

function open(id: string): void {
  uni.navigateTo({ url: `/pages/intro/detail?id=${id}` });
}

onShow(() => void load(true));

onPullDownRefresh(async () => {
  await load(true);
  uni.stopPullDownRefresh();
});

onReachBottom(() => void load());
</script>

<template>
  <view class="yq-page">
    <view class="tabs">
      <text
        v-for="t in TABS"
        :key="t.key"
        :class="['tab', { 'tab--on': tab === t.key }]"
        @tap="tab = t.key"
      >
        {{ t.label }}
      </text>
    </view>

    <view v-for="intro in visible" :key="intro.id" class="item" @tap="open(intro.id)">
      <view class="yq-between">
        <text class="serial yq-muted">{{ intro.serialNo }}</text>
        <yq-tag :type="statusType(intro.status)">{{ INTRODUCTION_STATUS_LABEL[intro.status] }}</yq-tag>
      </view>

      <view class="body">
        <image
          v-if="counterpart(intro).avatarUrl"
          class="avatar"
          :src="counterpart(intro).avatarUrl!"
          mode="aspectFill"
        />
        <view v-else class="avatar avatar--empty">{{ counterpart(intro).displayName?.[0] || '?' }}</view>

        <view class="info">
          <text class="name">{{ counterpart(intro).displayName }}</text>
          <text class="meta yq-muted">
            {{ counterpart(intro).age }}岁 · {{ counterpart(intro).cityName || '城市未填' }}
          </text>
          <text class="mm yq-muted">红娘：{{ intro.matchmakerName }}</text>
        </view>

        <view v-if="intro.matchScore != null" class="score">
          <text class="score-num">{{ intro.matchScore }}</text>
          <text class="score-label yq-muted">匹配度</text>
        </view>
      </view>

      <!-- 需要表态的排在视觉最重的位置，这是这一页的核心动作 -->
      <view v-if="needMyAction(intro)" class="action">
        <text class="action-text">等待你的意向，点开查看 TA 的资料后表态 ›</text>
      </view>
      <view v-else class="foot yq-muted">
        <text>{{ fromNow(intro.updatedAt) }}更新</text>
      </view>
    </view>

    <yq-empty v-if="failed" icon="⚠️" text="加载失败，请检查网络后重试" retryable @retry="load(true)" />
    <yq-empty v-else-if="!visible.length && !loading" icon="🔗" text="还没有牵线记录">
      <text class="empty-tip yq-muted">红娘会根据你的资料主动为你牵线</text>
    </yq-empty>
    <view v-if="loading" class="loading yq-muted">加载中…</view>
  </view>
</template>

<style lang="scss" scoped>
.tabs {
  display: flex;
  background: $yq-surface;
}

.tab {
  flex: 1;
  padding: 24rpx 0;
  color: $yq-text-secondary;
  font-size: 28rpx;
  text-align: center;
}

.tab--on {
  color: $yq-primary;
  font-weight: 600;
  border-bottom: 4rpx solid $yq-primary;
}

.item {
  margin: 20rpx;
  padding: 24rpx;
  background: $yq-surface;
  border-radius: $yq-radius;
}

.serial {
  font-size: 22rpx;
}

.body {
  display: flex;
  align-items: center;
  margin-top: 16rpx;
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
  padding: 0 20rpx;
}

.name {
  font-size: 30rpx;
  font-weight: 600;
}

.meta,
.mm {
  display: block;
  margin-top: 6rpx;
  font-size: 23rpx;
}

.score {
  text-align: center;
}

.score-num {
  display: block;
  color: $yq-primary;
  font-size: 40rpx;
  font-weight: 700;
  line-height: 1;
}

.score-label {
  font-size: 20rpx;
}

.action {
  margin-top: 20rpx;
  padding: 16rpx;
  background: $yq-primary-light;
  border-radius: 12rpx;
  text-align: center;
}

.action-text {
  color: $yq-primary;
  font-size: 24rpx;
}

.foot {
  margin-top: 16rpx;
  font-size: 22rpx;
}

.empty-tip {
  margin-top: 16rpx;
  font-size: 24rpx;
}

.loading {
  padding: 30rpx;
  font-size: 24rpx;
  text-align: center;
}
</style>
