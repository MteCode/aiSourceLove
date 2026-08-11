<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { reactive, ref } from 'vue';
import type { MatchmakerDto } from '@yuanqiao/shared';
import { matchmakerApi } from '@/api';
import { useUserStore } from '@/stores/user';
import { toast } from '@/utils/ui';

const user = useUserStore();
const existing = ref<MatchmakerDto | null>(null);
const submitting = ref(false);

const form = reactive({ name: '', phone: '', cityName: '', bio: '' });

async function load(): Promise<void> {
  if (!user.requireLogin()) return;
  existing.value = await matchmakerApi.me();
  if (existing.value) {
    form.name = existing.value.name;
    form.phone = existing.value.phone;
    form.cityName = existing.value.cityName ?? '';
    form.bio = existing.value.bio ?? '';
  } else {
    form.phone = user.user?.phone ?? '';
  }
}

async function submit(): Promise<void> {
  if (!form.name.trim()) return toast('请填写你的真实姓名');
  if (!/^1[3-9]\d{9}$/.test(form.phone)) return toast('手机号格式不正确');

  submitting.value = true;
  try {
    await matchmakerApi.apply({
      name: form.name.trim(),
      phone: form.phone,
      cityName: form.cityName.trim() || undefined,
      bio: form.bio.trim() || undefined,
    });
    toast('申请已提交，等待审核', 'success');
    await load();
  } finally {
    submitting.value = false;
  }
}

onShow(load);

function goReplace(url: string): void {
  uni.redirectTo({ url });
}
</script>

<template>
  <view class="yq-page">
    <view v-if="existing" :class="['status', `status--${existing.status}`]">
      <text class="status-title">
        {{ existing.status === 'ACTIVE' ? '入驻已通过' : existing.status === 'PENDING' ? '申请审核中' : '账号已停用' }}
      </text>
      <text class="status-tip">
        <template v-if="existing.status === 'ACTIVE'">
          分润比例 {{ Math.round(existing.commissionRate * 100) }}%，可以开始为会员牵线了
        </template>
        <template v-else-if="existing.status === 'PENDING'">
          我们会在 1-3 个工作日内完成审核，通过后即可开始接单
        </template>
        <template v-else>如有疑问请联系平台客服</template>
      </text>
      <button
        v-if="existing.status === 'ACTIVE'"
        class="status-btn"
        @tap="goReplace('/pages/matchmaker/workbench')"
      >
        进入工作台
      </button>
    </view>

    <view class="yq-card intro">
      <text class="intro-title">成为缘桥红娘</text>
      <view class="benefit"><text class="dot">·</text><text>名下会员购买会员卡，你可以拿到分润</text></view>
      <view class="benefit"><text class="dot">·</text><text>牵线成功另有成单奖励</text></view>
      <view class="benefit"><text class="dot">·</text><text>可代录线下资料，会员之后凭编号认领</text></view>
      <view class="benefit"><text class="dot">·</text><text>能看到名下会员的完整资料，方便精准撮合</text></view>
    </view>

    <yq-card :title="existing ? '修改资料' : '填写申请'">
      <view class="field">
        <text class="label">真实姓名</text>
        <input v-model="form.name" class="input" placeholder="会展示给会员" maxlength="50" />
      </view>
      <view class="field">
        <text class="label">联系电话</text>
        <input v-model="form.phone" class="input" type="number" maxlength="11" placeholder="会员会通过这个号码联系你" />
      </view>
      <view class="field">
        <text class="label">服务城市</text>
        <input v-model="form.cityName" class="input" placeholder="如 深圳市" maxlength="50" />
      </view>
      <view class="field field--block">
        <text class="label">个人简介</text>
        <textarea
          v-model="form.bio"
          class="area"
          placeholder="介绍下你的从业经历和擅长撮合的人群，会员会看到这段"
          maxlength="1000"
        />
      </view>

      <button class="btn" :disabled="submitting" @tap="submit">
        {{ existing ? '保存修改' : '提交申请' }}
      </button>
    </yq-card>
  </view>
</template>

<style lang="scss" scoped>
.status {
  margin: 20rpx;
  padding: 28rpx;
  border-radius: $yq-radius;
  background: #fff;
}

.status--PENDING {
  background: #fdf6ec;
}

.status--ACTIVE {
  background: #f0f9eb;
}

.status--SUSPENDED {
  background: #fef0f0;
}

.status-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
}

.status-tip {
  display: block;
  margin-top: 10rpx;
  color: $yq-text-secondary;
  font-size: 24rpx;
  line-height: 1.6;
}

.status-btn {
  margin-top: 20rpx;
  background: $yq-primary;
  color: #fff;
  border-radius: 40rpx;
  font-size: 28rpx;
  line-height: 76rpx;
}

.intro-title {
  display: block;
  margin-bottom: 16rpx;
  font-size: 32rpx;
  font-weight: 600;
}

.benefit {
  display: flex;
  padding: 8rpx 0;
  font-size: 26rpx;
  line-height: 1.7;
}

.dot {
  padding-right: 12rpx;
  color: $yq-primary;
}

.field {
  display: flex;
  align-items: center;
  padding: 22rpx 0;
  border-bottom: 1rpx solid $yq-border;
}

.field--block {
  display: block;
}

.label {
  width: 180rpx;
  font-size: 28rpx;
  flex-shrink: 0;
}

.input {
  flex: 1;
  font-size: 28rpx;
}

.area {
  width: 100%;
  height: 180rpx;
  margin-top: 16rpx;
  padding: 16rpx;
  background: $yq-bg;
  border-radius: 12rpx;
  font-size: 26rpx;
  box-sizing: border-box;
}

.btn {
  margin-top: 40rpx;
  background: $yq-primary;
  color: #fff;
  border-radius: 44rpx;
  font-size: 30rpx;
  line-height: 88rpx;
}
</style>
