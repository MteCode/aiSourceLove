<template>
  <el-dialog
    :model-value="modelValue"
    :title="group ? '编辑分组' : '新增分组'"
    width="420px"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
      <el-form-item label="编码" prop="code">
        <el-input v-model="form.code" :disabled="!!group" placeholder="小写字母数字下划线，如 basic" />
      </el-form-item>
      <el-form-item label="名称" prop="name">
        <el-input v-model="form.name" placeholder="如 基本信息" />
      </el-form-item>
      <el-form-item label="排序">
        <el-input-number v-model="form.sort" :min="0" controls-position="right" />
        <span class="text-muted tip">数字越小越靠前</span>
      </el-form-item>
      <el-form-item label="启用">
        <el-switch v-model="form.enabled" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import type { FieldGroupDto } from '@yuanqiao/shared';
import { fieldApi } from '@/api';

const props = defineProps<{ modelValue: boolean; group: FieldGroupDto | null }>();
const emit = defineEmits<{ 'update:modelValue': [v: boolean]; done: [] }>();

const formRef = ref<FormInstance>();
const saving = ref(false);
const form = reactive({ code: '', name: '', sort: 0, enabled: true });

const rules: FormRules = {
  // 和后端 @Matches 的正则保持一致，避免提交后才报错
  code: [
    { required: true, message: '请输入编码', trigger: 'blur' },
    { pattern: /^[a-z][a-z0-9_]{1,29}$/, message: '小写字母开头，可含数字下划线', trigger: 'blur' },
  ],
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
};

watch(
  () => props.modelValue,
  (v) => {
    if (!v) return;
    Object.assign(form, {
      code: props.group?.code ?? '',
      name: props.group?.name ?? '',
      sort: props.group?.sort ?? 0,
      enabled: true,
    });
  },
);

async function submit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  saving.value = true;
  try {
    if (props.group) {
      await fieldApi.updateGroup(props.group.id, { name: form.name, sort: form.sort, enabled: form.enabled });
    } else {
      await fieldApi.createGroup({ ...form });
    }
    ElMessage.success('已保存');
    emit('update:modelValue', false);
    emit('done');
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.tip {
  margin-left: 8px;
  font-size: 12px;
}
</style>
