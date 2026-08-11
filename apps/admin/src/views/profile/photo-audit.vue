<template>
  <div class="page">
    <el-alert
      type="warning"
      :closable="false"
      class="tip"
      title="照片单独审核"
      description="照片走独立状态，一张图有问题不会拖住整份资料。驳回的照片会员端不展示，但资料仍可通过。"
    />

    <div class="page-card">
      <div class="table-toolbar">
        <span class="title">含待审照片的会员（{{ total }}）</span>
        <el-button link :icon="Refresh" @click="load">刷新</el-button>
      </div>

      <div v-loading="loading">
        <el-empty v-if="!rows.length" description="没有待审照片了 🎉" />
        <div v-for="row in rows" :key="row.id" class="member-block">
          <div class="member-head">
            <el-avatar :size="34" shape="square" :src="row.avatarUrl || undefined">
              {{ row.displayName?.[0] ?? '?' }}
            </el-avatar>
            <div>
              <span class="name">{{ row.displayName }}</span>
              <DictTag dict="gender" :value="row.gender" />
              <span class="mono text-muted">{{ row.serialNo }}</span>
            </div>
            <el-button link type="primary" @click="$router.push(`/member/detail/${row.id}`)">查看完整资料</el-button>
          </div>
          <PhotoAuditRow :profile-id="row.id" @done="afterAudit" />
        </div>
      </div>

      <div class="pagination-bar">
        <el-pagination
          :current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          background
          @current-change="onPageChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Refresh } from '@element-plus/icons-vue';
import type { ProfileBriefDto } from '@yuanqiao/shared';
import { profileApi, type ProfileQuery } from '@/api';
import DictTag from '@/components/DictTag.vue';
import { usePagedTable } from '@/composables/usePagedTable';
import { useUserStore } from '@/stores';
import PhotoAuditRow from './components/PhotoAuditRow.vue';

const user = useUserStore();

const { rows, total, page, pageSize, loading, load, onPageChange } = usePagedTable<
  ProfileBriefDto,
  ProfileQuery
>((q) => profileApi.list(q), { hasPendingPhoto: true }, { pageSize: 10 });

function afterAudit(): void {
  void load();
  void user.loadPending();
}
</script>

<style scoped>
.tip {
  margin-bottom: 12px;
}

.member-block {
  padding: 14px 0;
  border-bottom: 1px solid var(--yq-border);
}

.member-block:last-child {
  border-bottom: none;
}

.member-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.member-head .name {
  margin-right: 6px;
  font-weight: 500;
}
</style>
