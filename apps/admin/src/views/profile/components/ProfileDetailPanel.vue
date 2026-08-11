<template>
  <div v-loading="loading" class="detail">
    <template v-if="profile">
      <div class="head">
        <el-avatar :size="64" shape="square" :src="primaryPhoto">
          {{ profile.displayName?.[0] ?? '?' }}
        </el-avatar>
        <div class="head-info">
          <div class="name">
            {{ profile.displayName }}
            <DictTag dict="gender" :value="profile.gender" />
            <DictTag dict="profileStatus" :value="profile.status" />
            <DictTag dict="source" :value="profile.source" />
          </div>
          <div class="text-muted mono">{{ profile.serialNo }}</div>
          <div class="text-muted">
            归属红娘：{{ profile.matchmakerName ?? '未分配' }} · 注册于 {{ formatDay(profile.createdAt) }}
          </div>
        </div>
      </div>

      <el-descriptions title="基本信息" :column="3" border size="small" class="block">
        <el-descriptions-item label="真实姓名"><MaskedText :value="profile.realName" /></el-descriptions-item>
        <el-descriptions-item label="年龄">{{ profile.age }} 岁</el-descriptions-item>
        <el-descriptions-item label="生日"><MaskedText :value="profile.birthday" /></el-descriptions-item>
        <el-descriptions-item label="身高">{{ profile.heightCm ? `${profile.heightCm} cm` : '-' }}</el-descriptions-item>
        <el-descriptions-item label="体重">{{ profile.weightKg ? `${profile.weightKg} kg` : '-' }}</el-descriptions-item>
        <el-descriptions-item label="婚史">{{ MARITAL_LABEL[profile.maritalStatus] ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="子女">{{ CHILDREN_LABEL[profile.childrenStatus] ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="房产">{{ profile.houseStatus ? HOUSE_LABEL[profile.houseStatus] : '-' }}</el-descriptions-item>
        <el-descriptions-item label="车产">{{ profile.carStatus ? CAR_LABEL[profile.carStatus] : '-' }}</el-descriptions-item>
        <el-descriptions-item label="现居">{{ profile.cityName ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="家乡">{{ profile.hometownCityName ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="最近活跃">{{ formatDate(profile.lastActiveAt) }}</el-descriptions-item>
      </el-descriptions>

      <el-descriptions title="工作学业" :column="3" border size="small" class="block">
        <el-descriptions-item label="学历">{{ profile.education ? EDUCATION_LABEL[profile.education] : '-' }}</el-descriptions-item>
        <el-descriptions-item label="学校"><MaskedText :value="profile.school" /></el-descriptions-item>
        <el-descriptions-item label="职业">{{ profile.occupation ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="单位"><MaskedText :value="profile.company" /></el-descriptions-item>
        <el-descriptions-item label="年收入">
          <MaskedText v-if="isMaskedValue(profile.annualIncome)" :value="profile.annualIncome" />
          <span v-else>{{ formatIncome(profile.annualIncome as number | null) }}</span>
        </el-descriptions-item>
      </el-descriptions>

      <el-descriptions title="联系方式" :column="3" border size="small" class="block">
        <el-descriptions-item label="手机号"><MaskedText :value="profile.phone" /></el-descriptions-item>
        <el-descriptions-item label="微信"><MaskedText :value="profile.wechat" /></el-descriptions-item>
        <el-descriptions-item label="你的可见等级">{{ VISIBILITY_LABEL[profile.viewerLevel] }}</el-descriptions-item>
      </el-descriptions>

      <div class="block">
        <h4>自我介绍</h4>
        <div class="intro">{{ profile.introduction || '（未填写）' }}</div>
      </div>

      <div v-if="profile.preference" class="block">
        <h4>择偶要求</h4>
        <el-descriptions :column="3" border size="small">
          <el-descriptions-item label="年龄">{{ range(profile.preference.ageMin, profile.preference.ageMax, '岁') }}</el-descriptions-item>
          <el-descriptions-item label="身高">{{ range(profile.preference.heightMin, profile.preference.heightMax, 'cm') }}</el-descriptions-item>
          <el-descriptions-item label="最低学历">
            {{ profile.preference.educationMin ? EDUCATION_LABEL[profile.preference.educationMin] : '不限' }}
          </el-descriptions-item>
          <el-descriptions-item label="年收入下限">{{ formatIncome(profile.preference.incomeMin) }}</el-descriptions-item>
          <el-descriptions-item label="接受婚史">
            {{ profile.preference.maritalStatus.length ? profile.preference.maritalStatus.map((m) => MARITAL_LABEL[m]).join('、') : '不限' }}
          </el-descriptions-item>
          <el-descriptions-item label="接受子女">
            {{ profile.preference.childrenStatus.length ? profile.preference.childrenStatus.map((c) => CHILDREN_LABEL[c]).join('、') : '不限' }}
          </el-descriptions-item>
          <el-descriptions-item label="要求有房">{{ profile.preference.requireHouse ? '是' : '否' }}</el-descriptions-item>
          <el-descriptions-item label="要求有车">{{ profile.preference.requireCar ? '是' : '否' }}</el-descriptions-item>
          <el-descriptions-item label="补充描述" :span="3">{{ profile.preference.description || '-' }}</el-descriptions-item>
        </el-descriptions>
      </div>

      <div v-if="extraEntries.length" class="block">
        <h4>扩展字段</h4>
        <el-descriptions :column="3" border size="small">
          <el-descriptions-item v-for="[k, v] in extraEntries" :key="k" :label="k">
            {{ Array.isArray(v) ? v.join('、') : String(v ?? '-') }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <div class="block">
        <h4>照片 <span class="text-muted">（{{ profile.photos.length }} 张）</span></h4>
        <div v-if="!profile.photos.length" class="text-muted">暂无照片</div>
        <div class="photos">
          <div v-for="p in profile.photos" :key="p.id" class="photo">
            <el-image :src="p.url" fit="cover" :preview-src-list="profile.photos.map((x) => x.url)" preview-teleported />
            <div class="photo-meta">
              <el-tag v-if="p.isPrimary" size="small" type="danger">主图</el-tag>
              <DictTag dict="auditStatus" :value="p.auditStatus" />
              <el-tag v-if="p.masked" size="small" type="info">打码版</el-tag>
            </div>
            <div v-if="canAuditPhoto" class="photo-actions">
              <el-button link type="success" size="small" @click="auditPhoto(p.id, 'APPROVED')">通过</el-button>
              <el-button link type="danger" size="small" @click="auditPhoto(p.id, 'REJECTED')">驳回</el-button>
            </div>
          </div>
        </div>
      </div>

      <div class="block">
        <h4>审核流水</h4>
        <el-timeline v-if="logs.length">
          <el-timeline-item v-for="log in logs" :key="log.id" :timestamp="formatDate(log.createdAt)" placement="top">
            <span>
              {{ log.fromStatus ? PROFILE_STATUS_LABEL[log.fromStatus] : '新建' }}
              → <strong>{{ PROFILE_STATUS_LABEL[log.toStatus] }}</strong>
            </span>
            <span class="text-muted">　操作人：{{ log.operatorName }}</span>
            <div v-if="log.reason" class="text-danger">理由：{{ log.reason }}</div>
          </el-timeline-item>
        </el-timeline>
        <div v-else class="text-muted">暂无审核记录</div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  CAR_LABEL,
  CHILDREN_LABEL,
  EDUCATION_LABEL,
  HOUSE_LABEL,
  MARITAL_LABEL,
  PROFILE_STATUS_LABEL,
  VISIBILITY_LABEL,
  type AuditLogDto,
  type ProfileDto,
} from '@yuanqiao/shared';
import { profileApi } from '@/api';
import DictTag from '@/components/DictTag.vue';
import MaskedText from '@/components/MaskedText.vue';
import { useUserStore } from '@/stores';
import { formatDate, formatDay, formatIncome, isMaskedValue } from '@/utils/format';

/** 会员详情面板。详情页和审核抽屉共用这一份渲染，避免两处字段不一致 */
const props = defineProps<{ profileId: string }>();
const emit = defineEmits<{ loaded: [profile: ProfileDto] }>();

const user = useUserStore();
const loading = ref(false);
const profile = ref<ProfileDto | null>(null);
const logs = ref<AuditLogDto[]>([]);

const canAuditPhoto = computed(() => user.can('profile:audit'));
const primaryPhoto = computed(
  () => profile.value?.photos.find((p) => p.isPrimary)?.url ?? profile.value?.photos[0]?.url,
);
const extraEntries = computed(() => Object.entries(profile.value?.extras ?? {}));

function range(min: number | null, max: number | null, unit: string): string {
  if (min == null && max == null) return '不限';
  return `${min ?? '不限'} - ${max ?? '不限'} ${unit}`;
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [p, l] = await Promise.all([
      profileApi.detail(props.profileId),
      profileApi.auditLogs(props.profileId),
    ]);
    profile.value = p;
    logs.value = l;
    emit('loaded', p);
  } finally {
    loading.value = false;
  }
}

async function auditPhoto(photoId: string, status: 'APPROVED' | 'REJECTED'): Promise<void> {
  let reason: string | undefined;
  if (status === 'REJECTED') {
    const r = await ElMessageBox.prompt('请填写驳回理由', '驳回照片', {
      inputPlaceholder: '如：非本人照片 / 含联系方式',
      inputValidator: (v) => (v?.trim() ? true : '理由必填'),
    }).catch(() => null);
    if (!r) return;
    reason = r.value;
  }
  await profileApi.auditPhoto(photoId, status, reason);
  ElMessage.success('已处理');
  void load();
}

watch(() => props.profileId, load, { immediate: true });

defineExpose({ reload: load, profile });
</script>

<style scoped>
.detail {
  min-height: 200px;
}

.head {
  display: flex;
  gap: 14px;
  align-items: center;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--yq-border);
}

.head-info .name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 17px;
  font-weight: 600;
}

.block {
  margin-top: 20px;
}

.block h4 {
  margin: 0 0 10px;
  font-size: 14px;
}

.intro {
  padding: 12px;
  background: var(--yq-bg);
  border-radius: 6px;
  line-height: 1.7;
  white-space: pre-wrap;
}

.photos {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.photo {
  width: 130px;
}

.photo .el-image {
  width: 130px;
  height: 130px;
  border-radius: 6px;
  border: 1px solid var(--yq-border);
}

.photo-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.photo-actions {
  margin-top: 2px;
}
</style>
