<template>
  <div class="page">
    <el-alert
      type="info"
      :closable="false"
      class="tip"
      title="分润流水"
      :description="`订单支付后分润先记为「待结算」，过 ${COMMISSION_COOLDOWN_DAYS} 天冷静期才转「可提现」——防的是用户付完就退款、钱已经被提走。`"
    />

    <div class="page-card query-bar">
      <el-form :inline="true" :model="query" @submit.prevent>
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部" clearable style="width: 140px">
            <el-option v-for="(label, v) in COMMISSION_STATUS_LABEL" :key="v" :label="label" :value="v" />
          </el-select>
        </el-form-item>
        <el-form-item label="红娘">
          <el-select v-model="query.matchmakerId" placeholder="全部" clearable filterable style="width: 180px">
            <el-option v-for="m in matchmakers" :key="m.id" :label="m.name" :value="m.id" />
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
      title="分润记录"
      @page-change="onPageChange"
      @size-change="onSizeChange"
    >
      <template #toolbar>
        <el-button v-perm="'commission:settle'" type="primary" :icon="Money" :loading="settling" @click="settle">
          手动结算到期分润
        </el-button>
      </template>

      <el-table-column label="红娘" width="120">
        <template #default="{ row }">{{ nameOf(row.matchmakerId) }}</template>
      </el-table-column>
      <el-table-column label="来源" width="120">
        <template #default="{ row }">
          <el-tag size="small" :type="row.source === 'ORDER' ? 'primary' : row.source === 'INTRO_SUCCESS' ? 'success' : 'info'">
            {{ SOURCE_LABEL[row.source] ?? row.source }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="关联单号" min-width="160">
        <template #default="{ row }">
          <span class="mono">{{ row.refNo ?? '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="金额" width="120" align="right">
        <template #default="{ row }"><MoneyText :value="row.amount" colored /></template>
      </el-table-column>
      <el-table-column label="状态" width="110" align="center">
        <template #default="{ row }"><DictTag dict="commissionStatus" :value="row.status" /></template>
      </el-table-column>
      <el-table-column label="可提现时间" width="150">
        <template #default="{ row }">{{ formatDate(row.settleAt) }}</template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip />
      <el-table-column label="产生时间" width="150">
        <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
      </el-table-column>
    </PageTable>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Money, Refresh, Search } from '@element-plus/icons-vue';
import {
  COMMISSION_COOLDOWN_DAYS,
  COMMISSION_STATUS_LABEL,
  type CommissionDto,
  type CommissionStatus,
  type MatchmakerDto,
} from '@yuanqiao/shared';
import { commissionApi, matchmakerApi } from '@/api';
import DictTag from '@/components/DictTag.vue';
import MoneyText from '@/components/MoneyText.vue';
import PageTable from '@/components/PageTable.vue';
import { usePagedTable } from '@/composables/usePagedTable';
import { fen2yuan, formatDate } from '@/utils/format';

const SOURCE_LABEL: Record<string, string> = {
  ORDER: '会员购卡',
  INTRO_SUCCESS: '牵线成功',
  MANUAL: '手工调账',
};

interface Query {
  status?: CommissionStatus;
  matchmakerId?: string;
}

const { rows, total, page, pageSize, loading, query, load, search, reset, onPageChange, onSizeChange } =
  usePagedTable<CommissionDto, Query>((q) => commissionApi.list(q), {
    status: undefined,
    matchmakerId: undefined,
  });

const matchmakers = ref<MatchmakerDto[]>([]);

function nameOf(id: string): string {
  return matchmakers.value.find((m) => m.id === id)?.name ?? id.slice(0, 8);
}

const settling = ref(false);

async function settle(): Promise<void> {
  await ElMessageBox.confirm(
    `将把已过 ${COMMISSION_COOLDOWN_DAYS} 天冷静期的「待结算」分润全部转为「可提现」，确定吗？`,
    '手动结算',
    { type: 'warning' },
  );
  settling.value = true;
  try {
    const res = await commissionApi.settle();
    ElMessage.success(`已结算 ${res.count} 笔，共 ${fen2yuan(res.amount)} 元`);
    void load();
  } finally {
    settling.value = false;
  }
}

onMounted(async () => {
  const res = await matchmakerApi.list({ page: 1, pageSize: 200 });
  matchmakers.value = res.list;
});
</script>

<style scoped>
.tip {
  margin-bottom: 12px;
}
</style>
