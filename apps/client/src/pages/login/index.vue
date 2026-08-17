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

/**
 * 没档案的新用户直接引导去填资料——这是留存的第一道坎。
 *
 * 用 reLaunch 而不是 redirectTo + setTimeout：
 * - 原来先弹 2 秒 toast，再等 600ms 跳转，跳转发生在 toast 还显示着的时候，
 *   而且没有 fail 回调，跳不动就完全静默——表现就是"登录成功了但进不去"。
 * - reLaunch 会清空页面栈，登录页本来就不该能返回；
 *   它对 tab 页和非 tab 页都适用，不用分两个 API。
 * - fail 必须处理：跳转失败是死路，不能让用户对着登录页干瞪眼。
 */
function afterLogin(): void {
  const url = user.profileId ? '/pages/square/index' : '/pages/profile/edit?first=1';
  uni.reLaunch({
    url,
    success: () => toast('登录成功', 'success'),
    fail: (e) => {
      uni.showModal({
        title: '进入失败',
        content: `登录已成功，但页面跳转失败：${e?.errMsg ?? '未知原因'}。请重启小程序。`,
        showCancel: false,
      });
    },
  });
}
</script>

<template>
  <view class="login">
    <!-- 抽象双人意象：两团光晕 + 两条相向的曲线，末端几乎相触但不闭合。
         刻意不画具象的人——小屏上的具象插画一定显廉价，留白反而有张力 -->
    <view class="hero" />
    <view class="vignette" />

    <view class="brand">
      <text class="name">同频</text>
      <text class="name-en">TONGPIN</text>
      <text class="slogan">在对的频率上，遇见对的人</text>
    </view>

    <view class="form">
      <view class="field">
        <input
          v-model="phone"
          class="input"
          type="number"
          maxlength="11"
          placeholder="手机号"
          placeholder-class="ph"
        />
      </view>

      <view class="field">
        <input
          v-model="code"
          class="input"
          type="number"
          maxlength="6"
          placeholder="验证码"
          placeholder-class="ph"
        />
        <text :class="['send', { 'send--disabled': !canSend }]" @tap="sendCode">
          {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
        </text>
      </view>

      <button class="btn btn--primary" :disabled="!canLogin" :loading="logging" @tap="loginBySms">
        登录 / 注册
      </button>

      <!-- #ifdef MP-WEIXIN -->
      <button v-if="WX_LOGIN_ENABLED" class="btn btn--wx" @tap="loginByWx">微信一键登录</button>
      <!-- #endif -->

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
 * 登录页 · 深色科技风。
 *
 * 为什么弃用粉色：粉色渐变是婚恋产品的标配，也正因为标配才显廉价。
 * 深底 + 青紫双色光是当下"科技/AI 产品"的通用语汇，
 * 恰好我们的核心确实是一套匹配算法，不是浮夸。
 */

/* 双色主调，深色背景下这两个色饱和度够但不刺眼 */
$teal: #5eead4;
$indigo: #818cf8;
$ink: #070a12;
$fg: #e8ecf4;

.login {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 0 56rpx;
  background: $ink;
  overflow: hidden;
}

.hero {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 900rpx;
  background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA3NTAgOTAwIiB3aWR0aD0iNzUwIiBoZWlnaHQ9IjkwMCI+CiAgPGRlZnM+CiAgICA8cmFkaWFsR3JhZGllbnQgaWQ9ImdBIiBjeD0iNTAlIiBjeT0iNTAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzVFRUFENCIgc3RvcC1vcGFjaXR5PSIuNTUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjNUVFQUQ0IiBzdG9wLW9wYWNpdHk9IjAiLz4KICAgIDwvcmFkaWFsR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQgaWQ9ImdCIiBjeD0iNTAlIiBjeT0iNTAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzgxOENGOCIgc3RvcC1vcGFjaXR5PSIuNTUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjODE4Q0Y4IiBzdG9wLW9wYWNpdHk9IjAiLz4KICAgIDwvcmFkaWFsR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImxpbmVBIiB4MT0iMCIgeTE9IjEiIHgyPSIxIiB5Mj0iMCI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiM1RUVBRDQiIHN0b3Atb3BhY2l0eT0iMCIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjU1JSIgc3RvcC1jb2xvcj0iIzVFRUFENCIgc3RvcC1vcGFjaXR5PSIuODUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjQTVGM0ZDIiBzdG9wLW9wYWNpdHk9Ii4yIi8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJsaW5lQiIgeDE9IjEiIHkxPSIxIiB4Mj0iMCIgeTI9IjAiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjODE4Q0Y4IiBzdG9wLW9wYWNpdHk9IjAiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSI1NSUiIHN0b3AtY29sb3I9IiM4MThDRjgiIHN0b3Atb3BhY2l0eT0iLjg1Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iI0M3RDJGRSIgc3RvcC1vcGFjaXR5PSIuMiIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxmaWx0ZXIgaWQ9InNvZnQiPjxmZUdhdXNzaWFuQmx1ciBzdGREZXZpYXRpb249IjE4Ii8+PC9maWx0ZXI+CiAgPC9kZWZzPgoKICA8IS0tIOS4pOWbouWFieaZle+8muS4jeaYr+WFt+ixoeeahOS6uu+8jOaYryLkuKTkuKrlrZjlnKgi44CC5YW36LGh5o+S55S75Zyo5bCP5bGP5LiK5LiA5a6a5buJ5Lu3IC0tPgogIDxjaXJjbGUgY3g9IjMwMCIgY3k9IjQyMCIgcj0iMjEwIiBmaWxsPSJ1cmwoI2dBKSIvPgogIDxjaXJjbGUgY3g9IjQ1MiIgY3k9IjQ3MCIgcj0iMjEwIiBmaWxsPSJ1cmwoI2dCKSIvPgoKICA8IS0tIOS4pOadoeebuOWQkeeahOabsue6v++8jOacq+err+WHoOS5juebuOinpuS9huS4jemXreWQiOKAlOKAlOeVmeeZveavlOeUu+a7oeabtOacieW8oOWKmyAtLT4KICA8ZyBmaWxsPSJub25lIiBzdHJva2UtbGluZWNhcD0icm91bmQiIGZpbHRlcj0idXJsKCNzb2Z0KSIgb3BhY2l0eT0iLjUiPgogICAgPHBhdGggZD0iTTEyMCA2OTAgQyAyMDAgNTIwLCAzMDAgNDcwLCAzNjYgNDM4IiBzdHJva2U9InVybCgjbGluZUEpIiBzdHJva2Utd2lkdGg9IjEwIi8+CiAgICA8cGF0aCBkPSJNNjMwIDY5MCBDIDU1MCA1MjAsIDQ1MCA0NzAsIDM4NiA0MzgiIHN0cm9rZT0idXJsKCNsaW5lQikiIHN0cm9rZS13aWR0aD0iMTAiLz4KICA8L2c+CiAgPGcgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIj4KICAgIDxwYXRoIGQ9Ik0xMjAgNjkwIEMgMjAwIDUyMCwgMzAwIDQ3MCwgMzY2IDQzOCIgc3Ryb2tlPSJ1cmwoI2xpbmVBKSIgc3Ryb2tlLXdpZHRoPSIyLjUiLz4KICAgIDxwYXRoIGQ9Ik02MzAgNjkwIEMgNTUwIDUyMCwgNDUwIDQ3MCwgMzg2IDQzOCIgc3Ryb2tlPSJ1cmwoI2xpbmVCKSIgc3Ryb2tlLXdpZHRoPSIyLjUiLz4KICA8L2c+CgogIDwhLS0g5Lqk5rGH5aSE55qE5LiA54K55YWJIC0tPgogIDxjaXJjbGUgY3g9IjM3NiIgY3k9IjQzNiIgcj0iMjYiIGZpbGw9IiNFMEYyRkUiIG9wYWNpdHk9Ii4xMiIvPgogIDxjaXJjbGUgY3g9IjM3NiIgY3k9IjQzNiIgcj0iNSIgZmlsbD0iI0YwRkRGQSIgb3BhY2l0eT0iLjkiLz4KCiAgPCEtLSDnqIDnlo/mmJ/ngrnvvIzlgZrmt7HnqbrotKjmhJ8gLS0+CiAgPGcgZmlsbD0iI0NCRDVFMSI+CiAgICA8Y2lyY2xlIGN4PSIxNTAiIGN5PSIxODAiIHI9IjEuNiIgb3BhY2l0eT0iLjUiLz48Y2lyY2xlIGN4PSI2MjAiIGN5PSIyMzAiIHI9IjEuMyIgb3BhY2l0eT0iLjQiLz4KICAgIDxjaXJjbGUgY3g9IjUzMCIgY3k9IjEyMCIgcj0iMS44IiBvcGFjaXR5PSIuNDUiLz48Y2lyY2xlIGN4PSIyMjAiIGN5PSIzMDAiIHI9IjEuMiIgb3BhY2l0eT0iLjM1Ii8+CiAgICA8Y2lyY2xlIGN4PSI2ODAiIGN5PSI1NjAiIHI9IjEuNSIgb3BhY2l0eT0iLjQiLz48Y2lyY2xlIGN4PSI5MCIgY3k9IjQ4MCIgcj0iMS40IiBvcGFjaXR5PSIuMzUiLz4KICAgIDxjaXJjbGUgY3g9IjQxMCIgY3k9IjE1MCIgcj0iMS4xIiBvcGFjaXR5PSIuMyIvPjxjaXJjbGUgY3g9IjMzMCIgY3k9Ijc0MCIgcj0iMS41IiBvcGFjaXR5PSIuMyIvPgogIDwvZz4KPC9zdmc+Cg==');
  background-size: cover;
  background-position: center top;
  pointer-events: none;
}

/* 底部压暗，让表单区从背景里浮出来，避免光斑和输入框打架 */
.vignette {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(180deg, rgba(7, 10, 18, 0) 30%, rgba(7, 10, 18, 0.82) 62%, $ink 82%);
  pointer-events: none;
}

/* ── 品牌 ── */
.brand {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 200rpx;
}

.name {
  font-size: 76rpx;
  font-weight: 600;
  letter-spacing: 16rpx;
  /* 首字缩进抵消字间距，否则视觉重心会偏左 */
  text-indent: 16rpx;
  color: $fg;
}

.name-en {
  margin-top: 10rpx;
  font-size: 20rpx;
  letter-spacing: 10rpx;
  text-indent: 10rpx;
  color: rgba(232, 236, 244, 0.32);
}

.slogan {
  margin-top: 28rpx;
  font-size: 26rpx;
  letter-spacing: 2rpx;
  color: rgba(232, 236, 244, 0.55);
}

/* ── 表单 ── */
.form {
  position: relative;
  margin-top: 200rpx;
}

/* 玻璃拟态：半透明底 + 细边，深色下比实心块更透气 */
.field {
  display: flex;
  align-items: center;
  height: 104rpx;
  padding: 0 32rpx;
  background: rgba(255, 255, 255, 0.045);
  border: 1rpx solid rgba(255, 255, 255, 0.09);
  border-radius: 20rpx;

  & + & {
    margin-top: 20rpx;
  }
}

.input {
  flex: 1;
  min-width: 0;
  font-size: 30rpx;
  color: $fg;
}

.ph {
  color: rgba(232, 236, 244, 0.28);
}

.send {
  flex-shrink: 0;
  padding: 10rpx 22rpx;
  font-size: 24rpx;
  color: $teal;
  background: rgba(94, 234, 212, 0.1);
  border-radius: 14rpx;
}

.send--disabled {
  color: rgba(232, 236, 244, 0.25);
  background: rgba(255, 255, 255, 0.04);
}

.btn {
  margin-top: 44rpx;
  height: 104rpx;
  line-height: 104rpx;
  font-size: 32rpx;
  font-weight: 500;
  border-radius: 20rpx;

  &::after {
    border: none;
  }
}

/* 青→紫渐变呼应背景里那两条曲线，视觉上是同一套语言 */
.btn--primary {
  color: $ink;
  background: linear-gradient(100deg, $teal 0%, $indigo 100%);
  box-shadow: 0 12rpx 36rpx rgba(94, 234, 212, 0.18);

  &[disabled] {
    color: rgba(232, 236, 244, 0.3);
    background: rgba(255, 255, 255, 0.06);
    box-shadow: none;
  }
}

.btn--wx {
  margin-top: 20rpx;
  color: #6ee7a8;
  background: rgba(110, 231, 168, 0.1);
}

.points {
  display: flex;
  align-items: center;
  justify-content: space-around;
  margin-top: 64rpx;
  padding: 34rpx 0;
  background: rgba(255, 255, 255, 0.03);
  border: 1rpx solid rgba(255, 255, 255, 0.06);
  border-radius: 20rpx;
}

.point {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.point-num {
  font-size: 34rpx;
  font-weight: 600;
  color: $teal;
}

.point-label {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: rgba(232, 236, 244, 0.4);
}

.point-line {
  width: 1rpx;
  height: 44rpx;
  background: rgba(255, 255, 255, 0.08);
}

/* ── 协议 ── */
.agree {
  position: relative;
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
  border: 1rpx solid rgba(232, 236, 244, 0.3);
  border-radius: 50%;
}

.checkbox--on {
  background: $teal;
  border-color: $teal;
}

.tick {
  color: $ink;
  font-size: 20rpx;
  line-height: 1;
}

.agree-text {
  font-size: 22rpx;
  color: rgba(232, 236, 244, 0.38);
}

.link {
  color: $teal;
}
</style>
