<script setup lang="ts">
import { onReachBottom, onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import {
  COMMISSION_COOLDOWN_DAYS,
  COMMISSION_STATUS_LABEL,
  CommissionStatus,
  WITHDRAWAL_MIN_AMOUNT,
  WITHDRAWAL_STATUS_LABEL,
  type CommissionDto,
  type MatchmakerStatsDto,
} from '@yuanqiao/shared';
import { matchmakerApi } from '@/api';
import { fen2yuan, formatDate } from '@/utils/format';
import { confirm, hideLoading, loading, toast } from '@/utils/ui';

const stats = ref<MatchmakerStatsDto | null>(null);
const list = ref<CommissionDto[]>([]);
const withdrawals = ref<Record<string, unknown>[]>([]);
const tab = ref<'commission' | 'withdrawal'>('commission');
const page = ref(1);
const listLoading = ref(false);
const finished = ref(false);

// 提现表单
const panelVisible = ref(false);
const amountYuan = ref('');
const account = ref('');
const realName = ref('');
const method = ref('WECHAT');
const submitting = ref(false);

const METHODS = [
  { value: 'WECHAT', label: '微信' },
  { value: 'ALIPAY', label: '支付宝' },
  { value: 'BANK', label: '银行卡' },
];

async function loadStats(): Promise<void> {
  stats.value = await matchmakerApi.myStats();
}

async function loadList(reset = false): Promise<void> {
  if (listLoading.value) return;
  if (reset) {
    page.value = 1;
    finished.value = false;
  }
  if (finished.value) return;

  listLoading.value = true;
  try {
    if (tab.value === 'commission') {
      const res = await matchmakerApi.myCommissions({ page: page.value, pageSize: 20 });
      list.value = reset ? res.list : [...list.value, ...res.list];
      finished.value = list.value.length >= res.total;
    } else {
      const res = await matchmakerApi.myWithdrawals({ page: page.value, pageSize: 20 });
      withdrawals.value = reset ? res.list : [...withdrawals.value, ...res.list];
      finished.value = withdrawals.value.length >= res.total;
    }
    page.value += 1;
  } finally {
    listLoading.value = false;
  }
}

function switchTab(t: 'commission' | 'withdrawal'): void {
  tab.value = t;
  void loadList(true);
}

function openPanel(): void {
  const available = stats.value?.availableBalance ?? 0;
  if (available < WITHDRAWAL_MIN_AMOUNT) {
    toast(`可提现余额需满 ${fen2yuan(WITHDRAWAL_MIN_AMOUNT)} 元`);
    return;
  }
  amountYuan.value = fen2yuan(available);
  panelVisible.value = true;
}

async function submitWithdraw(): Promise<void> {
  const fen = Math.round(Number(amountYuan.value) * 100);
  if (!fen || fen < WITHDRAWAL_MIN_AMOUNT) {
    toast(`单次提现不能少于 ${fen2yuan(WITHDRAWAL_MIN_AMOUNT)} 元`);
    return;
  }
  if (fen > (stats.value?.availableBalance ?? 0)) {
    toast('超出可提现余额');
    return;
  }
  if (!account.value.trim() || !realName.value.trim()) {
    toast('请填写收款账号和真实姓名');
    return;
  }
  if (!(await confirm(`申请提现 ¥${fen2yuan(fen)}，审核通过后打款到你填写的账户。确定吗？`, '提现'))) return;

  submitting.value = true;
  try {
    await matchmakerApi.withdraw({
      amount: fen,
      method: method.value,
      account: account.value.trim(),
      realName: realName.value.trim(),
    });
    toast('提现申请已提交', 'success');
    panelVisible.value = false;
    await loadStats();
    switchTab('withdrawal');
  } finally {
    submitting.value = false;
  }
}

function statusType(s: string): 'success' | 'warning' | 'danger' | 'info' {
  if (s === CommissionStatus.SETTLED || s === 'PAID' || s === 'APPROVED') return 'success';
  if (s === CommissionStatus.PENDING) return 'warning';
  if (s === CommissionStatus.CANCELLED || s === 'REJECTED') return 'danger';
  return 'info';
}

const SOURCE_LABEL: Record<string, string> = {
  ORDER: '会员购卡分润',
  INTRO_SUCCESS: '牵线成功奖励',
  MANUAL: '平台调账',
};

onShow(async () => {
  loading();
  try {
    await loadStats();
    await loadList(true);
  } finally {
    hideLoading();
  }
});

onReachBottom(() => void loadList());
</script>

<template>
  <view class="yq-page">
    <view class="head">
      <text class="balance">¥{{ fen2yuan(stats?.availableBalance) }}</text>
      <text class="balance-label">可提现余额</text>
      <view class="sub-row">
        <text>待结算 ¥{{ fen2yuan(stats?.pendingCommission) }}</text>
        <text>已提现 ¥{{ fen2yuan(stats?.withdrawnAmount) }}</text>
      </view>
      <button class="head-btn" @tap="openPanel">申请提现</button>
      <text class="cool-tip">
        分润在订单支付 {{ COMMISSION_COOLDOWN_DAYS }} 天后转为可提现（防止用户退款）
      </text>
    </view>

    <view class="tabs">
      <text :class="['tab', { 'tab--on': tab === 'commission' }]" @tap="switchTab('commission')">收益明细</text>
      <text :class="['tab', { 'tab--on': tab === 'withdrawal' }]" @tap="switchTab('withdrawal')">提现记录</text>
    </view>

    <!-- 收益明细 -->
    <template v-if="tab === 'commission'">
      <view v-for="c in list" :key="c.id" class="item">
        <view class="yq-between">
          <text class="source">{{ SOURCE_LABEL[c.source] ?? c.source }}</text>
          <text class="amount">+¥{{ fen2yuan(c.amount) }}</text>
        </view>
        <view class="yq-between meta">
          <text class="yq-muted">{{ formatDate(c.createdAt, true) }}</text>
          <yq-tag :type="statusType(c.status)">{{ COMMISSION_STATUS_LABEL[c.status] }}</yq-tag>
        </view>
        <text v-if="c.status === 'PENDING' && c.settleAt" class="settle yq-muted">
          {{ formatDate(c.settleAt) }} 可提现
        </text>
        <text v-if="c.remark" class="remark yq-muted">{{ c.remark }}</text>
      </view>
      <yq-empty v-if="!list.length && !listLoading" icon="💰" text="还没有收益记录" />
    </template>

    <!-- 提现记录 -->
    <template v-else>
      <view v-for="w in withdrawals" :key="String(w.id)" class="item">
        <view class="yq-between">
          <text class="source">提现到{{ w.method === 'ALIPAY' ? '支付宝' : w.method === 'BANK' ? '银行卡' : '微信' }}</text>
          <text class="amount">¥{{ fen2yuan(w.amount as number) }}</text>
        </view>
        <view class="yq-between meta">
          <text class="yq-muted">{{ formatDate(w.createdAt as string, true) }}</text>
          <yq-tag :type="statusType(String(w.status))">
            {{ WITHDRAWAL_STATUS_LABEL[w.status as keyof typeof WITHDRAWAL_STATUS_LABEL] ?? w.status }}
          </yq-tag>
        </view>
        <text v-if="w.rejectReason" class="remark yq-danger">拒绝原因：{{ w.rejectReason }}</text>
      </view>
      <yq-empty v-if="!withdrawals.length && !listLoading" icon="🏦" text="还没有提现记录" />
    </template>

    <view v-if="listLoading" class="loading yq-muted">加载中…</view>

    <!-- 提现面板 -->
    <view v-if="panelVisible" class="mask" @tap="panelVisible = false">
      <view class="panel" @tap.stop>
        <text class="panel-title">申请提现</text>

        <view class="field">
          <text class="label">金额</text>
          <input v-model="amountYuan" class="input" type="digit" placeholder="提现金额" />
          <text class="unit">元</text>
        </view>

        <view class="field">
          <text class="label">收款方式</text>
          <view class="methods">
            <text
              v-for="m in METHODS"
              :key="m.value"
              :class="['m-chip', { 'm-chip--on': method === m.value }]"
              @tap="method = m.value"
            >
              {{ m.label }}
            </text>
          </view>
        </view>

        <view class="field">
          <text class="label">收款账号</text>
          <input v-model="account" class="input" placeholder="微信号 / 支付宝账号 / 银行卡号" />
        </view>

        <view class="field">
          <text class="label">真实姓名</text>
          <input v-model="realName" class="input" placeholder="需与账户实名一致" />
        </view>

        <text class="panel-tip yq-muted">
          可提现 ¥{{ fen2yuan(stats?.availableBalance) }}，单次不少于 ¥{{ fen2yuan(WITHDRAWAL_MIN_AMOUNT) }}。
          提交后由平台审核，通过后打款。
        </text>

        <button class="panel-btn" :disabled="submitting" @tap="submitWithdraw">提交申请</button>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.head {
  padding: 40rpx;
  background: linear-gradient(120deg, #e05a7d, #f0a0b6);
  color: #fff;
  text-align: center;
}

.balance {
  display: block;
  font-size: 64rpx;
  font-weight: 700;
  line-height: 1.2;
}

.balance-label {
  display: block;
  font-size: 24rpx;
  opacity: 0.9;
}

.sub-row {
  display: flex;
  justify-content: center;
  gap: 40rpx;
  margin-top: 16rpx;
  font-size: 24rpx;
  opacity: 0.9;
}

.head-btn {
  width: 320rpx;
  margin-top: 30rpx;
  background: #fff;
  color: $yq-primary;
  border-radius: 40rpx;
  font-size: 28rpx;
  line-height: 76rpx;
}

.cool-tip {
  display: block;
  margin-top: 20rpx;
  font-size: 20rpx;
  opacity: 0.85;
}

.tabs {
  display: flex;
  background: #fff;
}

.tab {
  flex: 1;
  padding: 24rpx 0;
  color: $yq-text-secondary;
  font-size: 28rpx;
  text-align: center;
}

.tab--on {
  color: $yq-primary;
  font-weight: 600;
  border-bottom: 4rpx solid $yq-primary;
}

.item {
  margin: 16rpx 20rpx;
  padding: 24rpx;
  background: #fff;
  border-radius: $yq-radius;
}

.source {
  font-size: 28rpx;
  font-weight: 500;
}

.amount {
  color: $yq-primary;
  font-size: 32rpx;
  font-weight: 700;
}

.meta {
  margin-top: 12rpx;
  font-size: 22rpx;
}

.settle,
.remark {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
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
  margin-bottom: 20rpx;
  font-size: 32rpx;
  font-weight: 600;
  text-align: center;
}

.field {
  display: flex;
  align-items: center;
  padding: 22rpx 0;
  border-bottom: 1rpx solid $yq-border;
}

.label {
  width: 160rpx;
  font-size: 27rpx;
  flex-shrink: 0;
}

.input {
  flex: 1;
  font-size: 28rpx;
}

.unit {
  color: $yq-text-secondary;
}

.methods {
  display: flex;
}

.m-chip {
  padding: 8rpx 24rpx;
  margin-right: 14rpx;
  background: $yq-bg;
  border: 1rpx solid transparent;
  border-radius: 28rpx;
  font-size: 24rpx;
}

.m-chip--on {
  background: $yq-primary-light;
  border-color: $yq-primary;
  color: $yq-primary;
}

.panel-tip {
  display: block;
  margin-top: 20rpx;
  font-size: 22rpx;
  line-height: 1.7;
}

.panel-btn {
  margin-top: 24rpx;
  background: $yq-primary;
  color: #fff;
  border-radius: 44rpx;
  font-size: 30rpx;
  line-height: 88rpx;
}
</style>
