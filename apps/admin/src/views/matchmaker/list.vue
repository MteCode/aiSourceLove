<template>
  <div class="page">
    <div class="page-card query-bar">
      <el-form :inline="true" :model="query" @submit.prevent>
        <el-form-item label="关键词">
          <el-input v-model="query.keyword" placeholder="姓名 / 手机号" clearable style="width: 190px" @keyup.enter="search" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部" clearable style="width: 130px">
            <el-option label="待审核" value="PENDING" />
            <el-option label="服务中" value="ACTIVE" />
            <el-option label="已停用" value="SUSPENDED" />
          </el-select>
        </el-form-item>
        <el-form-item label="城市">
          <RegionCascader v-model="regionValue" @change="(c) => (query.cityCode = c)" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="search">查询</el-button>
          <el-button :icon="Refresh" @click="onReset">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <PageTable
      :rows="rows"
      :total="total"
      :page="page"
      :page-size="pageSize"
      :loading="loading"
      title="红娘列表"
      @page-change="onPageChange"
      @size-change="onSizeChange"
    >
      <el-table-column label="红娘" min-width="180">
        <template #default="{ row }">
          <div class="mm-cell">
            <el-avatar :size="36" :src="row.avatar || undefined">{{ row.name?.[0] }}</el-avatar>
            <div>
              <div class="name">{{ row.name }}</div>
              <div class="text-muted mono">{{ row.phone }}</div>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="cityName" label="服务城市" width="110" />
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }"><DictTag dict="matchmakerStatus" :value="row.status" /></template>
      </el-table-column>
      <el-table-column label="分润比例" width="100" align="center">
        <template #default="{ row }">{{ percent(row.commissionRate) }}</template>
      </el-table-column>
      <el-table-column prop="memberCount" label="名下会员" width="100" align="center" sortable />
      <el-table-column label="牵线 / 成功" width="120" align="center">
        <template #default="{ row }">
          {{ row.introCount }} / <span class="text-success">{{ row.successCount }}</span>
        </template>
      </el-table-column>
      <el-table-column label="累计分润" width="120" align="right">
        <template #default="{ row }"><MoneyText :value="row.totalCommission" /></template>
      </el-table-column>
      <el-table-column label="可提现" width="120" align="right">
        <template #default="{ row }"><MoneyText :value="row.availableBalance" /></template>
      </el-table-column>
      <el-table-column label="操作" width="170" fixed="right" align="center">
        <template #default="{ row }">
          <el-button link type="primary" @click="openStats(row)">业绩</el-button>
          <el-button v-perm="'matchmaker:review'" link type="primary" @click="openReview(row)">
            {{ row.status === 'PENDING' ? '审核' : '调整' }}
          </el-button>
        </template>
      </el-table-column>
    </PageTable>

    <!-- 入驻审核 / 调整分润 -->
    <el-dialog v-model="reviewVisible" :title="`审核红娘：${current?.name ?? ''}`" width="460px">
      <el-form label-width="90px">
        <el-form-item label="简介">
          <div class="text-muted">{{ current?.bio || '（未填写）' }}</div>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="reviewForm.status">
            <el-radio-button value="ACTIVE">通过 / 启用</el-radio-button>
            <el-radio-button value="SUSPENDED">停用</el-radio-button>
            <el-radio-button value="PENDING">打回待审</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="分润比例">
          <el-input-number v-model="reviewForm.ratePercent" :min="0" :max="100" :step="1" controls-position="right" />
          <span class="text-muted unit">%　名下会员购买 VIP 时红娘可分到的比例</span>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="reviewForm.remark" type="textarea" :rows="2" maxlength="200" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reviewVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitReview">保存</el-button>
      </template>
    </el-dialog>

    <!-- 业绩看板 -->
    <el-drawer v-model="statsVisible" :title="`${current?.name ?? ''} 的业绩`" size="45%">
      <div v-loading="statsLoading">
        <template v-if="stats">
          <el-row :gutter="12">
            <el-col :span="8"><StatCard label="名下会员" :value="stats.memberCount" icon="User" :sub="`本月 +${stats.memberCountThisMonth}`" /></el-col>
            <el-col :span="8"><StatCard label="牵线总数" :value="stats.introCount" icon="Link" color="#409eff" :sub="`本月 +${stats.introCountThisMonth}`" /></el-col>
            <el-col :span="8"><StatCard label="成功率" :value="percent(stats.successRate)" icon="Trophy" color="#67c23a" :sub="`成功 ${stats.successCount} 单`" /></el-col>
          </el-row>
          <el-row :gutter="12" class="mt">
            <el-col :span="6"><StatCard label="累计分润" :value="fen2yuan(stats.totalCommission)" unit="元" icon="Coin" color="#e6a23c" /></el-col>
            <el-col :span="6"><StatCard label="待结算" :value="fen2yuan(stats.pendingCommission)" unit="元" icon="Clock" color="#909399" /></el-col>
            <el-col :span="6"><StatCard label="可提现" :value="fen2yuan(stats.availableBalance)" unit="元" icon="Wallet" color="#67c23a" /></el-col>
            <el-col :span="6"><StatCard label="已提现" :value="fen2yuan(stats.withdrawnAmount)" unit="元" icon="CreditCard" color="#13c2c2" /></el-col>
          </el-row>

          <div class="page-card mt">
            <div class="table-toolbar"><span class="title">牵线漏斗</span></div>
            <EChart :option="funnelOption" height="300px" />
          </div>
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Refresh, Search } from '@element-plus/icons-vue';
import type { EChartsOption } from 'echarts';
import type { MatchmakerDto, MatchmakerStatsDto, MatchmakerStatus } from '@yuanqiao/shared';
import { matchmakerApi } from '@/api';
import DictTag from '@/components/DictTag.vue';
import EChart from '@/components/EChart.vue';
import MoneyText from '@/components/MoneyText.vue';
import PageTable from '@/components/PageTable.vue';
import RegionCascader from '@/components/RegionCascader.vue';
import StatCard from '@/components/StatCard.vue';
import { usePagedTable } from '@/composables/usePagedTable';
import { fen2yuan, percent } from '@/utils/format';

