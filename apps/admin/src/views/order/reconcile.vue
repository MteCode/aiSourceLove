<template>
  <div class="page">
    <el-alert
      type="warning"
      :closable="false"
      class="tip"
      title="支付对账"
      description="最危险的是「我方无单、渠道有支付」——钱收了但权益没发，用户会来投诉；其次是金额不一致。系统每天自动跑一次，这里可以手动补跑某天。"
    />

    <div class="page-card">
      <div class="table-toolbar">
        <span class="title">对账记录</span>
        <div>
          <el-date-picker v-model="date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期（默认昨天）" style="width: 200px" />
          <el-button type="primary" :icon="Refresh" :loading="running" @click="run">手动对账</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="rows" border stripe>
        <el-table-column prop="date" label="账期" width="120">
          <template #default="{ row }">{{ formatDay(row.date) }}</template>
        </el-table-column>
        <el-table-column label="通道" width="100">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ row.channel }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="结果" width="150" align="center">
          <template #default="{ row }">
            <el-tag :type="RESULT_TYPE[row.result] ?? 'info'" size="small">
              {{ RESULT_LABEL[row.result] ?? row.result }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="我方 / 渠道 笔数" width="150" align="center">
          <template #default="{ row }">
            <span :class="{ 'text-danger': row.localCount !== row.remoteCount }">
              {{ row.localCount }} / {{ row.remoteCount }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="我方金额" width="130" align="right">
          <template #default="{ row }"><MoneyText :value="row.localAmount" /></template>
        </el-table-column>
        <el-table-column label="渠道金额" width="130" align="right">
          <template #default="{ row }">
            <span :class="{ 'text-danger': row.localAmount !== row.remoteAmount }">
              <MoneyText :value="row.remoteAmount" />
            </span>
          </template>
        </el-table-column>
        <el-table-column label="差异明细" min-width="200">
          <template #default="{ row }">
            <el-popover v-if="row.detail" trigger="click" width="420">
              <template #reference>
                <el-button link type="primary">查看</el-button>
              </template>
              <pre class="detail">{{ pretty(row.detail) }}</pre>
            </el-popover>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="对账时间" width="150">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <template #empty>
          <el-empty description="还没有对账记录" :image-size="80" />
        </template>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
import { payApi, type ReconcileRow } from '@/api';
import MoneyText from '@/components/MoneyText.vue';
import { formatDate, formatDay } from '@/utils/format';

const RESULT_LABEL: Record<string, string> = {
  MATCHED: '平账',
  MISSING_LOCAL: '我方无单（危险）',
  MISSING_REMOTE: '渠道无记录',
  AMOUNT_MISMATCH: '金额不一致',
};

const RESULT_TYPE: Record<string, 'success' | 'danger' | 'warning'> = {
  MATCHED: 'success',
  MISSING_LOCAL: 'danger',
  MISSING_REMOTE: 'warning',
  AMOUNT_MISMATCH: 'danger',
};

const loading = ref(false);
const running = ref(false);
const rows = ref<ReconcileRow[]>([]);
const date = ref<string>();

function pretty(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    rows.value = await payApi.reconcileList();
  } finally {
    loading.value = false;
  }
}

async function run(): Promise<void> {
  running.value = true;
  try {
    await payApi.runReconcile(date.value);
    ElMessage.success('对账已完成');
    void load();
  } finally {
    running.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.tip {
  margin-bottom: 12px;
}

.detail {
  max-height: 320px;
  margin: 0;
  overflow: auto;
  font-size: 12px;
  line-height: 1.6;
}
</style>
