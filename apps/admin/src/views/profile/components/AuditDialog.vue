<template>
  <el-dialog
    :model-value="modelValue"
    :title="`审核：${profile?.displayName ?? ''}`"
    width="520px"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <el-form label-width="90px">
      <el-form-item label="处理结果">
        <el-radio-group v-model="target">
          <el-radio-button :value="ProfileStatus.APPROVED">通过</el-radio-button>
          <el-radio-button :value="ProfileStatus.REJECTED">驳回</el-radio-button>
          <el-radio-button :value="ProfileStatus.OFFLINE">下架</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <el-form-item v-if="needReason" label="理由" required>
        <el-input
          v-model="reason"
          type="textarea"
          :rows="3"
          maxlength="500"
          show-word-limit
          placeholder="会原样展示给会员，请写清楚该改哪里"
        />
      </el-form-item>

      <el-form-item v-if="target === ProfileStatus.REJECTED" label="问题字段">
        <el-select v-model="rejectedFields" multiple filterable placeholder="选中的字段会在会员端高亮" style="width: 100%">
          <el-option v-for="f in FIELD_OPTIONS" :key="f.value" :label="f.label" :value="f.value" />
        </el-select>
      </el-form-item>

      <el-alert
        v-if="target === ProfileStatus.APPROVED"
        type="success"
        :closable="false"
        title="通过后该会员立即进入推荐池，可被检索和匹配"
      />
    </el-form>

    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">确认提交</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { ProfileStatus, type ProfileDto } from '@yuanqiao/shared';
import { profileApi } from '@/api';

const props = defineProps<{ modelValue: boolean; profile: ProfileDto | null }>();
const emit = defineEmits<{ 'update:modelValue': [v: boolean]; done: [] }>();

/** 驳回理由要写给会员看，这里给几个常见字段方便勾选定位 */
const FIELD_OPTIONS = [
  { value: 'realName', label: '真实姓名' },
  { value: 'birthday', label: '生日' },
  { value: 'heightCm', label: '身高' },
  { value: 'education', label: '学历' },
  { value: 'school', label: '学校' },
  { value: 'occupation', label: '职业' },
  { value: 'company', label: '工作单位' },
  { value: 'annualIncome', label: '年收入' },
  { value: 'maritalStatus', label: '婚史' },
  { value: 'introduction', label: '自我介绍' },
  { value: 'photos', label: '照片' },
  { value: 'phone', label: '手机号' },
];

const target = ref<ProfileStatus>(ProfileStatus.APPROVED);
const reason = ref('');
const rejectedFields = ref<string[]>([]);
const saving = ref(false);

// 驳回和下架都要给会员一个交代，理由必填
const needReason = computed(() => target.value !== ProfileStatus.APPROVED);

watch(
  () => props.modelValue,
  (v) => {
    if (!v) return;
    target.value = ProfileStatus.APPROVED;
    reason.value = '';
    rejectedFields.value = [];
  },
);

async function submit(): Promise<void> {
  if (!props.profile) return;
  if (needReason.value && !reason.value.trim()) {
    ElMessage.warning('请填写理由');
    return;
  }
  saving.value = true;
  try {
    await profileApi.audit(props.profile.id, {
      targetStatus: target.value,
      reason: reason.value.trim() || undefined,
      rejectedFields: rejectedFields.value.length ? rejectedFields.value : undefined,
    });
    ElMessage.success('审核已提交');
    emit('update:modelValue', false);
    emit('done');
  } finally {
    saving.value = false;
  }
}
</script>
