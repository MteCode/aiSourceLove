<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app';
import { computed, ref } from 'vue';
import {
  INTRODUCTION_FLOW_STEPS,
  INTRODUCTION_STATUS_LABEL,
  IntroductionStatus,
  type IntroductionDto,
} from '@yuanqiao/shared';
import { introApi } from '@/api';
import { useUserStore } from '@/stores/user';
import { formatDate } from '@/utils/format';
import { confirm, hideLoading, loading, toast } from '@/utils/ui';

const user = useUserStore();
const id = ref('');
const intro = ref<IntroductionDto | null>(null);
const acting = ref(false);

const isSideA = computed(() => intro.value?.sideA.id === user.profileId);
const counterpart = computed(() => (isSideA.value ? intro.value?.sideB : intro.value?.sideA));
const myAgreed = computed(() => (isSideA.value ? intro.value?.aAgreed : intro.value?.bAgreed));
const otherAgreed = computed(() => (isSideA.value ? intro.value?.bAgreed : intro.value?.aAgreed));

/** 只有在「已推荐」和「单方同意」这两个状态才轮到当事人表态 */
const canAct = computed(() => {
  const s = intro.value?.status;
  if (!s) return false;
  const waiting: string[] = [IntroductionStatus.RECOMMENDED, IntroductionStatus.PARTIALLY_AGREED];
  return waiting.includes(s) && !myAgreed.value;
});

const stepIndex = computed(() => {
  if (!intro.value) return -1;
  return INTRODUCTION_FLOW_STEPS.indexOf(intro.value.status);
});

const isFailed = computed(
  () =>
    intro.value?.status === IntroductionStatus.FAILED ||
    intro.value?.status === IntroductionStatus.CANCELLED,
);

/** 交换联系方式之后才给看对方联系方式，之前给看资料 */
const contactReady = computed(() => {
  const s = intro.value?.status;
  if (!s) return false;
  const ok: string[] = [
    IntroductionStatus.CONTACT_EXCHANGED,
    IntroductionStatus.MET,
    IntroductionStatus.SUCCESS,
  ];
  return ok.includes(s);
});

onLoad(async (options) => {
  id.value = options?.id ?? '';
  await load();
});

async function load(): Promise<void> {
  if (!id.value) return;
  loading();
  try {
    intro.value = await introApi.detail(id.value);
  } finally {
    hideLoading();
  }
}

async function act(agree: boolean): Promise<void> {
  const tip = agree
    ? '同意后如果对方也同意，红娘会安排交换联系方式。确定吗？'
    : '婉拒后这次牵线会结束，红娘会继续为你物色其他人选。确定吗？';
  if (!(await confirm(tip, agree ? '同意认识' : '婉拒'))) return;

  acting.value = true;
  try {
    intro.value = await introApi.agree(id.value, agree);
    toast(agree ? '已表达意向' : '已婉拒', 'success');
  } finally {
    acting.value = false;
  }
}

function openProfile(): void {
  if (counterpart.value) uni.navigateTo({ url: `/pages/profile/detail?id=${counterpart.value.id}` });
}
</script>

