<template>
  <div class="page">
    <div class="page-card query-bar">
      <el-form :inline="true" :model="query" @submit.prevent>
        <el-form-item label="关键词">
          <el-input v-model="query.keyword" placeholder="订单号 / 手机号" clearable style="width: 200px" @keyup.enter="search" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部" clearable style="width: 130px">
            <el-option v-for="(label, v) in ORDER_STATUS_LABEL" :key="v" :label="label" :value="v" />
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
      title="订单列表"
      @page-change="onPageChange"
      @size-change="onSizeChange"
    >
      <el-table-column label="订单号" min-width="190">
        <template #default="{ row }"><span class="mono">{{ row.orderNo }}</span></template>
      </el-table-column>
      <el-table-column prop="userPhone" label="用户" width="130">
        <template #default="{ row }"><span class="mono">{{ row.userPhone }}</span></template>
      </el-table-column>
      <el-table-column prop="packageName" label="套餐" width="130" />
      <el-table-column label="金额" width="110" align="right">
        <template #default="{ row }"><MoneyText :value="row.amount" /></template>
      </el-table-column>
      <el-table-column label="通道" width="90" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.payChannel" size="small" effect="plain">{{ CHANNEL_LABEL[row.payChannel] ?? row.payChannel }}</el-tag>
          <span v-else class="text-muted">-</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }"><DictTag dict="orderStatus" :value="row.status" /></template>
      </el-table-column>
      <el-table-column label="退款" width="110" align="right">
        <template #default="{ row }">
          <MoneyText v-if="row.refundAmount" :value="-row.refundAmount" colored />
          <span v-else class="text-muted">-</span>
        </template>
      </el-table-column>
      <el-table-column label="支付时间" width="150">
        <template #default="{ row }">{{ formatDate(row.paidAt) }}</template>
      </el-table-column>
      <el-table-column label="下单时间" width="150">
        <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right" align="center">
        <template #default="{ row }">
          <el-button
            v-if="row.status === 'PAID'"
            v-perm="'order:refund'"
            link
            type="danger"
            @click="refund(row as OrderDto)"
          >
            退款
          </el-button>
          <span v-else class="text-muted">-</span>
        </template>
      </el-table-column>
    </PageTable>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { Refresh, Search } from '@element-plus/icons-vue';
import { ORDER_STATUS_LABEL, type OrderDto, type OrderStatus } from '@yuanqiao/shared';
import { orderApi } from '@/api';
import DictTag from '@/components/DictTag.vue';
import MoneyText from '@/components/MoneyText.vue';
import PageTable from '@/components/PageTable.vue';
import { usePagedTable } from '@/composables/usePagedTable';
import { fen2yuan, formatDate } from '@/utils/format';

const CHANNEL_LABEL: Record<string, string> = { MOCK: '模拟', WECHAT: '微信', ALIPAY: '支付宝' };

interface Query {
  keyword?: string;
  status?: OrderStatus;
}

const { rows, total, page, pageSize, loading, query, load, search, reset, onPageChange, onSizeChange } =
  usePagedTable<OrderDto, Query>((q) => orderApi.list(q), { keyword: '', status: undefined });

async function refund(row: OrderDto): Promise<void> {
  const r = await ElMessageBox.prompt(
    `将全额退款 ${fen2yuan(row.amount)} 元。退款会同时收回已发放权益、回退 VIP 到期日、冲销红娘分润。请填写退款原因：`,
    '订单退款',
    { inputValidator: (v) => (v?.trim() ? true : '原因必填'), type: 'warning' },
  ).catch(() => null);
  if (!r) return;

  await orderApi.refund(row.id, r.value);
  ElMessage.success('退款已发起');
  void load();
}
</script>
