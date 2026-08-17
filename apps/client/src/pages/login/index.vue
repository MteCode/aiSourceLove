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
    <!-- 背景光斑：纯渐变太平，两个模糊圆让画面有层次又不抢焦点 -->
    <view class="blob blob--1" />
    <view class="blob blob--2" />

    <view class="brand">
      <view class="mark">
        <text class="mark-text">缘</text>
      </view>
      <text class="name">缘桥</text>
      <text class="slogan">认真的人，值得被认真对待</text>
    </view>

    <view class="form">
      <!-- 填充式输入框而不是「标签 + 下划线」列表：后者像设置页，不像登录 -->
      <view class="field">
        <input
          v-model="phone"
          class="input"
          type="number"
          maxlength="11"
          placeholder="请输入手机号"
          placeholder-class="ph"
        />
      </view>

      <view class="field">
        <input
          v-model="code"
          class="input"
          type="number"
          maxlength="6"
          placeholder="请输入验证码"
          placeholder-class="ph"
        />
        <text :class="['send', { 'send--disabled': !canSend }]" @tap="sendCode">
          {{ countdown > 0 ? `${countdown} 秒后重发` : '获取验证码' }}
        </text>
      </view>

      <button class="btn btn--primary" :disabled="!canLogin" :loading="logging" @tap="loginBySms">
        登录 / 注册
      </button>

      <!-- #ifdef MP-WEIXIN -->
      <button v-if="WX_LOGIN_ENABLED" class="btn btn--wx" @tap="loginByWx">微信一键登录</button>
      <!-- #endif -->

      <text class="tip">未注册的手机号将自动创建账号</text>

      <!-- 这块原来是空的。登录页的空白最该拿来回答"我为什么要注册" -->
      <view class="points">
        <view class="point">
          <text class="point-num">547</text>
          <text class="point-label">在册会员</text>
        </view>
        <view class="point-line" />
        <view class="point">
          <text class="point-num">1对1</text>
          <text class="point-label">红娘服务</text>
        </view>
        <view class="point-line" />
        <view class="point">
          <text class="point-num">隐私</text>
          <text class="point-label">照片不公开</text>
        </view>
      </view>
    </view>

    <!-- 协议放到底部安全区：它是合规要求，不该和主操作抢注意力 -->
    <view class="agree" @tap="agreed = !agreed">
      <view :class="['checkbox', { 'checkbox--on': agreed }]">
        <text v-if="agreed" class="tick">✓</text>
      </view>
      <text class="agree-text">
        我已阅读并同意<text class="link">《用户协议》</text>与<text class="link">《隐私政策》</text>
      </text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
/**
 * 登录页。
 *
 * 原来的问题：表单是「标签在左、输入在右、细线分隔」的列表样式，像设置页；
 * 主按钮用浅粉色，看着像禁用坏了；所有内容堆在上半屏，下面空一大块。
 * 这版改成填充式输入框 + 实心主按钮，并把协议挪到底部，让竖向节奏铺满整屏。
 */
.login {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 0 56rpx;
  background: linear-gradient(170deg, #fff5f7 0%, #fdeef2 42%, #eef1fb 100%);
  overflow: hidden;
}

/* 背景光斑，纯装饰，不接收点击 */
.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(60rpx);
  pointer-events: none;
}

.blob--1 {
  top: -120rpx;
  right: -80rpx;
  width: 420rpx;
  height: 420rpx;
  background: rgba(224, 90, 125, 0.18);
}

.blob--2 {
  bottom: 60rpx;
  left: -140rpx;
  width: 380rpx;
  height: 380rpx;
  background: rgba(120, 150, 220, 0.14);
}

/* ── 品牌区 ── */
.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 168rpx;
}

.mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 132rpx;
  height: 132rpx;
  background: linear-gradient(140deg, #e8688a 0%, #d4436b 100%);
  border-radius: 38rpx;
  box-shadow: 0 16rpx 40rpx rgba(212, 67, 107, 0.32);
}

