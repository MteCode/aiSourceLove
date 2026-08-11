<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app';
import { computed, ref } from 'vue';
import type { MatchResultDto, ProfileBriefDto } from '@yuanqiao/shared';
import { introApi, matchApi, matchmakerApi } from '@/api';
import { confirm, hideLoading, loading, toast } from '@/utils/ui';

/**
 * 发起牵线。
 *
 * 选两个人 → 先算契合度 → 看完打分明细再决定要不要发起。
 * 这一步是红娘的专业性所在：分数只是参考，「需要注意」那栏才是
 * 打电话沟通时要提前铺垫的东西。
 */

const members = ref<ProfileBriefDto[]>([]);
const aId = ref('');
const bId = ref('');
const remark = ref('');
const score = ref<MatchResultDto | null>(null);
const scoring = ref(false);
const submitting = ref(false);

const aProfile = computed(() => members.value.find((m) => m.id === aId.value));
const bProfile = computed(() => members.value.find((m) => m.id === bId.value));

const aIndex = computed(() => members.value.findIndex((m) => m.id === aId.value));
const bIndex = computed(() => members.value.findIndex((m) => m.id === bId.value));

onLoad(async (options) => {
  loading();
  try {
    // 只在名下会员里选，跨红娘牵线要走后台
    const res = await matchmakerApi.myMembers({ page: 1, pageSize: 200 });
    members.value = res.list.filter((m) => m.status === 'APPROVED');
    if (options?.a) aId.value = options.a;
  } finally {
    hideLoading();
  }
});

function pickA(e: { detail: { value: string } }): void {
  aId.value = members.value[Number(e.detail.value)]?.id ?? '';
  score.value = null;
}

function pickB(e: { detail: { value: string } }): void {
  bId.value = members.value[Number(e.detail.value)]?.id ?? '';
  score.value = null;
}

async function calcScore(): Promise<void> {
  if (!aId.value || !bId.value) return toast('请先选择双方');
  if (aId.value === bId.value) return toast('不能给同一个人牵线');

  scoring.value = true;
  try {
    score.value = await matchApi.scorePair(aId.value, bId.value);
  } finally {
    scoring.value = false;
  }
}

async function submit(): Promise<void> {
  if (!aId.value || !bId.value) return toast('请先选择双方');
  if (aId.value === bId.value) return toast('不能给同一个人牵线');

  const ok = await confirm(
    `确认为「${aProfile.value?.displayName}」和「${bProfile.value?.displayName}」发起牵线？双方都会收到推荐。`,
    '发起牵线',
  );
  if (!ok) return;

  submitting.value = true;
  try {
    const intro = await introApi.create(aId.value, bId.value, remark.value.trim() || undefined);
    toast('已发起', 'success');
    setTimeout(() => uni.redirectTo({ url: `/pages/intro/detail?id=${intro.id}` }), 700);
  } finally {
    submitting.value = false;
  }
}

function label(p?: ProfileBriefDto): string {
  return p ? `${p.displayName}（${p.age}岁·${p.cityName || '城市未填'}）` : '请选择';
}
</script>

