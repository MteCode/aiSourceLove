<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app';
import { computed, ref } from 'vue';
import {
  CAR_LABEL,
  CHILDREN_LABEL,
  EDUCATION_LABEL,
  HOUSE_LABEL,
  MARITAL_LABEL,
  VisibilityLevel,
  type ProfileDto,
} from '@yuanqiao/shared';
import { BENEFIT_EXHAUSTED, ApiError, profileApi } from '@/api';
import { useUserStore } from '@/stores/user';
import { formatIncome, isMaskedValue, plain } from '@/utils/format';
import { confirm, hideLoading, loading, toast } from '@/utils/ui';

/**
 * 他人资料详情。
 *
 * 这一页是隐私分级的主战场：没权限的字段后端下发的是 MaskedValue，
 * 前端负责把「锁」画出来并给出解锁路径——看得见轮廓、够不着细节，
 * 才有付费动机。
 */

const user = useUserStore();
const id = ref('');
const profile = ref<ProfileDto | null>(null);
const unlocking = ref(false);
const failed = ref('');

const photos = computed(() => profile.value?.photos ?? []);
const contactLocked = computed(
  () => isMaskedValue(profile.value?.phone) || isMaskedValue(profile.value?.wechat),
);

/** 已经能看到联系方式说明解锁过了（或是牵线成功自动解锁的） */
const unlocked = computed(
  () => !!profile.value && profile.value.viewerLevel >= VisibilityLevel.UNLOCKED,
);

onLoad(async (options) => {
  id.value = options?.id ?? '';
  if (!id.value) {
    failed.value = '缺少档案参数';
    return;
  }
  if (!user.requireLogin()) return;
  await load();
});

async function load(): Promise<void> {
  loading();
  try {
    profile.value = await profileApi.detail(id.value);
  } catch (e) {
    const err = e as ApiError;
    // 每日查看配额用完是最典型的付费触点，要给引导而不是干巴巴报错
    if (err.code === BENEFIT_EXHAUSTED) {
      failed.value = err.message || '今日查看次数已用完';
      const go = await confirm(`${failed.value}，开通会员可获得更多查看次数`, '查看次数不足');
      if (go) uni.navigateTo({ url: '/pages/vip/index' });
    } else {
      failed.value = err.message || '资料加载失败';
      toast(failed.value);
    }
  } finally {
    hideLoading();
  }
}

async function unlockContact(): Promise<void> {
  if (unlocking.value) return;
  if (!(await confirm('解锁后可查看 TA 的手机号和微信，将消耗一次解锁次数。确定吗？', '解锁联系方式'))) return;

  unlocking.value = true;
  try {
    profile.value = await profileApi.unlockContact(id.value);
    toast('已解锁', 'success');
  } catch (e) {
    const err = e as ApiError;
    if (err.code === BENEFIT_EXHAUSTED) {
      const go = await confirm(`${err.message}，开通会员可获得解锁次数`, '解锁次数不足');
      if (go) uni.navigateTo({ url: '/pages/vip/index' });
    } else {
      toast(err.message || '解锁失败');
    }
  } finally {
    unlocking.value = false;
  }
}

function previewPhoto(url: string): void {
  uni.previewImage({ urls: photos.value.map((p) => p.url), current: url });
}

function copy(text: string): void {
  uni.setClipboardData({ data: text, success: () => toast('已复制') });
}

function goVip(): void {
  uni.navigateTo({ url: '/pages/vip/index' });
}
</script>