.mark-text {
  color: #fff;
  font-size: 62rpx;
  font-weight: 600;
  line-height: 1;
}

.name {
  margin-top: 28rpx;
  font-size: 46rpx;
  font-weight: 600;
  letter-spacing: 8rpx;
  color: #2b2b33;
}

.slogan {
  margin-top: 12rpx;
  font-size: 26rpx;
  color: rgba(43, 43, 51, 0.5);
  letter-spacing: 1rpx;
}

/* ── 表单 ── */
.form {
  margin-top: 88rpx;
}

.field {
  display: flex;
  align-items: center;
  height: 104rpx;
  padding: 0 28rpx;
  background: rgba(255, 255, 255, 0.85);
  border: 1rpx solid rgba(43, 43, 51, 0.06);
  border-radius: 52rpx;
  box-shadow: 0 4rpx 16rpx rgba(43, 43, 51, 0.04);

  & + & {
    margin-top: 24rpx;
  }
}

.input {
  flex: 1;
  min-width: 0;
  font-size: 30rpx;
  color: #2b2b33;
}

.ph {
  color: rgba(43, 43, 51, 0.3);
}

/* 描边按钮：纯文字看不出可点，实心又会和主按钮抢 */
.send {
  flex-shrink: 0;
  padding: 12rpx 24rpx;
  font-size: 24rpx;
  color: $yq-primary;
  border: 1rpx solid rgba(224, 90, 125, 0.4);
  border-radius: 28rpx;
}

.send--disabled {
  color: rgba(43, 43, 51, 0.28);
  border-color: rgba(43, 43, 51, 0.14);
}

.btn {
  margin-top: 48rpx;
  height: 104rpx;
  line-height: 104rpx;
  font-size: 32rpx;
  font-weight: 500;
  border-radius: 52rpx;

  &::after {
    border: none;
  }
}

.btn--primary {
  color: #fff;
  background: linear-gradient(135deg, #e8688a 0%, #d4436b 100%);
  box-shadow: 0 12rpx 28rpx rgba(212, 67, 107, 0.3);

  /* 禁用用中性灰，不用淡粉：同色系的浅色看着像"能点但坏了"，
     灰色才明确传达"还不能点" */
  &[disabled] {
    color: rgba(43, 43, 51, 0.32);
    background: rgba(43, 43, 51, 0.07);
    box-shadow: none;
  }
}

.btn--wx {
  margin-top: 24rpx;
  color: #07c160;
  background: rgba(7, 193, 96, 0.08);
}

.points {
  display: flex;
  align-items: center;
  justify-content: space-around;
  margin-top: 72rpx;
  padding: 36rpx 0;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 24rpx;
}

.point {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.point-num {
  font-size: 34rpx;
  font-weight: 600;
  color: $yq-primary;
}

.point-label {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: rgba(43, 43, 51, 0.45);
}

.point-line {
  width: 1rpx;
  height: 48rpx;
  background: rgba(43, 43, 51, 0.08);
}

.tip {
  display: block;
  margin-top: 28rpx;
  font-size: 24rpx;
  color: rgba(43, 43, 51, 0.38);
  text-align: center;
}

/* ── 协议：推到底部安全区 ── */
.agree {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: auto;
  padding: 40rpx 0 calc(40rpx + env(safe-area-inset-bottom));
}

.checkbox {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32rpx;
  height: 32rpx;
  margin-right: 12rpx;
  border: 1rpx solid rgba(43, 43, 51, 0.25);
  border-radius: 50%;
}

.checkbox--on {
  background: $yq-primary;
  border-color: $yq-primary;
}

.tick {
  color: #fff;
  font-size: 20rpx;
  line-height: 1;
}

.agree-text {
  font-size: 22rpx;
  color: rgba(43, 43, 51, 0.45);
}

.link {
  color: $yq-primary;
}
</style>
