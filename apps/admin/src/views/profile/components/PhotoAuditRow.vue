<template>
  <div v-loading="loading" class="photos">
    <div v-for="p in pendingPhotos" :key="p.id" class="photo">
      <el-image :src="p.url" fit="cover" :preview-src-list="[p.url]" preview-teleported />
      <div class="actions">
        <el-button type="success" size="small" @click="audit(p.id, 'APPROVED')">通过</el-button>
        <el-button type="danger" size="small" @click="audit(p.id, 'REJECTED')">驳回</el-button>
      </div>
    </div>
    <div v-if="!pendingPhotos.length && !loading" class="text-muted">该会员已无待审照片</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { AuditStatus, type PhotoDto } from '@yuanqiao/shared';
import { profileApi } from '@/api';

const props = defineProps<{ profileId: string }>();
const emit = defineEmits<{ done: [] }>();

const loading = ref(false);
const photos = ref<PhotoDto[]>([]);

const pendingPhotos = computed(() => photos.value.filter((p) => p.auditStatus === AuditStatus.PENDING));

async function load(): Promise<void> {
  loading.value = true;
  try {
    const p = await profileApi.detail(props.profileId);
    photos.value = p.photos;
  } finally {
    loading.value = false;
  }
}

async function audit(photoId: string, status: 'APPROVED' | 'REJECTED'): Promise<void> {
  let reason: string | undefined;
  if (status === 'REJECTED') {
    const r = await ElMessageBox.prompt('请填写驳回理由', '驳回照片', {
      inputPlaceholder: '如：非本人 / 模糊 / 含联系方式',
      inputValidator: (v) => (v?.trim() ? true : '理由必填'),
    }).catch(() => null);
    if (!r) return;
    reason = r.value;
  }
  await profileApi.auditPhoto(photoId, status, reason);
  ElMessage.success('已处理');
  await load();
  emit('done');
}

onMounted(load);
</script>

<style scoped>
.photos {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  min-height: 40px;
}

.photo .el-image {
  width: 150px;
  height: 150px;
  border-radius: 6px;
  border: 1px solid var(--yq-border);
}

.actions {
  margin-top: 6px;
  text-align: center;
}
</style>
