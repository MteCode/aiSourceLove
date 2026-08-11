<template>
  <div class="page audit-page">
    <el-alert
      type="warning"
      :closable="false"
      class="tip"
      :title="`当前有 ${total} 份资料待审核`"
      description="左侧选中一条，右侧看完整资料后处理。驳回必须写清楚问题，会员端会原样展示。"
    />

    <el-row :gutter="12">
      <el-col :xs="24" :md="8" :lg="7">
        <div class="page-card list-card">
          <div class="table-toolbar">
            <span class="title">待审队列</span>
            <el-button link :icon="Refresh" @click="load">刷新</el-button>
          </div>

          <div v-loading="loading" class="queue">
            <el-empty v-if="!rows.length" description="没有待审资料了 🎉" :image-size="70" />
            <div
              v-for="row in rows"
              :key="row.id"
              :class="['queue-item', { active: current === row.id }]"
              @click="current = row.id"
            >
              <el-avatar :size="40" shape="square" :src="row.avatarUrl || undefined">
                {{ row.displayName?.[0] ?? '?' }}
              </el-avatar>
              <div class="info">
                <div class="name">
                  {{ row.displayName }}
                  <DictTag dict="gender" :value="row.gender" />
                </div>
                <div class="text-muted">
                  {{ row.age }} 岁 · {{ row.cityName ?? '未填城市' }} ·
                  {{ row.education ? EDUCATION_LABEL[row.education] : '学历未填' }}
                </div>
                <div class="mono text-muted serial">{{ row.serialNo }}</div>
              </div>
            </div>
          </div>

          <div class="pagination-bar">
            <el-pagination
              small
              layout="prev, pager, next"
              :current-page="page"
              :page-size="pageSize"
              :total="total"
              @current-change="onPageChange"
            />
          </div>
        </div>
      </el-col>

      <el-col :xs="24" :md="16" :lg="17">
        <div class="page-card">
          <template v-if="current">
            <div class="table-toolbar">
              <span class="title">资料详情</span>
              <div>
                <el-button type="success" :icon="Select" @click="quickApprove">快速通过</el-button>
                <el-button type="primary" :icon="Stamp" @click="auditVisible = true">审核处理</el-button>
              </div>
            </div>
            <ProfileDetailPanel ref="panelRef" :profile-id="current" @loaded="(p) => (profile = p)" />
          </template>
          <el-empty v-else description="从左侧选择一份资料开始审核" />
        </div>
      </el-col>
    </el-row>

    <AuditDialog v-model="auditVisible" :profile="profile" @done="afterAudit" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Refresh, Select, Stamp } from '@element-plus/icons-vue';
import { EDUCATION_LABEL, ProfileStatus, type ProfileBriefDto, type ProfileDto } from '@yuanqiao/shared';
import { profileApi, type ProfileQuery } from '@/api';
import DictTag from '@/components/DictTag.vue';
import { usePagedTable } from '@/composables/usePagedTable';
import { useUserStore } from '@/stores';
import AuditDialog from './components/AuditDialog.vue';
import ProfileDetailPanel from './components/ProfileDetailPanel.vue';

const user = useUserStore();

const { rows, total, page, pageSize, loading, load, onPageChange } = usePagedTable<
  ProfileBriefDto,
  ProfileQuery
>((q) => profileApi.list(q), { status: ProfileStatus.PENDING }, { pageSize: 15 });

const current = ref<string>('');
const profile = ref<ProfileDto | null>(null);
const auditVisible = ref(false);
const panelRef = ref<InstanceType<typeof ProfileDetailPanel>>();

// 审完一条自动选中下一条，审核员不用来回点
watch(rows, (list) => {
  if (!list.length) {
    current.value = '';
  } else if (!list.some((r) => r.id === current.value)) {
    current.value = list[0].id;
  }
});

async function quickApprove(): Promise<void> {
  if (!profile.value) return;
  await ElMessageBox.confirm(`确认通过「${profile.value.displayName}」的资料？`, '快速通过', {
    type: 'success',
  });
  await profileApi.audit(profile.value.id, { targetStatus: ProfileStatus.APPROVED });
  ElMessage.success('已通过');
  afterAudit();
}

function afterAudit(): void {
  void load();
  void user.loadPending();
}
</script>

<style scoped>
.tip {
  margin-bottom: 12px;
}

.list-card {
  display: flex;
  flex-direction: column;
}

.queue {
  min-height: 200px;
  max-height: calc(100vh - 300px);
  overflow-y: auto;
}

.queue-item {
  display: flex;
  gap: 10px;
  padding: 10px;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid transparent;
}

.queue-item:hover {
  background: var(--yq-bg);
}

.queue-item.active {
  background: var(--yq-primary-light);
  border-color: var(--yq-primary);
}

.queue-item .name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

.queue-item .info {
  font-size: 12px;
  line-height: 1.6;
}

.queue-item .serial {
  font-size: 11px;
}
</style>
