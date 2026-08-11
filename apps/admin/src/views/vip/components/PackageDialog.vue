<template>
  <el-dialog
    :model-value="modelValue"
    :title="pkg ? `编辑套餐：${pkg.name}` : '新建套餐'"
    width="620px"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="套餐名称" prop="name">
            <el-input v-model="form.name" placeholder="如 月卡 / 季卡" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="副标题">
            <el-input v-model="form.subtitle" placeholder="如 新用户首选" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="售价" prop="priceYuan">
            <el-input-number v-model="form.priceYuan" :min="0.01" :precision="2" :step="10" controls-position="right" style="width: 100%" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="划线原价">
            <el-input-number v-model="form.originalYuan" :min="0" :precision="2" :step="10" controls-position="right" style="width: 100%" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="有效天数" prop="durationDays">
            <el-input-number v-model="form.durationDays" :min="1" controls-position="right" style="width: 100%" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="权益配置">
        <div class="benefits">
          <div v-for="code in BENEFIT_CODES" :key="code" class="benefit-row">
            <el-checkbox
              :model-value="!!selected[code]"
              @change="(v) => toggle(code, v as boolean)"
            >
              {{ BENEFIT_META[code].label }}
            </el-checkbox>
            <template v-if="selected[code]">
              <el-input-number v-model="selected[code]!.quota" :min="0" controls-position="right" style="width: 120px" />
              <span class="text-muted unit">{{ BENEFIT_META[code].unit }}</span>
              <el-select v-model="selected[code]!.cycle" style="width: 120px">
                <el-option v-for="(label, c) in RESET_CYCLE_LABEL" :key="c" :label="label" :value="c" />
              </el-select>
            </template>
            <span v-else class="text-muted desc">{{ BENEFIT_META[code].desc }}</span>
          </div>
        </div>
      </el-form-item>

      <el-row :gutter="12">
        <el-col :span="8">
          <el-form-item label="排序">
            <el-input-number v-model="form.sort" :min="0" controls-position="right" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="推荐标记">
            <el-switch v-model="form.isRecommended" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="上架">
            <el-switch v-model="form.enabled" />
          </el-form-item>
        </el-col>
      </el-row>
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
import {
  BENEFIT_META,
  BenefitCode,
  RESET_CYCLE_LABEL,
  type BenefitSpec,
  type ResetCycle,
  type VipPackageDto,
} from '@yuanqiao/shared';
import { vipApi } from '@/api';
import { fen2yuan, yuan2fen } from '@/utils/format';

const props = defineProps<{ modelValue: boolean; pkg: VipPackageDto | null }>();
const emit = defineEmits<{ 'update:modelValue': [v: boolean]; done: [] }>();

const BENEFIT_CODES = Object.values(BenefitCode);

const formRef = ref<FormInstance>();
const saving = ref(false);

// 价格在界面上用「元」，提交时再转「分」——运营不会拿着分做算术
const form = reactive({
  name: '',
  subtitle: '',
  priceYuan: 99,
  originalYuan: 0,
  durationDays: 30,
  sort: 0,
  isRecommended: false,
  enabled: true,
});

const selected = reactive<Partial<Record<BenefitCode, BenefitSpec>>>({});

const rules: FormRules = {
  name: [{ required: true, message: '请输入套餐名称', trigger: 'blur' }],
  priceYuan: [{ required: true, message: '请输入售价', trigger: 'blur' }],
  durationDays: [{ required: true, message: '请输入有效天数', trigger: 'blur' }],
};

function toggle(code: BenefitCode, checked: boolean): void {
  if (checked) {
    selected[code] = { code, quota: 10, cycle: BENEFIT_META[code].defaultCycle };
  } else {
    delete selected[code];
  }
}

watch(
  () => props.modelValue,
  (v) => {
    if (!v) return;
    const p = props.pkg;
    Object.assign(form, {
      name: p?.name ?? '',
      subtitle: p?.subtitle ?? '',
      priceYuan: p ? Number(fen2yuan(p.price)) : 99,
      originalYuan: p?.originalPrice ? Number(fen2yuan(p.originalPrice)) : 0,
      durationDays: p?.durationDays ?? 30,
      sort: p?.sort ?? 0,
      isRecommended: p?.isRecommended ?? false,
      enabled: p?.enabled ?? true,
    });
    for (const c of BENEFIT_CODES) delete selected[c];
    for (const b of p?.benefits ?? []) {
      selected[b.code] = { ...b, cycle: b.cycle ?? BENEFIT_META[b.code].defaultCycle };
    }
  },
);

async function submit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  const benefits = Object.values(selected).filter(Boolean) as BenefitSpec[];
  if (!benefits.length) {
    ElMessage.warning('至少配置一项权益，否则用户买了什么都拿不到');
    return;
  }

  const payload = {
    name: form.name,
    subtitle: form.subtitle || undefined,
    price: yuan2fen(form.priceYuan),
    originalPrice: form.originalYuan ? yuan2fen(form.originalYuan) : undefined,
    durationDays: form.durationDays,
    benefits: benefits.map((b) => ({ code: b.code, quota: b.quota, cycle: b.cycle as ResetCycle })),
    isRecommended: form.isRecommended,
    sort: form.sort,
    enabled: form.enabled,
  };

  saving.value = true;
  try {
    if (props.pkg) await vipApi.update(props.pkg.id, payload);
    else await vipApi.create(payload);
    ElMessage.success('已保存');
    emit('update:modelValue', false);
    emit('done');
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.benefits {
  width: 100%;
}

.benefit-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.benefit-row .el-checkbox {
  width: 130px;
}

.unit,
.desc {
  font-size: 12px;
}
</style>
