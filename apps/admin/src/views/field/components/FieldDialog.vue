<template>
  <el-dialog
    :model-value="modelValue"
    :title="field ? `编辑字段：${field.label}` : '新增字段'"
    width="640px"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="字段名称" prop="label">
            <el-input v-model="form.label" placeholder="如 兴趣爱好" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="字段编码" prop="code">
            <el-input v-model="form.code" :disabled="!!field" placeholder="如 hobby" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="所属分组" prop="groupId">
            <el-select v-model="form.groupId" style="width: 100%">
              <el-option v-for="g in groups" :key="g.id" :label="g.name" :value="g.id" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="字段类型" prop="type">
            <el-select v-model="form.type" :disabled="!!field" style="width: 100%">
              <el-option v-for="(label, v) in FIELD_TYPE_LABEL" :key="v" :label="label" :value="v" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item v-if="needOptions" label="选项">
        <div class="options">
          <div v-for="(opt, i) in form.options" :key="i" class="option-row">
            <el-input v-model="opt.value" placeholder="值（存库）" style="width: 150px" />
            <el-input v-model="opt.label" placeholder="显示文案" style="width: 170px" />
            <el-input-number v-model="opt.score" :min="0" placeholder="打分" controls-position="right" style="width: 120px" />
            <el-button link type="danger" :icon="Delete" @click="form.options.splice(i, 1)" />
          </div>
          <el-button link type="primary" :icon="Plus" @click="form.options.push({ value: '', label: '', score: undefined })">
            添加选项
          </el-button>
          <div class="text-muted hint">「打分」用于匹配时把选项映射成数值（如收入档位），不参与打分可留空。</div>
        </div>
      </el-form-item>

      <el-form-item label="占位提示">
        <el-input v-model="form.placeholder" placeholder="输入框里的灰字" />
      </el-form-item>
      <el-form-item label="字段说明">
        <el-input v-model="form.helpText" placeholder="表单下方的解释文案" />
      </el-form-item>

      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="可见等级">
            <el-select v-model="form.visibility" style="width: 100%">
              <el-option v-for="(label, v) in VISIBILITY_LABEL" :key="v" :label="label" :value="Number(v)" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="匹配权重键">
            <el-select v-model="form.weightKey" placeholder="不参与打分" clearable style="width: 100%">
              <el-option v-for="(label, k) in MATCH_WEIGHT_LABEL" :key="k" :label="label" :value="k" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="校验规则">
        <div class="rules-row">
          <el-input-number v-model="form.minValue" placeholder="最小值" controls-position="right" style="width: 130px" />
          <el-input-number v-model="form.maxValue" placeholder="最大值" controls-position="right" style="width: 130px" />
          <el-input-number v-model="form.maxLength" :min="1" placeholder="最大长度" controls-position="right" style="width: 130px" />
          <el-input v-model="form.regex" placeholder="正则，如 ^1[3-9]\d{9}$" style="width: 200px" />
        </div>
      </el-form-item>

      <el-form-item label="属性">
        <el-checkbox v-model="form.required">必填</el-checkbox>
        <el-checkbox v-model="form.isPreference">同时出现在择偶要求表单</el-checkbox>
        <el-checkbox v-model="form.enabled">启用</el-checkbox>
      </el-form-item>

      <el-form-item label="排序">
        <el-input-number v-model="form.sort" :min="0" controls-position="right" />
      </el-form-item>

      <el-alert
        v-if="field?.isCore"
        type="warning"
        :closable="false"
        title="这是核心字段（映射到 Profile 固定列），编码和类型不可更改"
      />
    </el-form>

    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { Delete, Plus } from '@element-plus/icons-vue';
import {
  MATCH_WEIGHT_LABEL,
  VisibilityLevel,
  VISIBILITY_LABEL,
  type FieldDefDto,
  type FieldGroupDto,
  type FieldOption,
} from '@yuanqiao/shared';
import { fieldApi } from '@/api';
import { FIELD_TYPE_LABEL, OPTION_TYPES } from '../constants';

const props = defineProps<{
  modelValue: boolean;
  field: FieldDefDto | null;
  groupId: string;
  groups: FieldGroupDto[];
}>();
const emit = defineEmits<{ 'update:modelValue': [v: boolean]; done: [] }>();

const formRef = ref<FormInstance>();
const saving = ref(false);

interface FormShape {
  code: string;
  label: string;
  type: string;
  groupId: string;
  options: FieldOption[];
  placeholder: string;
  helpText: string;
  required: boolean;
  visibility: number;
  isPreference: boolean;
  weightKey: string | undefined;
  minValue: number | undefined;
  maxValue: number | undefined;
  maxLength: number | undefined;
  regex: string;
  sort: number;
  enabled: boolean;
}

const form = reactive<FormShape>(emptyForm());

function emptyForm(): FormShape {
  return {
    code: '',
    label: '',
    type: 'TEXT',
    groupId: '',
    options: [],
    placeholder: '',
    helpText: '',
    required: false,
    visibility: VisibilityLevel.MEMBER,
    isPreference: false,
    weightKey: undefined,
    minValue: undefined,
    maxValue: undefined,
    maxLength: undefined,
    regex: '',
    sort: 0,
    enabled: true,
  };
}

const needOptions = computed(() => OPTION_TYPES.includes(form.type));

const rules: FormRules = {
  label: [{ required: true, message: '请输入字段名称', trigger: 'blur' }],
  code: [
    { required: true, message: '请输入字段编码', trigger: 'blur' },
    { pattern: /^[a-zA-Z][a-zA-Z0-9_]{1,49}$/, message: '字母开头，可含数字下划线', trigger: 'blur' },
  ],
  groupId: [{ required: true, message: '请选择分组', trigger: 'change' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
};

watch(
  () => props.modelValue,
  (v) => {
    if (!v) return;
    const f = props.field;
    Object.assign(form, emptyForm(), {
      groupId: f?.groupId ?? props.groupId,
      ...(f
        ? {
            code: f.code,
            label: f.label,
            type: f.type,
            options: f.options ? f.options.map((o) => ({ ...o })) : [],
            placeholder: f.placeholder ?? '',
            helpText: f.helpText ?? '',
            required: f.required,
            visibility: f.visibility,
            isPreference: f.isPreference,
            weightKey: f.weightKey ?? undefined,
            minValue: f.minValue ?? undefined,
            maxValue: f.maxValue ?? undefined,
            maxLength: f.maxLength ?? undefined,
            regex: f.regex ?? '',
            sort: f.sort,
            enabled: f.enabled,
          }
        : {}),
    });
  },
);

async function submit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  if (needOptions.value && form.options.some((o) => !o.value || !o.label)) {
    ElMessage.warning('选项的值和文案都要填');
    return;
  }

  const payload = {
    ...form,
    options: needOptions.value ? form.options : undefined,
    placeholder: form.placeholder || undefined,
    helpText: form.helpText || undefined,
    regex: form.regex || undefined,
  };

  saving.value = true;
  try {
    if (props.field) {
      // 编码和类型后端不允许改，索性不发
      const { code: _code, type: _type, ...rest } = payload;
      await fieldApi.update(props.field.id, rest as never);
    } else {
      await fieldApi.create(payload as never);
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
.options {
  width: 100%;
}

.option-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.rules-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.hint {
  font-size: 12px;
}
</style>
