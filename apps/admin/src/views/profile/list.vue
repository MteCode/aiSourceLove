<template>
  <div class="page">
    <div class="page-card query-bar">
      <el-form :inline="true" :model="query" @submit.prevent>
        <el-form-item label="关键词">
          <el-input v-model="query.keyword" placeholder="编号 / 姓名 / 手机号" clearable style="width: 200px" @keyup.enter="search" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部" clearable style="width: 130px">
            <el-option v-for="(label, v) in PROFILE_STATUS_LABEL" :key="v" :label="label" :value="v" />
          </el-select>
        </el-form-item>
        <el-form-item label="性别">
          <el-select v-model="query.gender" placeholder="全部" clearable style="width: 100px">
            <el-option v-for="(label, v) in GENDER_LABEL" :key="v" :label="label" :value="v" />
          </el-select>
        </el-form-item>
        <el-form-item label="来源">
          <el-select v-model="query.source" placeholder="全部" clearable style="width: 130px">
            <el-option v-for="(label, v) in PROFILE_SOURCE_LABEL" :key="v" :label="label" :value="v" />
          </el-select>
        </el-form-item>
        <el-form-item label="城市">
          <RegionCascader v-model="regionValue" @change="(c) => (query.cityCode = c)" />
        </el-form-item>
        <el-form-item label="年龄">
          <el-input-number v-model="query.ageMin" :min="18" :max="80" controls-position="right" placeholder="最小" style="width: 100px" />
          <span class="sep">-</span>
          <el-input-number v-model="query.ageMax" :min="18" :max="80" controls-position="right" placeholder="最大" style="width: 100px" />
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
      title="会员列表"
      @page-change="onPageChange"
      @size-change="onSizeChange"
    >
      <el-table-column label="会员" min-width="200">
        <template #default="{ row }">
          <div class="member-cell">
            <el-avatar :size="38" shape="square" :src="row.avatarUrl || undefined">
              {{ row.displayName?.[0] ?? '?' }}
            </el-avatar>
            <div>
              <div class="name">
                {{ row.displayName }}
                <el-tag v-if="row.isTop" type="danger" size="small" effect="dark">置顶</el-tag>
                <el-tag v-if="row.avatarMasked" type="info" size="small">照片打码</el-tag>
              </div>
              <div class="serial mono text-muted">{{ row.serialNo }}</div>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="性别" width="80" align="center">
        <template #default="{ row }"><DictTag dict="gender" :value="row.gender" /></template>
      </el-table-column>
      <el-table-column prop="age" label="年龄" width="70" align="center" />
      <el-table-column label="身高" width="80" align="center">
        <template #default="{ row }">{{ row.heightCm ? `${row.heightCm} cm` : '-' }}</template>
      </el-table-column>
      <el-table-column label="学历" width="100">
        <template #default="{ row }">{{ educationLabel(row.education) }}</template>
      </el-table-column>
      <el-table-column prop="occupation" label="职业" min-width="110" show-overflow-tooltip />
      <el-table-column prop="cityName" label="城市" width="100" />
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }"><DictTag dict="profileStatus" :value="row.status" /></template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right" align="center">
        <template #default="{ row }">
          <el-button link type="primary" @click="$router.push(`/member/detail/${row.id}`)">详情</el-button>
          <el-button v-perm="'profile:edit'" link type="primary" @click="openAssign(row as ProfileBriefDto)">归属</el-button>
          <el-popconfirm title="删除后该会员不再参与推荐，确定吗？" @confirm="remove(row as ProfileBriefDto)">
            <template #reference>
              <el-button v-perm="'profile:delete'" link type="danger">删除</el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </PageTable>

    <el-dialog v-model="assignVisible" title="调整归属红娘" width="420px">
      <el-form label-width="90px">
        <el-form-item label="会员">
          <span>{{ assignRow?.displayName }}（{{ assignRow?.serialNo }}）</span>
        </el-form-item>
        <el-form-item label="归属红娘">
          <el-select v-model="assignTarget" placeholder="不归属任何红娘" clearable filterable style="width: 100%">
            <el-option v-for="m in matchmakers" :key="m.id" :label="`${m.name}（${m.cityName ?? '未填城市'}）`" :value="m.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignVisible = false">取消</el-button>
        <el-button type="primary" :loading="assigning" @click="submitAssign">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Refresh, Search } from '@element-plus/icons-vue';
import {
  EDUCATION_LABEL,
  GENDER_LABEL,
  PROFILE_SOURCE_LABEL,
  PROFILE_STATUS_LABEL,
  type Education,
  type MatchmakerDto,
  type ProfileBriefDto,
} from '@yuanqiao/shared';
import { matchmakerApi, profileApi, type ProfileQuery } from '@/api';
import DictTag from '@/components/DictTag.vue';
import PageTable from '@/components/PageTable.vue';
import RegionCascader from '@/components/RegionCascader.vue';
import { usePagedTable } from '@/composables/usePagedTable';

const regionValue = ref<string[]>([]);

function educationLabel(e: Education | null): string {
  return e ? (EDUCATION_LABEL[e] ?? e) : '-';
}

const { rows, total, page, pageSize, loading, query, load, search, reset, onPageChange, onSizeChange } =
  usePagedTable<ProfileBriefDto, ProfileQuery>((q) => profileApi.list(q), {
    keyword: '',
    status: undefined,
    gender: undefined,
    source: undefined,
    cityCode: undefined,
    ageMin: undefined,
    ageMax: undefined,
  });

function onReset(): void {
  regionValue.value = [];
  reset();
}

// ── 归属红娘 ──
const assignVisible = ref(false);
const assigning = ref(false);
const assignRow = ref<ProfileBriefDto | null>(null);
const assignTarget = ref<string | undefined>();
const matchmakers = ref<MatchmakerDto[]>([]);

async function openAssign(row: ProfileBriefDto): Promise<void> {
  assignRow.value = row;
  assignTarget.value = undefined;
  assignVisible.value = true;
  if (!matchmakers.value.length) {
    // 只挑服务中的红娘，停用/待审的不该再接新会员
    const res = await matchmakerApi.list({ page: 1, pageSize: 200, status: 'ACTIVE' });
    matchmakers.value = res.list;
  }
}

async function submitAssign(): Promise<void> {
  if (!assignRow.value) return;
  assigning.value = true;
  try {
    await profileApi.assignMatchmaker(assignRow.value.id, assignTarget.value ?? null);
    ElMessage.success('归属已更新');
    assignVisible.value = false;
    void load();
  } finally {
    assigning.value = false;
  }
}

async function remove(row: ProfileBriefDto): Promise<void> {
  await profileApi.remove(row.id);
  ElMessage.success('已删除');
  void load();
}
</script>

<style scoped>
.member-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.member-cell .name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

.member-cell .serial {
  font-size: 12px;
}

.sep {
  padding: 0 6px;
  color: var(--yq-text-secondary);
}
</style>
