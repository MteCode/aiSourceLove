<template>
  <div class="preview">
    <el-alert
      type="info"
      :closable="false"
      title="这就是会员端看到的录入表单"
      description="停用的字段不会出现在这里。改完字段配置刷新即可看到效果。"
      class="tip"
    />

    <el-form label-width="110px" label-position="top">
      <div v-for="g in enabledGroups" :key="g.id" class="group">
        <h4>{{ g.name }}</h4>
        <el-form-item v-for="f in g.fields" :key="f.id" :required="f.required">
          <template #label>
            {{ f.label }}
            <el-tag v-if="f.isPreference" size="small" type="success">择偶</el-tag>
            <el-tag size="small" type="info">{{ VISIBILITY_LABEL[f.visibility] }}</el-tag>
          </template>

          <el-input v-if="f.type === 'TEXT'" :placeholder="f.placeholder ?? ''" disabled />
          <el-input v-else-if="f.type === 'TEXTAREA'" type="textarea" :rows="3" :placeholder="f.placeholder ?? ''" disabled />
          <el-input-number v-else-if="f.type === 'NUMBER'" :min="f.minValue ?? undefined" :max="f.maxValue ?? undefined" disabled />
          <el-select v-else-if="f.type === 'SELECT'" :placeholder="f.placeholder ?? '请选择'" disabled style="width: 100%">
            <el-option v-for="o in f.options ?? []" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
          <el-select v-else-if="f.type === 'MULTI_SELECT'" multiple :placeholder="f.placeholder ?? '请选择'" disabled style="width: 100%">
            <el-option v-for="o in f.options ?? []" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
          <el-date-picker v-else-if="f.type === 'DATE'" type="date" :placeholder="f.placeholder ?? '请选择日期'" disabled style="width: 100%" />
          <el-cascader v-else-if="f.type === 'REGION'" :placeholder="f.placeholder ?? '请选择地区'" disabled style="width: 100%" />
          <el-switch v-else-if="f.type === 'BOOLEAN'" disabled />
          <div v-else-if="f.type === 'IMAGE' || f.type === 'IMAGES'" class="upload-mock">
            <el-icon><Plus /></el-icon>
          </div>
          <div v-else-if="f.type === 'RANGE'" class="range-mock">
            <el-input-number :min="f.minValue ?? undefined" disabled /> -
            <el-input-number :max="f.maxValue ?? undefined" disabled />
          </div>
          <el-input v-else disabled />

          <div v-if="f.helpText" class="text-muted help">{{ f.helpText }}</div>
        </el-form-item>
      </div>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Plus } from '@element-plus/icons-vue';
import { VISIBILITY_LABEL, type FieldGroupDto } from '@yuanqiao/shared';

/** 字段配置的所见即所得预览。全部 disabled——这里只看长相，不是真表单 */
const props = defineProps<{ groups: FieldGroupDto[] }>();

const enabledGroups = computed(() =>
  props.groups
    .map((g) => ({ ...g, fields: g.fields.filter((f) => f.enabled) }))
    .filter((g) => g.fields.length),
);
</script>

<style scoped>
.tip {
  margin-bottom: 16px;
}

.group h4 {
  margin: 18px 0 10px;
  padding-left: 8px;
  border-left: 3px solid var(--yq-primary);
  font-size: 14px;
}

.upload-mock {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  color: var(--yq-text-secondary);
}

.range-mock {
  display: flex;
  align-items: center;
  gap: 8px;
}

.help {
  width: 100%;
  font-size: 12px;
  line-height: 1.5;
}
</style>
