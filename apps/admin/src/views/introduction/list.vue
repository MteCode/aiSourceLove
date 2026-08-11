<template>
  <div class="page">
    <div class="page-card query-bar">
      <el-form :inline="true" :model="query" @submit.prevent>
        <el-form-item label="关键词">
          <el-input v-model="query.keyword" placeholder="工单号 / 会员" clearable style="width: 190px" @keyup.enter="search" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部" clearable style="width: 150px">
            <el-option v-for="(label, v) in INTRODUCTION_STATUS_LABEL" :key="v" :label="label" :value="v" />
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
      title="牵线工单"
      @page-change="onPageChange"
      @size-change="onSizeChange"
    >
      <el-table-column label="工单号" width="150">
        <template #default="{ row }"><span class="mono">{{ row.serialNo }}</span></template>
      </el-table-column>
      <el-table-column label="双方" min-width="240">
        <template #default="{ row }">
          <div class="pair">
            <span>{{ row.sideA.displayName }}</span>
            <el-icon color="#e05a7d"><Connection /></el-icon>
            <span>{{ row.sideB.displayName }}</span>
          </div>
          <div class="text-muted mono small">{{ row.sideA.serialNo }} / {{ row.sideB.serialNo }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="matchmakerName" label="红娘" width="110" />
      <el-table-column label="匹配分" width="90" align="center">
        <template #default="{ row }">
          <span v-if="row.matchScore != null" class="mono">{{ row.matchScore }}</span>
          <span v-else class="text-muted">-</span>
        </template>
      </el-table-column>
      <el-table-column label="意向" width="120" align="center">
        <template #default="{ row }">
          <el-tag :type="row.aAgreed ? 'success' : 'info'" size="small">A {{ row.aAgreed ? '✓' : '…' }}</el-tag>
          <el-tag :type="row.bAgreed ? 'success' : 'info'" size="small">B {{ row.bAgreed ? '✓' : '…' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="130" align="center">
        <template #default="{ row }"><DictTag dict="introStatus" :value="row.status" /></template>
      </el-table-column>
      <el-table-column label="创建时间" width="150">
        <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right" align="center">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row as IntroductionDto)">详情</el-button>
        </template>
      </el-table-column>
    </PageTable>

    <el-drawer v-model="detailVisible" :title="`牵线工单 ${current?.serialNo ?? ''}`" size="50%">
      <div v-if="current" v-loading="detailLoading">
        <el-steps :active="stepIndex" align-center finish-status="success" class="steps">
          <el-step v-for="s in INTRODUCTION_FLOW_STEPS" :key="s" :title="INTRODUCTION_STATUS_LABEL[s]" />
        </el-steps>

        <el-alert
          v-if="isTerminalFailure"
          type="error"
          :closable="false"
          :title="`该工单已${INTRODUCTION_STATUS_LABEL[current.status]}`"
          class="mb"
        />

        <el-row :gutter="12" class="mb">
          <el-col :span="11">
            <SideCard side="A" :profile="current.sideA" :agreed="current.aAgreed" />
          </el-col>
          <el-col :span="2" class="middle">
            <el-icon :size="22" color="#e05a7d"><Connection /></el-icon>
          </el-col>
          <el-col :span="11">
            <SideCard side="B" :profile="current.sideB" :agreed="current.bAgreed" />
          </el-col>
        </el-row>

        <el-descriptions :column="2" border size="small" class="mb">
          <el-descriptions-item label="红娘">{{ current.matchmakerName }}</el-descriptions-item>
          <el-descriptions-item label="匹配分">{{ current.matchScore ?? '-' }}</el-descriptions-item>
          <el-descriptions-item label="推荐语" :span="2">{{ current.remark || '-' }}</el-descriptions-item>
          <el-descriptions-item label="结果反馈" :span="2">{{ current.resultNote || '-' }}</el-descriptions-item>
        </el-descriptions>

        <div class="page-card mb">
          <div class="table-toolbar"><span class="title">推进状态</span></div>
          <el-alert
            type="warning"
            :closable="false"
            class="mb"
            title="注意：推进到「已交换联系方式」会立即解锁双方联系方式；推进到「牵线成功」会给红娘记一笔分润。这两步不可撤销。"
          />
          <el-space wrap>
            <el-button
              v-for="s in nextStates"
              :key="s"
              :type="s === 'SUCCESS' ? 'success' : s === 'FAILED' || s === 'CANCELLED' ? 'danger' : 'primary'"
              @click="advance(s)"
            >
              → {{ INTRODUCTION_STATUS_LABEL[s] }}
            </el-button>
          </el-space>
          <div v-if="!nextStates.length" class="text-muted">该工单已收口，无可推进的状态。</div>
        </div>

        <h4>事件流水</h4>
        <el-timeline>
          <el-timeline-item
            v-for="e in current.events"
            :key="e.id"
            :timestamp="formatDate(e.createdAt)"
            placement="top"
          >
            <span>
              {{ e.fromStatus ? INTRODUCTION_STATUS_LABEL[e.fromStatus] : '创建' }}
              → <strong>{{ INTRODUCTION_STATUS_LABEL[e.toStatus] }}</strong>
            </span>
            <span class="text-muted">　{{ e.operatorName }}</span>
            <div v-if="e.note">{{ e.note }}</div>
          </el-timeline-item>
        </el-timeline>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Connection, Refresh, Search } from '@element-plus/icons-vue';
import {
  INTRODUCTION_FLOW_STEPS,
  INTRODUCTION_STATUS_LABEL,
  INTRODUCTION_STATUS_TRANSITIONS,
  INTRODUCTION_TERMINAL_STATUSES,
  IntroductionStatus,
  nextStatuses,
  type IntroductionDto,
} from '@yuanqiao/shared';
import { introductionApi } from '@/api';
import DictTag from '@/components/DictTag.vue';
import PageTable from '@/components/PageTable.vue';
import { usePagedTable } from '@/composables/usePagedTable';
import { formatDate } from '@/utils/format';
import SideCard from './components/SideCard.vue';

interface Query {
  keyword?: string;
  status?: IntroductionStatus;
}

const { rows, total, page, pageSize, loading, query, load, search, reset, onPageChange, onSizeChange } =
  usePagedTable<IntroductionDto, Query>((q) => introductionApi.list(q), { keyword: '', status: undefined });

const detailVisible = ref(false);
const detailLoading = ref(false);
const current = ref<IntroductionDto | null>(null);

const isTerminalFailure = computed(
  () =>
    !!current.value &&
    current.value.status !== IntroductionStatus.SUCCESS &&
    INTRODUCTION_TERMINAL_STATUSES.includes(current.value.status),
);

/** 步骤条只画主干；分支状态（失败/取消）不在主干上，用上面的 alert 表达 */
const stepIndex = computed(() => {
  if (!current.value) return 0;
  const i = INTRODUCTION_FLOW_STEPS.indexOf(current.value.status);
  return i >= 0 ? i + 1 : 0;
});

/** 可推进的状态直接问状态机，前端不重复维护一份规则 */
const nextStates = computed(() =>
  current.value ? nextStatuses(INTRODUCTION_STATUS_TRANSITIONS, current.value.status) : [],
);

async function openDetail(row: IntroductionDto): Promise<void> {
  detailVisible.value = true;
  detailLoading.value = true;
  current.value = row;
  try {
    current.value = await introductionApi.detail(row.id);
  } finally {
    detailLoading.value = false;
  }
}

async function advance(target: IntroductionStatus): Promise<void> {
  if (!current.value) return;
  const label = INTRODUCTION_STATUS_LABEL[target];
  const r = await ElMessageBox.prompt(`确认把工单推进到「${label}」？可填写备注。`, '推进状态', {
    inputType: 'textarea',
    inputPlaceholder: '备注/结果反馈（可选）',
  }).catch(() => null);
  if (!r) return;

  const updated = await introductionApi.advance(current.value.id, target, r.value || undefined);
  current.value = updated;
  ElMessage.success(`已推进到「${label}」`);
  void load();
}
</script>

<style scoped>
.pair {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.small {
  font-size: 12px;
}

.steps {
  margin-bottom: 20px;
}

.mb {
  margin-bottom: 14px;
}

.middle {
  display: flex;
  align-items: center;
  justify-content: center;
}

h4 {
  margin: 12px 0 8px;
  font-size: 14px;
}
</style>
