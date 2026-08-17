<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { EDUCATION_LABEL, type ProfileDto } from '@yuanqiao/shared';
import { profileApi } from '@/api';
import { useUserStore } from '@/stores/user';
import { toast } from '@/utils/ui';

/**
 * 认领档案。
 *
 * 线下地推收上来的资料由红娘先录进系统，本人注册后认领，归到自己名下。
 *
 * 两条路，优先走第一条：
 *   1. 手机号自动匹配——红娘代录时填了客户手机号，客户用同一个号注册就能一键认领。
 *      手机号能当凭据是因为注册走过短信验证，等于自证了所有权。
 *   2. 手填编号——给「红娘登记时留的是别人的号」这类情况兜底。
 *      编号是系统的内部标识，让用户去记它是把系统的问题甩给用户，所以只作为退路。
 */
const user = useUserStore();
const serialNo = ref('');
const submitting = ref(false);
const checking = ref(true);
const matched = ref<ProfileDto | null>(null);

onLoad(async () => {
  try {
    matched.value = await profileApi.claimable();
  } catch {
    matched.value = null;
  } finally {
    checking.value = false;
  }
});

async function claimMatched(): Promise<void> {
  submitting.value = true;
  try {
    await profileApi.claim();
    await user.refreshQuietly();
    toast('认领成功', 'success');
    setTimeout(() => goReplace('/pages/profile/edit'), 800);
  } finally {
    submitting.value = false;
  }
}

async function submit(): Promise<void> {
  const no = serialNo.value.trim().toUpperCase();
  if (!no) {
    toast('请输入档案编号');
    return;
  }
  submitting.value = true;
  try {
    await profileApi.claim(no);
    await user.refreshQuietly();
    toast('认领成功', 'success');
    setTimeout(() => goReplace('/pages/profile/edit'), 800);
  } finally {
    submitting.value = false;
  }
}

/** 模板里访问不到 uni，跳转统一走包装函数 */
function goReplace(url: string): void {
  uni.redirectTo({ url });
}
</script>

<template>
  <view class="yq-page">
    <view v-if="checking" class="yq-card">
      <text class="desc yq-muted">正在查找你的资料…</text>
    </view>

    <!-- 手机号匹配上了：直接给一键认领，别让用户去要编号 -->
    <view v-else-if="matched" class="yq-card">
      <text class="title">找到一份属于你的资料</text>
      <text class="desc yq-muted">红娘用你的手机号登记过，确认后归你自己管理。</text>
      <view class="hit">
        <text class="hit-line">
          {{ matched.age }} 岁
          <text v-if="matched.heightCm"> · {{ matched.heightCm }} cm</text>
          <text v-if="matched.education"> · {{ EDUCATION_LABEL[matched.education] }}</text>
        </text>
        <text class="hit-sub yq-muted">{{ matched.cityName || '' }} 编号 {{ matched.serialNo }}</text>
      </view>
      <button class="btn" :disabled="submitting" @tap="claimMatched">就是我，认领</button>
      <text class="alt yq-muted" @tap="matched = null">不是我，改用编号认领</text>
    </view>

    <!-- 匹配不到才退回手填编号 -->
    <view v-else class="yq-card">
      <text class="title">输入档案编号</text>
      <text class="desc yq-muted">
        没找到和你手机号对应的资料。如果红娘线下帮你登记过，
        跟红娘要一下编号（形如 YQ26081000001）。
      </text>
      <input v-model="serialNo" class="input" placeholder="YQ 开头的编号" />
      <button class="btn" :disabled="submitting" @tap="submit">认领</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.hit {
  margin: 24rpx 0;
  padding: 24rpx;
  background: $yq-surface-2;
  border: 1rpx solid $yq-border;
  border-radius: 12rpx;
}

.hit-line {
  display: block;
  font-size: 34rpx;
  font-weight: 600;
  color: $yq-text;
}

.hit-sub {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
}

.alt {
  display: block;
  margin-top: 24rpx;
  font-size: 24rpx;
  text-align: center;
  text-decoration: underline;
}

.title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
}

.desc {
  display: block;
  margin: 16rpx 0 30rpx;
  font-size: 24rpx;
  line-height: 1.7;
}

.input {
  padding: 24rpx;
  background: $yq-bg;
  border-radius: 12rpx;
  font-size: 32rpx;
  text-align: center;
  letter-spacing: 4rpx;
}

.btn {
  margin-top: 40rpx;
  background: $yq-primary;
  color: $yq-on-primary;
  border-radius: 44rpx;
  font-size: 30rpx;
  line-height: 88rpx;
}
</style>