<template>
  <view class="yq-page">
    <yq-empty v-if="failed && !profile" icon="🔒" :text="failed">
      <button class="empty-btn" @tap="goVip">去开通会员</button>
    </yq-empty>

    <template v-if="profile">
      <!-- 相册 -->
      <swiper v-if="photos.length" class="gallery" indicator-dots indicator-active-color="#e05a7d" circular>
        <swiper-item v-for="p in photos" :key="p.id">
          <image class="photo" :src="p.url" mode="aspectFill" @tap="previewPhoto(p.url)" />
          <view v-if="p.masked" class="photo-mask">
            <text>照片已模糊处理，解锁后可见清晰版</text>
          </view>
        </swiper-item>
      </swiper>
      <view v-else class="gallery gallery--empty">
        <text class="big">{{ profile.displayName?.[0] || '?' }}</text>
      </view>

      <!-- 概要 -->
      <view class="yq-card">
        <view class="yq-between">
          <text class="name">{{ profile.displayName }}</text>
          <text class="serial yq-muted">{{ profile.serialNo }}</text>
        </view>
        <view class="tags">
          <yq-tag>{{ profile.age }} 岁</yq-tag>
          <yq-tag v-if="profile.heightCm">{{ profile.heightCm }} cm</yq-tag>
          <yq-tag v-if="profile.education">{{ EDUCATION_LABEL[profile.education] }}</yq-tag>
          <yq-tag v-if="profile.cityName" type="info">{{ profile.cityName }}</yq-tag>
          <yq-tag type="info">{{ MARITAL_LABEL[profile.maritalStatus] }}</yq-tag>
        </view>
        <text v-if="profile.introduction" class="intro">{{ profile.introduction }}</text>
      </view>

      <!-- 基本信息 -->
      <yq-card title="基本信息">
        <view class="row"><text class="k">真实姓名</text><text class="v">{{ plain(profile.realName, '未公开') }}</text></view>
        <view class="row"><text class="k">婚史</text><text class="v">{{ MARITAL_LABEL[profile.maritalStatus] }}</text></view>
        <view class="row"><text class="k">子女</text><text class="v">{{ CHILDREN_LABEL[profile.childrenStatus] }}</text></view>
        <view class="row"><text class="k">房产</text><text class="v">{{ profile.houseStatus ? HOUSE_LABEL[profile.houseStatus] : '未填写' }}</text></view>
        <view class="row"><text class="k">车产</text><text class="v">{{ profile.carStatus ? CAR_LABEL[profile.carStatus] : '未填写' }}</text></view>
        <view class="row"><text class="k">家乡</text><text class="v">{{ profile.hometownCityName || '未填写' }}</text></view>
      </yq-card>

      <!-- 工作学业 -->
      <yq-card title="工作学业">
        <view class="row"><text class="k">学历</text><text class="v">{{ profile.education ? EDUCATION_LABEL[profile.education] : '未填写' }}</text></view>
        <view class="row"><text class="k">学校</text><text class="v">{{ plain(profile.school, '未公开') }}</text></view>
        <view class="row"><text class="k">职业</text><text class="v">{{ profile.occupation || '未填写' }}</text></view>
        <view class="row"><text class="k">单位</text><text class="v">{{ plain(profile.company, '未公开') }}</text></view>
        <view class="row">
          <text class="k">年收入</text>
          <text class="v">
            {{ isMaskedValue(profile.annualIncome) ? plain(profile.annualIncome) : formatIncome(profile.annualIncome as number | null) }}
          </text>
        </view>
      </yq-card>

      <!-- 扩展字段 -->
      <yq-card v-if="Object.keys(profile.extras || {}).length" title="更多">
        <view v-for="(v, k) in profile.extras" :key="k" class="row">
          <text class="k">{{ k }}</text>
          <text class="v">{{ Array.isArray(v) ? v.join('、') : String(v ?? '-') }}</text>
        </view>
      </yq-card>

      <!-- 择偶要求 -->
      <yq-card v-if="profile.preference" title="TA 的择偶要求">
        <view class="row">
          <text class="k">年龄</text>
          <text class="v">
            {{ profile.preference.ageMin ?? '不限' }} - {{ profile.preference.ageMax ?? '不限' }} 岁
          </text>
        </view>
        <view class="row">
          <text class="k">最低学历</text>
          <text class="v">{{ profile.preference.educationMin ? EDUCATION_LABEL[profile.preference.educationMin] : '不限' }}</text>
        </view>
        <view class="row">
          <text class="k">接受婚史</text>
          <text class="v">
            {{ profile.preference.maritalStatus.length ? profile.preference.maritalStatus.map((m) => MARITAL_LABEL[m]).join('、') : '不限' }}
          </text>
        </view>
        <view v-if="profile.preference.description" class="row row--block">
          <text class="k">补充</text>
          <text class="v v--block">{{ profile.preference.description }}</text>
        </view>
      </yq-card>

      <!-- 联系方式：付费墙 -->
      <yq-card title="联系方式">
        <template v-if="!contactLocked">
          <view class="row">
            <text class="k">手机号</text>
            <view class="contact">
              <text class="v">{{ plain(profile.phone, '未填写') }}</text>
              <text v-if="profile.phone" class="copy" @tap="copy(String(profile.phone))">复制</text>
            </view>
          </view>
          <view class="row">
            <text class="k">微信</text>
            <view class="contact">
              <text class="v">{{ plain(profile.wechat, '未填写') }}</text>
              <text v-if="profile.wechat" class="copy" @tap="copy(String(profile.wechat))">复制</text>
            </view>
          </view>
          <text v-if="unlocked" class="yq-muted note">已解锁。请文明沟通，骚扰行为会被封号。</text>
        </template>

        <view v-else class="locked">
          <text class="lock-icon">🔒</text>
          <text class="lock-text">{{ plain(profile.phone, '联系方式未公开') }}</text>
          <text class="lock-desc yq-muted">
            解锁后可直接联系 TA。也可以等红娘牵线成功——那样双方会自动互开联系方式。
          </text>
          <button class="btn btn--primary" :disabled="unlocking" @tap="unlockContact">
            消耗一次解锁次数查看
          </button>
          <text class="lock-link" @tap="goVip">还没有解锁次数？去开通会员 ›</text>
        </view>
      </yq-card>

      <view class="bottom-space" />
    </template>
  </view>
