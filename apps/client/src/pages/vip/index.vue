<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { computed, ref } from 'vue';
import { BENEFIT_META, RESET_CYCLE_LABEL, type VipPackageDto } from '@yuanqiao/shared';
import { orderApi, vipApi } from '@/api';
import { useUserStore } from '@/stores/user';
import { fen2yuan, formatDate } from '@/utils/format';
import { confirm, hideLoading, loading, toast } from '@/utils/ui';

const user = useUserStore();

const packages = ref<VipPackageDto[]>([]);
const selectedId = ref('');
const paying = ref(false);

const selected = computed(() => packages.value.find((p) => p.id === selectedId.value));

async function load(): Promise<void> {
  loading();
  try {
    packages.value = await vipApi.packages();
    // 默认选中推荐款，其次第一款
    const rec = packages.value.find((p) => p.isRecommended) ?? packages.value[0];
    if (rec) selectedId.value = rec.id;
  } finally {
    hideLoading();
  }
}

async function pay(): Promise<void> {
  if (!selected.value || paying.value) return;
  if (!(await user.requireLogin())) return;

  paying.value = true;
  try {
    const res = await orderApi.create(selected.value.id);
    const channel = res.order.payChannel;

    if (channel === 'WECHAT') {
      await payByWechat(res.payParams);
    } else {
      // mock 通道：本地和演示环境跑通链路用，走的是和真实回调相同的服务端路径
      const ok = await confirm(
        `模拟支付 ¥${fen2yuan(res.order.amount)}。生产环境这里会拉起微信支付。`,
        '模拟支付',
      );
      if (!ok) return;
      await orderApi.mockConfirm(res.order.orderNo);
    }

    await user.refreshQuietly();
    toast('开通成功', 'success');
    setTimeout(() => goto('/pages/vip/benefits'), 800);
  } catch {
    // 错误已由请求层提示
  } finally {
    paying.value = false;
  }
}

function payByWechat(params: Record<string, string>): Promise<void> {
  return new Promise((resolve, reject) => {
    uni.requestPayment({
      provider: 'wxpay',
      timeStamp: params.timeStamp,
      nonceStr: params.nonceStr,
      package: params.package,
      signType: params.signType as 'MD5' | 'RSA' | 'HMAC-SHA256',
      paySign: params.paySign,
      success: () => resolve(),
      fail: () => reject(new Error('支付已取消')),
    });
  });
}

function cycleLabel(code: string, cycle?: string): string {
  const meta = BENEFIT_META[code as keyof typeof BENEFIT_META];
  const c = cycle ?? meta?.defaultCycle;
  return RESET_CYCLE_LABEL[c as keyof typeof RESET_CYCLE_LABEL] ?? '';
}

function benefitLabel(code: string): string {
  return BENEFIT_META[code as keyof typeof BENEFIT_META]?.label ?? code;
}

function benefitUnit(code: string): string {
  return BENEFIT_META[code as keyof typeof BENEFIT_META]?.unit ?? '';
}

onShow(load);

/** 模板里访问不到 uni，跳转统一走包装函数 */
function goto(url: string): void {
  uni.navigateTo({ url });
}
</script>