const regionValue = ref<string[]>([]);

interface Query {
  keyword?: string;
  status?: MatchmakerStatus;
  cityCode?: string;
}

const { rows, total, page, pageSize, loading, query, load, search, reset, onPageChange, onSizeChange } =
  usePagedTable<MatchmakerDto, Query>((q) => matchmakerApi.list(q), {
    keyword: '',
    status: undefined,
    cityCode: undefined,
  });

function onReset(): void {
  regionValue.value = [];
  reset();
}

const current = ref<MatchmakerDto | null>(null);

// ── 审核 ──
const reviewVisible = ref(false);
const saving = ref(false);
const reviewForm = reactive({ status: 'ACTIVE' as MatchmakerStatus, ratePercent: 20, remark: '' });

function openReview(row: MatchmakerDto): void {
  current.value = row;
  reviewForm.status = row.status === 'PENDING' ? 'ACTIVE' : (row.status as MatchmakerStatus);
  // 后端存的是 0~1 小数，界面上用百分比更好填
  reviewForm.ratePercent = Math.round((row.commissionRate ?? 0.2) * 100);
  reviewForm.remark = '';
  reviewVisible.value = true;
}

async function submitReview(): Promise<void> {
  if (!current.value) return;
  saving.value = true;
  try {
    await matchmakerApi.review(current.value.id, {
      status: reviewForm.status,
      commissionRate: reviewForm.ratePercent / 100,
      remark: reviewForm.remark || undefined,
    });
    ElMessage.success('已保存');
    reviewVisible.value = false;
    void load();
  } finally {
    saving.value = false;
  }
}

// ── 业绩 ──
const statsVisible = ref(false);
const statsLoading = ref(false);
const stats = ref<MatchmakerStatsDto | null>(null);

async function openStats(row: MatchmakerDto): Promise<void> {
  current.value = row;
  statsVisible.value = true;
  statsLoading.value = true;
  stats.value = null;
  try {
    stats.value = await matchmakerApi.stats(row.id);
  } finally {
    statsLoading.value = false;
  }
}

const funnelOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'item' },
  series: [
    {
      type: 'funnel',
      left: '10%',
      width: '80%',
      sort: 'none',
      gap: 2,
      label: { formatter: '{b}: {c}' },
      data: (stats.value?.funnel ?? []).map((f) => ({ name: f.label, value: f.count })),
    },
  ],
}));
</script>

<style scoped>
.mm-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mm-cell .name {
  font-weight: 500;
}

.mm-cell .mono {
  font-size: 12px;
}

.unit {
  margin-left: 8px;
  font-size: 12px;
}

.mt {
  margin-top: 12px;
}
</style>
