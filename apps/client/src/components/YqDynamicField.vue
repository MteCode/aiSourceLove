<script setup lang="ts">
import { computed } from 'vue';
import type { FieldDefDto } from '@yuanqiao/shared';

/**
 * 动态表单的单个字段。
 *
 * 字段定义来自后台的字段字典，运营在后台加一个字段，
 * 这里就自动多出一个输入控件，不需要发版。
 */
const props = defineProps<{ field: FieldDefDto; modelValue: unknown }>();
const emit = defineEmits<{ 'update:modelValue': [v: unknown] }>();

const options = computed(() => props.field.options ?? []);

/** picker 是按下标回传的，要把值翻译成下标 */
const selectIndex = computed(() => {
  const i = options.value.findIndex((o) => o.value === props.modelValue);
  return i >= 0 ? i : -1;
});

const selectLabel = computed(() =>
  selectIndex.value >= 0 ? options.value[selectIndex.value].label : '',
);

const multiValues = computed(() => (Array.isArray(props.modelValue) ? (props.modelValue as string[]) : []));

const multiLabel = computed(() =>
  options.value
    .filter((o) => multiValues.value.includes(o.value))
    .map((o) => o.label)
    .join('、'),
);

const rangeValue = computed(() => {
  const v = props.modelValue as { min?: number; max?: number } | null;
  return { min: v?.min ?? '', max: v?.max ?? '' };
});

function onInput(e: { detail: { value: string } }): void {
  emit('update:modelValue', e.detail.value);
}

function onNumberInput(e: { detail: { value: string } }): void {
  const raw = e.detail.value;
  emit('update:modelValue', raw === '' ? null : Number(raw));
}

function onSelect(e: { detail: { value: string | number } }): void {
  const i = Number(e.detail.value);
  emit('update:modelValue', options.value[i]?.value);
}

function toggleMulti(value: string): void {
  const cur = [...multiValues.value];
  const i = cur.indexOf(value);
  if (i >= 0) cur.splice(i, 1);
  else cur.push(value);
  emit('update:modelValue', cur);
}

function onDate(e: { detail: { value: string } }): void {
  emit('update:modelValue', e.detail.value);
}

function onBoolean(e: { detail: { value: boolean } }): void {
  emit('update:modelValue', e.detail.value);
}

function onRange(which: 'min' | 'max', e: { detail: { value: string } }): void {
  const v = e.detail.value === '' ? undefined : Number(e.detail.value);
  emit('update:modelValue', { ...rangeValue.value, [which]: v });
}
</script>