<template>
  <view class="yq-page">
    <view class="banner">
      <text class="banner-title">缘桥会员</text>
      <text v-if="user.isVip" class="banner-sub">
        有效期至 {{ formatDate(user.user?.vipExpireAt) }}，续费可叠加时长
      </text>
      <text v-else class="banner-sub">解锁联系方式、AI 精准匹配、查看访客</text>
    </view>

    <view class="packages">
      <view
        v-for="p in packages"
        :key="p.id"
        :class="['pkg', { 'pkg--on': selectedId === p.id }]"
        @tap="selectedId = p.id"
      >
        <view v-if="p.isRecommended" class="rec">推荐</view>
        <text class="pkg-name">{{ p.name }}</text>
        <view class="pkg-price">
          <text class="cur">¥</text>
          <text class="num">{{ fen2yuan(p.price) }}</text>
        </view>
        <text v-if="p.originalPrice" class="origin">¥{{ fen2yuan(p.originalPrice) }}</text>
        <text class="days yq-muted">{{ p.durationDays }} 天</text>
      </view>
    </view>

    <yq-card v-if="selected" :title="`${selected.name} 包含的权益`">
      <text v-if="selected.subtitle" class="subtitle yq-muted">{{ selected.subtitle }}</text>
      <view v-for="b in selected.benefits" :key="b.code" class="benefit">
        <text class="check">✓</text>
        <view class="benefit-body">
          <text class="benefit-name">
            {{ benefitLabel(b.code) }}
            <text class="benefit-quota">{{ b.quota }} {{ benefitUnit(b.code) }}</text>
          </text>
          <text class="benefit-cycle yq-muted">{{ cycleLabel(b.code, b.cycle) }}</text>
        </view>
      </view>
      <text class="tip yq-muted">
        权益按次数/天数计算，用完为止或按周期重置。开通后立即生效，续费时长叠加。
      </text>
    </yq-card>

    <yq-empty v-if="!packages.length" icon="🎁" text="暂时没有可购买的套餐" />

    <view class="bottom-space" />

    <view v-if="selected" class="pay-bar">
      <view class="pay-info">
        <text class="pay-price">¥{{ fen2yuan(selected.price) }}</text>
        <text class="pay-name yq-muted">{{ selected.name }}</text>
      </view>
      <button class="pay-btn" :disabled="paying" @tap="pay">
        {{ user.isVip ? '立即续费' : '立即开通' }}
      </button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.banner {
  padding: 50rpx 40rpx;
  background: linear-gradient(120deg, $yq-primary, $yq-primary-2);
  color: $yq-on-primary;
}

.banner-title {
  display: block;
  font-size: 44rpx;
  font-weight: 700;
}

.banner-sub {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  opacity: 0.9;
}

.packages {
  display: flex;
  padding: 24rpx 12rpx;
  overflow-x: auto;
}

.pkg {
  position: relative;
  width: 210rpx;
  margin: 0 8rpx;
  padding: 28rpx 16rpx;
  background: $yq-surface;
  border: 2rpx solid transparent;
  border-radius: 16rpx;
  text-align: center;
  flex-shrink: 0;
}

.pkg--on {
  border-color: $yq-primary;
  background: $yq-primary-light;
}

.rec {
  position: absolute;
  top: -2rpx;
  right: -2rpx;
  padding: 4rpx 14rpx;
  background: $yq-primary;
  color: $yq-on-primary;
  border-radius: 0 16rpx 0 16rpx;
  font-size: 20rpx;
}

.pkg-name {
  font-size: 28rpx;
  font-weight: 600;
}

.pkg-price {
  margin-top: 12rpx;
  color: $yq-primary;
}

.cur {
  font-size: 22rpx;
}

.num {
  font-size: 40rpx;
  font-weight: 700;
}

.origin {
  display: block;
  color: $yq-text-secondary;
  font-size: 22rpx;
  text-decoration: line-through;
}

.days {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
}

.subtitle {
  display: block;
  margin-bottom: 16rpx;
  font-size: 24rpx;
}

.benefit {
  display: flex;
  align-items: flex-start;
  padding: 16rpx 0;
}

.check {
  margin-right: 16rpx;
  color: $yq-success;
  font-size: 28rpx;
}

.benefit-name {
  font-size: 28rpx;
}

.benefit-quota {
  margin-left: 12rpx;
  color: $yq-primary;
  font-weight: 600;
}

.benefit-cycle {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
}

.tip {
  display: block;
  margin-top: 20rpx;
  font-size: 22rpx;
  line-height: 1.7;
}

.bottom-space {
  height: 180rpx;
}

.pay-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  padding: 20rpx 30rpx calc(20rpx + env(safe-area-inset-bottom));
  background: $yq-surface;
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.05);
}

.pay-info {
  flex: 1;
}

.pay-price {
  display: block;
  color: $yq-primary;
  font-size: 38rpx;
  font-weight: 700;
}

.pay-name {
  font-size: 22rpx;
}

.pay-btn {
  width: 280rpx;
  background: $yq-primary;
  color: $yq-on-primary;
  border-radius: 44rpx;
  font-size: 30rpx;
  line-height: 84rpx;
}
</style>
