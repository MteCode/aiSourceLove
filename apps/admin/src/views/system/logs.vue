<template>
  <div class="page">
    <div class="page-card query-bar">
      <el-form :inline="true" :model="query" @submit.prevent>
        <el-form-item label="关键词">
          <el-input v-model="query.keyword" placeholder="操作人 / 动作 / 路径" clearable style="width: 200px" @keyup.enter="search" />
        </el-form-item>
        <el-form-item label="模块">
          <el-select v-model="query.module" placeholder="全部" clearable filterable style="width: 140px">
            <el-option v-for="m in MODULES" :key="m" :label="m" :value="m" />
          </el-select>
        </el-form-item>
        <el-form-item label="结果">
          <el-select v-model="query.success" placeholder="全部" clearable style="width: 110px">
            <el-option label="成功" :value="true" />
            <el-option label="失败" :value="false" />
          </el-select>
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="开始"
            end-placeholder="结束"
            style="width: 240px"
            @change="onDateChange"
          />
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
      title="操作日志"
      @page-change="onPageChange"
      @size-change="onSizeChange"
    >
      <el-table-column label="时间" width="150">
        <template #default="{ row }">{{ formatDate(row.createdAt, 'MM-DD HH:mm:ss') }}</template>
      </el-table-column>
      <el-table-column prop="username" label="操作人" width="130">
        <template #default="{ row }">{{ row.username ?? '系统' }}</template>
      </el-table-column>
      <el-table-column prop="module" label="模块" width="110" />
      <el-table-column prop="action" label="动作" min-width="140" />
      <el-table-column label="接口" min-width="220">
        <template #default="{ row }">
          <el-tag size="small" effect="plain" :type="METHOD_TYPE[row.method] ?? 'info'">{{ row.method }}</el-tag>
          <span class="mono path">{{ row.path }}</span>
        </template>
      </el-table-column>
      <el-table-column label="结果" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.success ? 'success' : 'danger'" size="small">
            {{ row.success ? '成功' : '失败' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="耗时" width="90" align="right">
        <template #default="{ row }">
          <span :class="{ 'text-danger': (row.duration ?? 0) > 1000 }">
            {{ row.duration != null ? `${row.duration} ms` : '-' }}
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="ip" label="IP" width="130">
        <template #default="{ row }"><span class="mono">{{ row.ip ?? '-' }}</span></template>
      </el-table-column>
      <el-table-column label="详情" width="80" align="center">
        <template #default="{ row }">
          <el-popover trigger="click" width="460" placement="left">
            <template #reference>
              <el-button link type="primary">查看</el-button>
            </template>
            <div class="detail">
              <div v-if="row.errorMsg" class="text-danger">错误：{{ row.errorMsg }}</div>
              <pre>{{ pretty(row.params) }}</pre>
            </div>
          </el-popover>
        </template>
      </el-table-column>
    </PageTable>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Refresh, Search } from '@element-plus/icons-vue';
import { systemApi, type OperationLogRow } from '@/api';
import PageTable from '@/components/PageTable.vue';
import { usePagedTable } from '@/composables/usePagedTable';
import { formatDate } from '@/utils/format';

/** 与后端 @LogAction 第一个参数保持一致 */
const MODULES = ['认证', '会员档案', '审核', '字段字典', '匹配引擎', '红娘', '牵线', '分润', '提现', 'VIP', '订单', '支付', '隐私', '系统管理'];

const METHOD_TYPE: Record<string, 'success' | 'primary' | 'warning' | 'danger'> = {
  GET: 'success',
  POST: 'primary',
  PUT: 'warning',
  DELETE: 'danger',
};

interface Query {
  keyword?: string;
  module?: string;
  success?: boolean;
  startDate?: string;
  endDate?: string;
}

const dateRange = ref<[string, string] | null>(null);

const { rows, total, page, pageSize, loading, query, search, reset, onPageChange, onSizeChange } =
  usePagedTable<OperationLogRow, Query>((q) => systemApi.listLogs(q), {
    keyword: '',
    module: undefined,
    success: undefined,
    startDate: undefined,
    endDate: undefined,
  });

function onDateChange(v: [string, string] | null): void {
  query.startDate = v?.[0];
  query.endDate = v?.[1];
}

function onReset(): void {
  dateRange.value = null;
  reset();
}

function pretty(raw: string | null): string {
  if (!raw) return '（无参数）';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
</script>

<style scoped>
.path {
  margin-left: 6px;
  font-size: 12px;
}

.detail {
  max-height: 340px;
  overflow: auto;
}

.detail pre {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.6;
}
</style>
