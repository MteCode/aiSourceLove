<script setup lang="ts">
import { onReachBottom, onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { ORDER_STATUS_LABEL, OrderStatus, type OrderDto } from '@yuanqiao/shared';
import { orderApi } from '@/api';
import { fen2yuan, formatDate } from '@/utils/format';
import { confirm, toast } from '@/utils/ui';

const list = ref<OrderDto[]>([]);
const page = ref(1);
const loading = ref(false);
/** 请求失败和「确实没数据」要分开：都显示成空态会把故障说成没结果，很难查 */
const failed = ref(false);
const finished = ref(false);

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
    const res = await orderApi.mine({ page: page.value, pageSize: 20 });
    list.value = reset ? res.list : [...list.value, ...res.list];
    finished.value = list.value.length >= res.total;
    page.value += 1;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}

/** 未支付的订单可以继续付。超时后端会自动关单 */
async function payAgain(order: OrderDto): Promise<void> {
  if (!(await confirm(`继续支付 ¥${fen2yuan(order.amount)}？`, '继续支付'))) return;
  await orderApi.mockConfirm(order.orderNo);
  toast('支付成功', 'success');
  void load(true);
}

function statusType(s: string): 'success' | 'warning' | 'danger' | 'info' {
  if (s === OrderStatus.PAID) return 'success';
  if (s === OrderStatus.PENDING) return 'warning';
  if (s === OrderStatus.REFUNDED || s === OrderStatus.REFUNDING) return 'danger';
  return 'info';
}

function copy(text: string): void {
  uni.setClipboardData({ data: text, success: () => toast('订单号已复制') });
}

onShow(() => void load(true));
onReachBottom(() => void load());
</script>

<template>
  <view class="yq-page">
    <view v-for="o in list" :key="o.id" class="item">
      <view class="yq-between">
        <text class="no" @tap="copy(o.orderNo)">{{ o.orderNo }}</text>
        <yq-tag :type="statusType(o.status)">{{ ORDER_STATUS_LABEL[o.status] }}</yq-tag>
      </view>

      <view class="body">
        <view>
          <text class="pkg">{{ o.packageName }}</text>
          <text class="time yq-muted">下单 {{ formatDate(o.createdAt, true) }}</text>
          <text v-if="o.paidAt" class="time yq-muted">支付 {{ formatDate(o.paidAt, true) }}</text>
        </view>
        <view class="amount">
          <text class="money">¥{{ fen2yuan(o.amount) }}</text>
          <text v-if="o.refundAmount" class="refund yq-danger">已退 ¥{{ fen2yuan(o.refundAmount) }}</text>
        </view>
      </view>

      <view v-if="o.refundReason" class="reason yq-muted">退款原因：{{ o.refundReason }}</view>

      <view v-if="o.status === 'PENDING'" class="ops">
        <text class="expire yq-muted">
          {{ o.expireAt ? `${formatDate(o.expireAt, true)} 前未支付将自动关闭` : '' }}
        </text>
        <button class="op-btn" @tap="payAgain(o)">继续支付</button>
      </view>
    </view>

    <yq-empty
        v-if="failed"
        icon="⚠️"
        text="加载失败，请检查网络后重试"
        retryable
        @retry="load(true)"
      />
      <yq-empty v-else-if="!list.length && !loading" icon="🧾" text="还没有订单" />
    <view v-if="loading" class="loading yq-muted">加载中…</view>
  </view>
</template>

<style lang="scss" scoped>
.item {
  margin: 20rpx;
  padding: 24rpx;
  background: $yq-surface;
  border-radius: $yq-radius;
}

.no {
  color: $yq-text-secondary;
  font-size: 22rpx;
}

.body {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-top: 16rpx;
}

.pkg {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
}

.time {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
}

.amount {
  text-align: right;
}

.money {
  display: block;
  color: $yq-primary;
  font-size: 34rpx;
  font-weight: 700;
}

.refund {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
}

.reason {
  margin-top: 12rpx;
  font-size: 22rpx;
}

.ops {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 20rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid $yq-border;
}

.expire {
  flex: 1;
  font-size: 20rpx;
}

.op-btn {
  width: 200rpx;
  margin: 0;
  background: $yq-primary;
  color: $yq-on-primary;
  border-radius: 32rpx;
  font-size: 26rpx;
  line-height: 64rpx;
}

.loading {
  padding: 30rpx;
  font-size: 24rpx;
  text-align: center;
}
</style>