<template>
  <view class="yq-page">
    <template v-if="intro">
      <!-- 流程条 -->
      <view class="yq-card">
        <view v-if="isFailed" class="failed">
          <text>这次牵线已{{ INTRODUCTION_STATUS_LABEL[intro.status] }}</text>
          <text v-if="intro.resultNote" class="failed-note">{{ intro.resultNote }}</text>
        </view>
        <view v-else class="steps">
          <view v-for="(s, i) in INTRODUCTION_FLOW_STEPS" :key="s" class="step">
            <view :class="['step-dot', { 'step-dot--done': i <= stepIndex }]">
              <text v-if="i <= stepIndex">✓</text>
            </view>
            <text :class="['step-text', { 'step-text--done': i <= stepIndex }]">
              {{ INTRODUCTION_STATUS_LABEL[s] }}
            </text>
            <view v-if="i < INTRODUCTION_FLOW_STEPS.length - 1" :class="['step-line', { 'step-line--done': i < stepIndex }]" />
          </view>
        </view>
      </view>

      <!-- 对方 -->
      <view class="yq-card" @tap="openProfile">
        <view class="person">
          <image v-if="counterpart?.avatarUrl" class="avatar" :src="counterpart.avatarUrl" mode="aspectFill" />
          <view v-else class="avatar avatar--empty">{{ counterpart?.displayName?.[0] || '?' }}</view>
          <view class="person-info">
            <text class="name">{{ counterpart?.displayName }}</text>
            <text class="meta yq-muted">
              {{ counterpart?.age }}岁 · {{ counterpart?.heightCm ? counterpart.heightCm + 'cm' : '身高保密' }} ·
              {{ counterpart?.cityName || '城市未填' }}
            </text>
            <text class="link">查看完整资料 ›</text>
          </view>
          <view v-if="intro.matchScore != null" class="score">
            <text class="score-num">{{ intro.matchScore }}</text>
            <text class="score-label yq-muted">匹配度</text>
          </view>
        </view>
      </view>

      <!-- 红娘推荐语 -->
      <yq-card v-if="intro.remark" title="红娘的话">
        <text class="remark">{{ intro.remark }}</text>
        <text class="mm yq-muted">—— {{ intro.matchmakerName }}</text>
      </yq-card>

      <!-- 双方意向 -->
      <yq-card title="双方意向">
        <view class="agree-row">
          <text>我</text>
          <yq-tag :type="myAgreed ? 'success' : 'info'">{{ myAgreed ? '已同意' : '待表态' }}</yq-tag>
        </view>
        <view class="agree-row">
          <text>对方</text>
          <!-- 对方是否同意在双方都表态前不揭示，避免形成压力 -->
          <yq-tag :type="otherAgreed ? 'success' : 'info'">
            {{ otherAgreed ? '已同意' : myAgreed ? '待对方表态' : '保密' }}
          </yq-tag>
        </view>
      </yq-card>

      <!-- 联系方式 -->
      <yq-card v-if="contactReady" title="联系方式">
        <text class="yq-success">双方已同意，可以直接联系了。祝顺利 🌸</text>
        <button class="btn btn--plain" @tap="openProfile">去 TA 的资料页查看联系方式</button>
      </yq-card>

      <!-- 进度流水 -->
      <yq-card title="进度">
        <view v-for="e in intro.events" :key="e.id" class="event">
          <view class="dot" />
          <view class="event-body">
            <text class="event-title">{{ INTRODUCTION_STATUS_LABEL[e.toStatus] }}</text>
            <text v-if="e.note" class="event-note">{{ e.note }}</text>
            <text class="event-time yq-muted">{{ formatDate(e.createdAt, true) }}</text>
          </view>
        </view>
      </yq-card>

      <view class="bottom-space" />

      <!-- 表态栏 -->
      <view v-if="canAct" class="action-bar">
        <button class="abtn abtn--plain" :disabled="acting" @tap="act(false)">婉拒</button>
        <button class="abtn abtn--primary" :disabled="acting" @tap="act(true)">想认识 TA</button>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.steps {
  display: flex;
  align-items: flex-start;
}

.step {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.step-dot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40rpx;
  height: 40rpx;
  background: #fff;
  border: 2rpx solid #dcdfe6;
  border-radius: 50%;
  color: #fff;
  font-size: 22rpx;
  z-index: 1;
}

.step-dot--done {
  background: $yq-primary;
  border-color: $yq-primary;
}

.step-text {
  margin-top: 10rpx;
  color: $yq-text-secondary;
  font-size: 20rpx;
  text-align: center;
}

.step-text--done {
  color: $yq-primary;
}

.step-line {
  position: absolute;
  top: 20rpx;
  left: 50%;
  width: 100%;
  height: 2rpx;
  background: #dcdfe6;
}

.step-line--done {
  background: $yq-primary;
}

.failed {
  text-align: center;
  color: $yq-text-secondary;
}

.failed-note {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
}

.person {
  display: flex;
  align-items: center;
}

.avatar {
  width: 130rpx;
  height: 130rpx;
  border-radius: 12rpx;
  flex-shrink: 0;
}

.avatar--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: $yq-primary-light;
  color: $yq-primary;
  font-size: 52rpx;
}

.person-info {
  flex: 1;
  padding: 0 20rpx;
}

.name {
  font-size: 32rpx;
  font-weight: 600;
}

.meta {
  display: block;
  margin: 8rpx 0;
  font-size: 24rpx;
}

.link {
  color: $yq-primary;
  font-size: 24rpx;
}

.score {
  text-align: center;
}

.score-num {
  display: block;
  color: $yq-primary;
  font-size: 44rpx;
  font-weight: 700;
  line-height: 1;
}

.score-label {
  font-size: 20rpx;
}

.remark {
  display: block;
  padding: 20rpx;
  background: $yq-primary-light;
  border-radius: 12rpx;
  font-size: 26rpx;
  line-height: 1.8;
}

.mm {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  text-align: right;
}

.agree-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 0;
  font-size: 28rpx;
}

.btn {
  margin-top: 24rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
  line-height: 80rpx;
}

.btn--plain {
  background: $yq-bg;
  color: $yq-text;
}

.event {
  display: flex;
  padding: 16rpx 0;
}

.dot {
  width: 14rpx;
  height: 14rpx;
  margin: 12rpx 20rpx 0 0;
  background: $yq-primary;
  border-radius: 50%;
  flex-shrink: 0;
}

.event-title {
  font-size: 27rpx;
}

.event-note,
.event-time {
  display: block;
  margin-top: 6rpx;
  font-size: 23rpx;
  line-height: 1.6;
}

.bottom-space {
  height: 160rpx;
}

.action-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: 20rpx;
  padding: 20rpx 30rpx calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.05);
}

.abtn {
  flex: 1;
  border-radius: 44rpx;
  font-size: 30rpx;
  line-height: 84rpx;
}

.abtn--primary {
  background: $yq-primary;
  color: #fff;
}

.abtn--plain {
  background: $yq-bg;
  color: $yq-text;
}
</style>
