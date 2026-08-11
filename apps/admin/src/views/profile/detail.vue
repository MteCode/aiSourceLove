<template>
  <div class="page">
    <div class="page-card">
      <div class="table-toolbar">
        <el-button :icon="ArrowLeft" @click="$router.back()">返回</el-button>
        <div>
          <el-button
            v-perm="'profile:audit'"
            type="primary"
            :icon="Stamp"
            :disabled="!canAudit"
            @click="auditVisible = true"
          >
            审核
          </el-button>
        </div>
      </div>
      <ProfileDetailPanel ref="panelRef" :profile-id="id" @loaded="(p) => (profile = p)" />
    </div>

    <AuditDialog v-model="auditVisible" :profile="profile" @done="panelRef?.reload()" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ArrowLeft, Stamp } from '@element-plus/icons-vue';
import { ProfileStatus, type ProfileDto } from '@yuanqiao/shared';
import AuditDialog from './components/AuditDialog.vue';
import ProfileDetailPanel from './components/ProfileDetailPanel.vue';

const route = useRoute();
const id = route.params.id as string;

const panelRef = ref<InstanceType<typeof ProfileDetailPanel>>();
const profile = ref<ProfileDto | null>(null);
const auditVisible = ref(false);

// 草稿还没提交，不该被审；已下架的要先由会员重新提交
const canAudit = computed(
  () => !!profile.value && profile.value.status !== ProfileStatus.DRAFT,
);
</script>
