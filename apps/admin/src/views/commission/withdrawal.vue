<template>
  <div class="page">
    <el-alert
      type="warning"
      :closable="false"
      class="tip"
      title="提现审核"
      :description="`起提金额 ${fen2yuan(WITHDRAWAL_MIN_AMOUNT)} 元。拒绝会把钱退回红娘的可提现余额；标记「已打款」前请先在支付渠道完成转账。`"
    />

    <div class="page-card query-bar">
      <el-form :inline="true" :model="query" @submit.prevent>
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部" clearable style="width: 140px">
            <el-option v-for="(label, v) in WITHDRAWAL_STATUS_LABEL" :key="v" :label="label" :value="v" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="search">查询</el-button>
          <el-button :icon="Refresh" @click="reset">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <PageTable
      :rows="rows"
      :total="total"
      :page="page"
      :page-size="pageSize"
      :loading="loading"
      title="提现单"
      @page-change="onPageChange"
      @size-change="onSizeChange"
    >
      <el-table-column label="红娘" width="150">
        <template #default="{ row }">
          <div>{{ row.matchmaker?.name ?? '-' }}</div>
          <div class="text-muted mono small">{{ row.matchmaker?.phone ?? '' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="金额" width="120" align="right">
        <template #default="{ row }"><MoneyText :value="row.amount" /></template>
      </el-table-column>
      <el-table-column label="收款方式" width="110">
        <template #default="{ row }">{{ METHOD_LABEL[row.method ?? ''] ?? row.method ?? '-' }}</template>
      </el-table-column>
      <el-table-column label="收款账号" min-width="180">
        <template #default="{ row }">
          <div class="mono">{{ row.account ?? '-' }}</div>
          <div class="text-muted small">{{ row.realName ?? '' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="110" align="center">
        <template #default="{ row }"><DictTag dict="withdrawalStatus" :value="row.status" /></template>
      </el-table-column>
      <el-table-column label="申请时间" width="150">
        <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="备注" min-width="140" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.rejectReason" class="text-danger">拒绝：{{ row.rejectReason }}</span>
          <span v-else>{{ row.remark ?? '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right" align="center">
        <template #default="{ row }">
          <template v-if="row.status === 'PENDING'">
            <el-button v-perm="'withdrawal:review'" link type="success" @click="review(row, 'APPROVED')">通过</el-button>
            <el-button v-perm="'withdrawal:review'" link type="danger" @click="review(row, 'REJECTED')">拒绝</el-button>
          </template>
          <template v-else-if="row.status === 'APPROVED'">
            <el-button v-perm="'withdrawal:review'" link type="primary" @click="review(row, 'PAID')">标记已打款</el-button>
            <el-button v-perm="'withdrawal:review'" link type="danger" @click="review(row, 'REJECTED')">拒绝</el-button>
          </template>
          <span v-else class="text-muted">已完结</span>
        </template>
      </el-table-column>
    </PageTable>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { Refresh, Search } from '@element-plus/icons-vue';
import {
  WITHDRAWAL_MIN_AMOUNT,
  WITHDRAWAL_STATUS_LABEL,
  type WithdrawalStatus,
} from '@yuanqiao/shared';
import { commissionApi, type WithdrawalRow } from '@/api';
import DictTag from '@/components/DictTag.vue';
import MoneyText from '@/components/MoneyText.vue';
import PageTable from '@/components/PageTable.vue';
import { usePagedTable } from '@/composables/usePagedTable';
import { fen2yuan, formatDate } from '@/utils/format';

const METHOD_LABEL: Record<string, string> = { WECHAT: '微信', ALIPAY: '支付宝', BANK: '银行卡' };

const { rows, total, page, pageSize, loading, query, load, search, reset, onPageChange, onSizeChange } =
  usePagedTable<WithdrawalRow, { status?: WithdrawalStatus }>(
    (q) => commissionApi.listWithdrawals(q),
    { status: undefined },
  );

async function review(row: WithdrawalRow, status: WithdrawalStatus): Promise<void> {
  const label = WITHDRAWAL_STATUS_LABEL[status];

  if (status === 'REJECTED') {
    const r = await ElMessageBox.prompt(
      `拒绝后 ${fen2yuan(row.amount)} 元会退回该红娘的可提现余额。请填写拒绝理由：`,
      '拒绝提现',
      { inputValidator: (v) => (v?.trim() ? true : '理由必填') },
    ).catch(() => null);
    if (!r) return;
    await commissionApi.reviewWithdrawal(row.id, { status, rejectReason: r.value });
  } else {
    const tip =
      status === 'PAID'
        ? `请确认已在渠道完成 ${fen2yuan(row.amount)} 元的转账，此操作不可撤销。`
        : `确认通过 ${fen2yuan(row.amount)} 元的提现申请？通过后待打款。`;
    await ElMessageBox.confirm(tip, label, { type: 'warning' });
    await commissionApi.reviewWithdrawal(row.id, { status });
  }

  ElMessage.success('已处理');
  void load();
}
</script>

<style scoped>
.tip {
  margin-bottom: 12px;
}

.small {
  font-size: 12px;
}
</style>