</template>

<style lang="scss" scoped>
.gallery {
  width: 100%;
  height: 640rpx;
}

.gallery--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: $yq-primary-light;
}

.big {
  color: $yq-primary;
  font-size: 140rpx;
}

.photo {
  width: 100%;
  height: 640rpx;
}

.photo-mask {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 16rpx;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 22rpx;
  text-align: center;
}

.name {
  font-size: 38rpx;
  font-weight: 600;
}

.serial {
  font-size: 22rpx;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  margin-top: 16rpx;
}

.intro {
  display: block;
  margin-top: 20rpx;
  padding: 20rpx;
  background: $yq-bg;
  border-radius: 12rpx;
  font-size: 26rpx;
  line-height: 1.8;
}

.row {
  display: flex;
  align-items: center;
  padding: 18rpx 0;
  border-bottom: 1rpx solid $yq-border;
  font-size: 27rpx;
}

.row:last-child {
  border-bottom: none;
}

.row--block {
  align-items: flex-start;
}

.k {
  width: 180rpx;
  color: $yq-text-secondary;
  flex-shrink: 0;
}

.v {
  flex: 1;
}

.v--block {
  line-height: 1.7;
}

.contact {
  display: flex;
  align-items: center;
  flex: 1;
  justify-content: space-between;
}

.copy {
  color: $yq-primary;
  font-size: 24rpx;
}

.note {
  display: block;
  margin-top: 16rpx;
  font-size: 22rpx;
}

.locked {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 30rpx 0 10rpx;
}

.lock-icon {
  font-size: 60rpx;
}

.lock-text {
  margin-top: 16rpx;
  font-size: 30rpx;
}

.lock-desc {
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.7;
  text-align: center;
}

.btn {
  width: 100%;
  margin-top: 30rpx;
  border-radius: 44rpx;
  font-size: 30rpx;
  line-height: 84rpx;
}

.btn--primary {
  background: $yq-primary;
  color: #fff;
}

.lock-link {
  margin-top: 20rpx;
  color: $yq-primary;
  font-size: 24rpx;
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

.bottom-space {
  height: 40rpx;
}
</style>
