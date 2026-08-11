<script setup lang="ts">
import { ref } from 'vue';
import { profileApi } from '@/api';
import { useUserStore } from '@/stores/user';
import { toast } from '@/utils/ui';

/**
 * 认领档案。
 *
 * 线下地推收上来的资料由红娘先录进系统，本人之后凭编号认领。
 * 这条路径是地推转线上的关键——认领成功后档案就归到自己名下。
 */
const user = useUserStore();
const serialNo = ref('');
const submitting = ref(false);

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
    setTimeout(() => uni.redirectTo({ url: '/pages/profile/edit' }), 800);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <view class="yq-page">
    <view class="yq-card">
      <text class="title">输入档案编号</text>
      <text class="desc yq-muted">
        如果红娘线下帮你登记过资料，跟红娘要一下编号（形如 YQ26081000001），
        认领后这份资料就归你自己管理。
      </text>
      <input v-model="serialNo" class="input" placeholder="YQ 开头的编号" />
      <button class="btn" :disabled="submitting" @tap="submit">认领</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
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
  color: #fff;
  border-radius: 44rpx;
  font-size: 30rpx;
  line-height: 88rpx;
}
</style>