<template>
  <view class="field">
    <view class="label-row">
      <text class="label">
        <text v-if="field.required" class="required">*</text>
        {{ field.label }}
      </text>
      <!-- 让用户知道这条信息谁能看见，是建立信任的关键 -->
      <yq-tag v-if="field.visibility >= 2" type="info" plain>
        {{ field.visibility >= 4 ? '仅红娘可见' : field.visibility >= 3 ? '解锁后可见' : 'VIP 可见' }}
      </yq-tag>
    </view>

    <!-- 文本 -->
    <input
      v-if="field.type === 'TEXT'"
      class="control"
      :value="(modelValue as string) ?? ''"
      :placeholder="field.placeholder || '请输入'"
      :maxlength="field.maxLength ?? 140"
      @input="onInput"
    />

    <!-- 多行文本 -->
    <textarea
      v-else-if="field.type === 'TEXTAREA'"
      class="control control--area"
      :value="(modelValue as string) ?? ''"
      :placeholder="field.placeholder || '请输入'"
      :maxlength="field.maxLength ?? 500"
      @input="onInput"
    />

    <!-- 数字 -->
    <input
      v-else-if="field.type === 'NUMBER'"
      class="control"
      type="number"
      :value="modelValue == null ? '' : String(modelValue)"
      :placeholder="field.placeholder || '请输入'"
      @input="onNumberInput"
    />

    <!-- 单选 -->
    <picker
      v-else-if="field.type === 'SELECT'"
      :range="options"
      range-key="label"
      :value="selectIndex"
      @change="onSelect"
    >
      <view class="control control--picker">
        <text :class="{ placeholder: !selectLabel }">{{ selectLabel || field.placeholder || '请选择' }}</text>
        <text class="arrow">›</text>
      </view>
    </picker>

    <!-- 多选：用标签点选，比 checkbox-group 在手机上好点 -->
    <view v-else-if="field.type === 'MULTI_SELECT'" class="chips">
      <text
        v-for="o in options"
        :key="o.value"
        :class="['chip', { 'chip--on': multiValues.includes(o.value) }]"
        @tap="toggleMulti(o.value)"
      >
        {{ o.label }}
      </text>
      <text v-if="!options.length" class="yq-muted">该字段还没配置选项</text>
    </view>

    <!-- 日期 -->
    <picker v-else-if="field.type === 'DATE'" mode="date" :value="(modelValue as string) ?? ''" @change="onDate">
      <view class="control control--picker">
        <text :class="{ placeholder: !modelValue }">{{ modelValue || field.placeholder || '请选择日期' }}</text>
        <text class="arrow">›</text>
      </view>
    </picker>

    <!-- 是否 -->
    <view v-else-if="field.type === 'BOOLEAN'" class="control control--switch">
      <switch :checked="!!modelValue" color="#e05a7d" @change="onBoolean" />
    </view>

    <!-- 数值区间 -->
    <view v-else-if="field.type === 'RANGE'" class="range">
      <input
        class="control control--half"
        type="number"
        :value="rangeValue.min === '' ? '' : String(rangeValue.min)"
        placeholder="最小"
        @input="(e) => onRange('min', e as never)"
      />
      <text class="sep">-</text>
      <input
        class="control control--half"
        type="number"
        :value="rangeValue.max === '' ? '' : String(rangeValue.max)"
        placeholder="最大"
        @input="(e) => onRange('max', e as never)"
      />
    </view>

    <!-- 图片类字段统一去「我的照片」页管理，这里只给入口 -->
    <view
      v-else-if="field.type === 'IMAGE' || field.type === 'IMAGES'"
      class="control control--picker"
      @tap="() => uni.navigateTo({ url: '/pages/profile/photos' })"
    >
      <text class="placeholder">去照片管理页上传</text>
      <text class="arrow">›</text>
    </view>

    <!-- 兜底：出现没适配的类型时不至于整页白掉 -->
    <input v-else class="control" :value="(modelValue as string) ?? ''" :placeholder="field.placeholder || ''" @input="onInput" />

    <text v-if="field.helpText" class="help yq-muted">{{ field.helpText }}</text>
  </view>
</template>

<style lang="scss" scoped>
.field {
  padding: 24rpx 0;
  border-bottom: 1rpx solid $yq-border;
}

.field:last-child {
  border-bottom: none;
}

.label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14rpx;
}

.label {
  font-size: 28rpx;
}

.required {
  margin-right: 4rpx;
  color: $yq-danger;
}

.control {
  width: 100%;
  padding: 16rpx 20rpx;
  background: $yq-bg;
  border-radius: 12rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

.control--area {
  height: 160rpx;
}

.control--picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.control--switch {
  background: transparent;
  padding: 0;
}

.control--half {
  flex: 1;
}

.placeholder {
  color: #bbb;
}

.arrow {
  color: $yq-text-secondary;
}

.chips {
  display: flex;
  flex-wrap: wrap;
}

.chip {
  padding: 10rpx 24rpx;
  margin: 0 12rpx 12rpx 0;
  background: $yq-bg;
  border: 1rpx solid transparent;
  border-radius: 30rpx;
  font-size: 26rpx;
}

.chip--on {
  background: $yq-primary-light;
  border-color: $yq-primary;
  color: $yq-primary;
}

.range {
  display: flex;
  align-items: center;
}

.sep {
  padding: 0 16rpx;
  color: $yq-text-secondary;
}

.help {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  line-height: 1.5;
}
</style>
