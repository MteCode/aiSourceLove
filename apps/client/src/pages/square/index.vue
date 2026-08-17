<script setup lang="ts">
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app';
import { reactive, ref } from 'vue';
import { GENDER_LABEL, Gender, type ProfileBriefDto } from '@yuanqiao/shared';
import { profileApi } from '@/api';
import { useUserStore } from '@/stores/user';

const user = useUserStore();

const list = ref<ProfileBriefDto[]>([]);
const page = ref(1);
const total = ref(0);
const loading = ref(false);
/** 请求失败和「确实没数据」要分开：都显示成空态会把故障说成没结果，很难查 */
const failed = ref(false);
const finished = ref(false);
const filterVisible = ref(false);

const filter = reactive({
  keyword: '',
  gender: '' as '' | Gender,
  ageMin: undefined as number | undefined,
  ageMax: undefined as number | undefined,
});

async function load(reset = false): Promise<void> {
  if (loading.value) return;
  if (reset) {
    page.value = 1;
    finished.value = false;
  }
  if (finished.value) return;

  loading.value = true;
  failed.value = false;
  try {
    const res = await profileApi.square({
      page: page.value,
      pageSize: 20,
      keyword: filter.keyword || undefined,
      gender: filter.gender || undefined,
      ageMin: filter.ageMin,
      ageMax: filter.ageMax,
    });
    list.value = reset ? res.list : [...list.value, ...res.list];
    total.value = res.total;
    finished.value = list.value.length >= res.total;
    page.value += 1;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}

function applyFilter(): void {
  filterVisible.value = false;
  void load(true);
}

function resetFilter(): void {
  filter.keyword = '';
  filter.gender = '';
  filter.ageMin = undefined;
  filter.ageMax = undefined;
  applyFilter();
}

type UniInputEvent = { detail: { value: string } };

function num(e: UniInputEvent): number | undefined {
  return e.detail.value === '' ? undefined : Number(e.detail.value);
}

onShow(() => {
  if (!list.value.length) void load(true);
});

onPullDownRefresh(async () => {
  await load(true);
  uni.stopPullDownRefresh();
});

onReachBottom(() => void load());

/** 模板里访问不到 uni，跳转统一走包装函数 */
function goto(url: string): void {
  uni.navigateTo({ url });
}
</script>

<template>
  <view class="yq-page">
    <view class="search-bar">
      <input
        v-model="filter.keyword"
        class="search"
        placeholder="搜昵称 / 职业 / 城市"
        confirm-type="search"
        @confirm="applyFilter"
      />
      <text class="filter-btn" @tap="filterVisible = true">筛选</text>
    </view>

    <!-- 没资料的用户先引导去填，否则广场逛完也没法开始 -->
    <view v-if="user.logged && !user.profileId" class="notice" @tap="goto('/pages/profile/edit')">
      <text>还没有你的资料，完善后才能被推荐给别人 ›</text>
    </view>
    <view v-else-if="user.logged && !user.profileApproved" class="notice" @tap="goto('/pages/profile/edit')">
      <text>你的资料还未通过审核，通过后才会出现在广场 ›</text>
    </view>

    <!-- 单列而不是两列：资料卡靠信息密度取胜，两列一行放不下标签和摘要 -->
    <view class="list">
      <view v-for="p in list" :key="p.id" class="item">
        <yq-profile-card :profile="p" />
      </view>
    </view>

    <yq-empty
        v-if="failed"
        icon="⚠️"
        text="加载失败，请检查网络后重试"
        retryable
        @retry="load(true)"
      />
      <yq-empty v-else-if="!list.length && !loading" icon="🔍" text="没有符合条件的人，换个筛选试试" />
    <view v-if="loading" class="loading yq-muted">加载中…</view>
    <view v-else-if="finished && list.length" class="loading yq-muted">已经到底啦，共 {{ total }} 人</view>

    <!-- 筛选面板 -->
    <view v-if="filterVisible" class="mask" @tap="filterVisible = false">
      <view class="panel" @tap.stop>
        <text class="panel-title">筛选</text>

        <text class="panel-label">性别</text>
        <view class="chips">
          <text :class="['chip', { 'chip--on': filter.gender === '' }]" @tap="filter.gender = ''">不限</text>
          <text
            v-for="(label, g) in GENDER_LABEL"
            :key="g"
            :class="['chip', { 'chip--on': filter.gender === g }]"
            @tap="filter.gender = g as Gender"
          >
            {{ label }}
          </text>
        </view>

        <text class="panel-label">年龄</text>
        <view class="range">
          <input class="range-input" type="number" :value="filter.ageMin ?? ''" placeholder="不限" @input="(e: UniInputEvent) => (filter.ageMin = num(e))" />
          <text class="sep">-</text>
          <input class="range-input" type="number" :value="filter.ageMax ?? ''" placeholder="不限" @input="(e: UniInputEvent) => (filter.ageMax = num(e))" />
        </view>

        <view class="panel-footer">
          <button class="pbtn pbtn--plain" @tap="resetFilter">重置</button>
          <button class="pbtn pbtn--primary" @tap="applyFilter">确定</button>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.search-bar {
  display: flex;
  align-items: center;
  padding: 20rpx;
  background: #fff;
}

.search {
  flex: 1;
  padding: 16rpx 24rpx;
  background: $yq-bg;
  border-radius: 32rpx;
  font-size: 26rpx;
}

.filter-btn {
  padding-left: 24rpx;
  color: $yq-primary;
  font-size: 28rpx;
}

.notice {
  margin: 20rpx 20rpx 0;
  padding: 20rpx 24rpx;
  background: #fdf6ec;
  border-radius: 12rpx;
  color: $yq-warning;
  font-size: 24rpx;
}

.list {
  padding: 20rpx;
}

.item + .item {
  margin-top: 20rpx;
}

.loading {
  padding: 30rpx;
  font-size: 24rpx;
  text-align: center;
}

.mask {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.45);
}

.panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 32rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
}

.panel-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  text-align: center;
}

.panel-label {
  display: block;
  margin: 30rpx 0 16rpx;
  font-size: 26rpx;
  color: $yq-text-secondary;
}

.chips {
  display: flex;
  flex-wrap: wrap;
}

.chip {
  padding: 12rpx 32rpx;
  margin: 0 16rpx 16rpx 0;
  background: $yq-bg;
  border: 1rpx solid transparent;
  border-radius: 30rpx;
  font-size: 26rpx;
}

.chip--on {
  background: $yq-primary-light;
  border-color: $yq-primary;
  color: $yq-primary;
}

.range {
  display: flex;
  align-items: center;
}

.range-input {
  flex: 1;
  padding: 16rpx;
  background: $yq-bg;
  border-radius: 12rpx;
  font-size: 28rpx;
  text-align: center;
}

.sep {
  padding: 0 20rpx;
  color: $yq-text-secondary;
}

.panel-footer {
  display: flex;
  gap: 20rpx;
  margin-top: 40rpx;
}

.pbtn {
  flex: 1;
  border-radius: 44rpx;
  font-size: 30rpx;
  line-height: 84rpx;
}

.pbtn--primary {
  background: $yq-primary;
  color: #fff;
}

.pbtn--plain {
  background: $yq-bg;
  color: $yq-text;
}
</style>
