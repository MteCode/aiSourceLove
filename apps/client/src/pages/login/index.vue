<script setup lang="ts">
import { WX_LOGIN_ENABLED } from '@/utils/feature';
import { onLoad } from '@dcloudio/uni-app';
import { computed, ref } from 'vue';
import { SMS_CODE_INTERVAL_SECONDS } from '@yuanqiao/shared';
import { authApi } from '@/api';
import { useUserStore } from '@/stores/user';
import { inviteStore } from '@/utils/storage';
import { toast } from '@/utils/ui';

const user = useUserStore();

const phone = ref('');
const code = ref('');
const agreed = ref(false);
const sending = ref(false);
const logging = ref(false);
const countdown = ref(0);

const phoneValid = computed(() => /^1[3-9]\d{9}$/.test(phone.value));
const canSend = computed(() => phoneValid.value && countdown.value === 0 && !sending.value);
const canLogin = computed(() => phoneValid.value && code.value.length >= 4 && !logging.value);

// 分享链接直接指向登录页时在这里捡参数。
// App.onLaunch 也捡一次——分享可能指向广场等任意页面，只在登录页捡会漏。
onLoad((options) => inviteStore.capture(options));

async function sendCode(): Promise<void> {
  if (!canSend.value) return;
  sending.value = true;
  try {
    await authApi.sendSmsCode(phone.value);
    toast('验证码已发送');
    countdown.value = SMS_CODE_INTERVAL_SECONDS;
    const timer = setInterval(() => {
      countdown.value -= 1;
      if (countdown.value <= 0) clearInterval(timer);
    }, 1000);
  } finally {
    sending.value = false;
  }
}

function checkAgreed(): boolean {
  if (agreed.value) return true;
  toast('请先阅读并同意用户协议与隐私政策');
  return false;
}

async function loginBySms(): Promise<void> {
  if (!canLogin.value || !checkAgreed()) return;
  logging.value = true;
  try {
    await user.loginBySms(phone.value, code.value);
    afterLogin();
  } finally {
    logging.value = false;
  }
}

async function loginByWx(): Promise<void> {
  if (!checkAgreed()) return;
  logging.value = true;
  try {
    await user.loginByWx();
    afterLogin();
  } catch {
    toast('微信登录失败，请用手机号登录');
  } finally {
    logging.value = false;
  }
}

/** 没档案的新用户直接引导去填资料——这是留存的第一道坎 */
function afterLogin(): void {
  toast('登录成功', 'success');
  setTimeout(() => {
    if (!user.profileId) {
      uni.redirectTo({ url: '/pages/profile/edit?first=1' });
    } else {
      uni.switchTab({ url: '/pages/square/index' });
    }
  }, 600);
}
</script>

<template>
  <view class="login">
    <view class="brand">
      <view class="mark">缘</view>
      <text class="name">缘桥</text>
      <text class="slogan">认真的人，值得被认真对待</text>
    </view>

    <view class="form">
      <view class="field">
        <text class="label">手机号</text>
        <input v-model="phone" class="input" type="number" maxlength="11" placeholder="请输入手机号" />
      </view>

      <view class="field">
        <text class="label">验证码</text>
        <input v-model="code" class="input" type="number" maxlength="6" placeholder="请输入验证码" />
        <text :class="['send', { 'send--disabled': !canSend }]" @tap="sendCode">
          {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
        </text>
      </view>

      <button class="btn btn--primary" :disabled="!canLogin" @tap="loginBySms">登录 / 注册</button>

      <!-- #ifdef MP-WEIXIN -->
      <button v-if="WX_LOGIN_ENABLED" class="btn btn--wx" @tap="loginByWx">微信一键登录</button>
      <!-- #endif -->

      <view class="agree" @tap="agreed = !agreed">
        <view :class="['checkbox', { 'checkbox--on': agreed }]">
          <text v-if="agreed">✓</text>
        </view>
        <text class="agree-text">
          我已阅读并同意<text class="link">《用户协议》</text>与<text class="link">《隐私政策》</text>
        </text>
      </view>

      <text class="tip yq-muted">未注册的手机号将自动创建账号</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.login {
  min-height: 100vh;
  padding: 160rpx 60rpx 0;
  background: linear-gradient(160deg, #fdeef2 0%, #eef2fb 100%);
}

.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 80rpx;
}

.mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 120rpx;
  height: 120rpx;
  border-radius: 32rpx;
  background: $yq-primary;
  color: #fff;
  font-size: 60rpx;
  font-weight: 700;
}

.name {
  margin-top: 24rpx;
  font-size: 44rpx;
  font-weight: 600;
  letter-spacing: 8rpx;
}

.slogan {
  margin-top: 10rpx;
  color: $yq-text-secondary;
  font-size: 24rpx;
}

.form {
  padding: 40rpx 32rpx;
  background: #fff;
  border-radius: 24rpx;
}

.field {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid $yq-border;
}

.label {
  width: 140rpx;
  color: $yq-text-secondary;
  font-size: 26rpx;
}

.input {
  flex: 1;
  font-size: 30rpx;
}

.send {
  color: $yq-primary;
  font-size: 26rpx;
}

.send--disabled {
  color: $yq-text-secondary;
}

.btn {
  margin-top: 40rpx;
  border-radius: 44rpx;
  font-size: 30rpx;
  line-height: 88rpx;
}

.btn--primary {
  background: $yq-primary;
  color: #fff;
}

.btn--primary[disabled] {
  background: #f0c3ce;
  color: #fff;
}

.btn--wx {
  background: #07c160;
  color: #fff;
}

.agree {
  display: flex;
  align-items: center;
  margin-top: 32rpx;
}

.checkbox {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32rpx;
  height: 32rpx;
  margin-right: 12rpx;
  border: 1rpx solid #dcdfe6;
  border-radius: 50%;
  color: #fff;
  font-size: 20rpx;
  flex-shrink: 0;
}

.checkbox--on {
  background: $yq-primary;
  border-color: $yq-primary;
}

.agree-text {
  color: $yq-text-secondary;
  font-size: 22rpx;
}

.link {
  color: $yq-primary;
}

.tip {
  display: block;
  margin-top: 24rpx;
  font-size: 22rpx;
  text-align: center;
}
</style>