<template>
  <view class="yq-page">
    <yq-card title="选择双方">
      <picker :range="members" range-key="displayName" :value="aIndex" @change="pickA">
        <view class="picker">
          <text class="p-label">A 方</text>
          <text :class="{ placeholder: !aProfile }">{{ label(aProfile) }}</text>
          <text class="arrow">›</text>
        </view>
      </picker>

      <picker :range="members" range-key="displayName" :value="bIndex" @change="pickB">
        <view class="picker">
          <text class="p-label">B 方</text>
          <text :class="{ placeholder: !bProfile }">{{ label(bProfile) }}</text>
          <text class="arrow">›</text>
        </view>
      </picker>

      <text class="tip yq-muted">只能在名下已通过审核的会员中选择</text>
      <button class="calc-btn" :disabled="scoring" @tap="calcScore">先看看契合度</button>
    </yq-card>

    <yq-card v-if="score" title="契合度分析">
      <view class="score-head">
        <text class="score-num">{{ score.score }}</text>
        <text class="yq-muted">综合匹配度</text>
      </view>

      <view class="bi">
        <view class="bi-item">
          <text class="bi-label yq-muted">A 满足 B 的要求</text>
          <view class="bar"><view class="bar-fill" :style="{ width: Math.round(score.aSatisfiesB * 100) + '%' }" /></view>
        </view>
        <view class="bi-item">
          <text class="bi-label yq-muted">B 满足 A 的要求</text>
          <view class="bar"><view class="bar-fill bar-fill--blue" :style="{ width: Math.round(score.bSatisfiesA * 100) + '%' }" /></view>
        </view>
      </view>

      <view v-if="score.highlights.length" class="list">
        <text class="list-title yq-success">加分点</text>
        <text v-for="h in score.highlights" :key="h" class="list-item">· {{ h }}</text>
      </view>

      <view v-if="score.concerns.length" class="list">
        <text class="list-title yq-danger">需要注意（沟通时提前铺垫）</text>
        <text v-for="c in score.concerns" :key="c" class="list-item">· {{ c }}</text>
      </view>

      <view class="details">
        <view v-for="d in score.details" :key="d.key" class="d-row">
          <text class="d-label">{{ d.label }}</text>
          <view class="bar bar--sm"><view class="bar-fill" :style="{ width: Math.round(d.raw * 100) + '%' }" /></view>
          <text class="d-note yq-muted">{{ d.note }}</text>
        </view>
      </view>
    </yq-card>

    <yq-card title="推荐语">
      <textarea
        v-model="remark"
        class="area"
        placeholder="写给双方的推荐语，说明为什么觉得他们合适。这段话双方都能看到。"
        maxlength="1000"
      />
    </yq-card>

    <view class="footer">
      <button class="btn" :disabled="submitting" @tap="submit">发起牵线</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.picker {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid $yq-border;
  font-size: 28rpx;
}

.p-label {
  width: 110rpx;
  color: $yq-text-secondary;
}

.placeholder {
  color: #bbb;
}

.arrow {
  margin-left: auto;
  color: $yq-text-secondary;
}

.tip {
  display: block;
  margin-top: 16rpx;
  font-size: 22rpx;
}

.calc-btn {
  margin-top: 24rpx;
  background: $yq-primary-light;
  color: $yq-primary;
  border-radius: 40rpx;
  font-size: 28rpx;
  line-height: 76rpx;
}

.score-head {
  text-align: center;
}

.score-num {
  display: block;
  color: $yq-primary;
  font-size: 64rpx;
  font-weight: 700;
  line-height: 1.1;
}

.bi {
  display: flex;
  margin: 24rpx 0;
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

.list {
  margin-top: 20rpx;
}

.list-title {
  display: block;
  margin-bottom: 8rpx;
  font-size: 26rpx;
  font-weight: 600;
}

.list-item {
  display: block;
  padding: 4rpx 0;
  font-size: 25rpx;
  line-height: 1.7;
}

.details {
  margin-top: 24rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid $yq-border;
}

.d-row {
  display: flex;
  align-items: center;
  padding: 10rpx 0;
}

.d-label {
  width: 190rpx;
  font-size: 24rpx;
}

.d-note {
  width: 190rpx;
  font-size: 22rpx;
  text-align: right;
}

.area {
  width: 100%;
  height: 200rpx;
  padding: 16rpx;
  background: $yq-bg;
  border-radius: 12rpx;
  font-size: 26rpx;
  box-sizing: border-box;
}

.footer {
  padding: 24rpx 20rpx calc(24rpx + env(safe-area-inset-bottom));
}

.btn {
  background: $yq-primary;
  color: #fff;
  border-radius: 44rpx;
  font-size: 30rpx;
  line-height: 88rpx;
}
</style>
