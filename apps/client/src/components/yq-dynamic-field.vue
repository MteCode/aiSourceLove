<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { FieldDefDto } from '@yuanqiao/shared';
import { loadRegionTree, type RegionNode } from '@/utils/region';

/**
 * 动态表单的单个字段。
 *
 * 字段定义来自后台的字段字典，运营在后台加一个字段，
 * 这里就自动多出一个输入控件，不需要发版。
 */
const props = defineProps<{ field: FieldDefDto; modelValue: unknown }>();
const emit = defineEmits<{ 'update:modelValue': [v: unknown] }>();

const options = computed(() => props.field.options ?? []);

// ───────── 行政区划 ─────────

const regionTree = ref<RegionNode[]>([]);
/** 三列各自选中的下标 */
const regionIndex = ref<number[]>([0, 0, 0]);

/**
 * 区划树只在真的有 REGION 字段时才拉，而且整个表单共用一次缓存——
 * 常住城市和籍贯都是 REGION，各拉一次是浪费。
 */
onMounted(async () => {
  if (props.field.type !== 'REGION') return;
  regionTree.value = (await loadRegionTree()) as RegionNode[];
  syncIndexFromValue();
});

const provinces = computed(() => regionTree.value);
const cities = computed(() => provinces.value[regionIndex.value[0]]?.children ?? []);
const districts = computed(() => cities.value[regionIndex.value[1]]?.children ?? []);

// 区县这一列可能为空（直辖市、或者数据只到市），空数组会让 picker 那一列不可用，
// 给个占位项，用户至少知道"这里没有更细的了"
const regionRange = computed(() => [
  provinces.value,
  cities.value,
  districts.value.length ? districts.value : [{ value: '', label: '不限' }],
]);

/**
 * 显示文字必须由**真实值**推出来，不能由三列下标推。
 *
 * 下标默认是 [0,0,0]，用它算文字的话，用户还没点开选择器就已经显示
 * 「北京市 北京市 东城区」——看着填好了，modelValue 其实是空的。
 * 结果是保存时被必填校验拦下，而用户盯着那行字完全不知道哪里没填。
 */
const regionText = computed(() => {
  const code = props.modelValue as string | undefined;
  if (!code) return '';
  for (const p of provinces.value) {
    for (const c of p.children ?? []) {
      if (c.value === code) return `${p.label} ${c.label}`;
      const d = (c.children ?? []).find((x) => x.value === code);
      if (d) return `${p.label} ${c.label} ${d.label}`;
    }
  }
  // 树还没加载完时先把 code 显示出来，总比空着让人以为没保存成功强
  return code;
});

/** 已有值时把三列下标还原出来，否则重新进页面选过的会丢 */
function syncIndexFromValue(): void {
  const code = props.modelValue as string | undefined;
  if (!code) return;
  for (let i = 0; i < provinces.value.length; i++) {
    const cs = provinces.value[i].children ?? [];
    for (let j = 0; j < cs.length; j++) {
      if (cs[j].value === code) { regionIndex.value = [i, j, 0]; return; }
      const ds = cs[j].children ?? [];
      const k = ds.findIndex((d) => d.value === code);
      if (k >= 0) { regionIndex.value = [i, j, k]; return; }
    }
  }
}

/** 改省要把市、区归零，否则会出现"河北省 + 上海市"这种组合 */
function onRegionColumn(e: { detail: { column: number; value: number } }): void {
  const idx = [...regionIndex.value];
  idx[e.detail.column] = e.detail.value;
  if (e.detail.column === 0) { idx[1] = 0; idx[2] = 0; }
  if (e.detail.column === 1) idx[2] = 0;
  regionIndex.value = idx;
}

/** 回传最细一级的 code：选到区就传区，只选到市就传市 */
function onRegionChange(): void {
  const d = districts.value[regionIndex.value[2]];
  const c = cities.value[regionIndex.value[1]];
  emit('update:modelValue', d?.value || c?.value || '');
}

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

/** uni 各端的事件对象形状不完全一致，统一收口成这个最小结构 */
export type UniInputEvent = { detail: { value: string } };

function onInput(e: UniInputEvent): void {
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

function onRange(which: 'min' | 'max', e: UniInputEvent): void {
  const v = e.detail.value === '' ? undefined : Number(e.detail.value);
  emit('update:modelValue', { ...rangeValue.value, [which]: v });
}

/** 模板里访问不到 uni，跳转统一走包装函数 */
function goto(url: string): void {
  uni.navigateTo({ url });
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
      :placeholder="field.placeholder || '请输入'" placeholder-class="ph"
      :maxlength="field.maxLength ?? 140"
      @input="onInput"
    />

    <!-- 多行文本 -->
    <textarea
      v-else-if="field.type === 'TEXTAREA'"
      class="control control--area"
      :value="(modelValue as string) ?? ''"
      :placeholder="field.placeholder || '请输入'" placeholder-class="ph"
      :maxlength="field.maxLength ?? 500"
      @input="onInput"
    />

    <!-- 数字 -->
    <input
      v-else-if="field.type === 'NUMBER'"
      class="control"
      type="number"
      :value="modelValue == null ? '' : String(modelValue)"
      :placeholder="field.placeholder || '请输入'" placeholder-class="ph"
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
      <switch :checked="!!modelValue" color="$yq-primary" @change="onBoolean" />
    </view>

    <!-- 数值区间 -->
    <view v-else-if="field.type === 'RANGE'" class="range">
      <input
        class="control control--half"
        type="number"
        :value="rangeValue.min === '' ? '' : String(rangeValue.min)"
        placeholder="最小"
        @input="(e: UniInputEvent) => onRange('min', e)"
      />
      <text class="sep">-</text>
      <input
        class="control control--half"
        type="number"
        :value="rangeValue.max === '' ? '' : String(rangeValue.max)"
        placeholder="最大"
        @input="(e: UniInputEvent) => onRange('max', e)"
      />
    </view>

    <!-- 图片类字段统一去「我的照片」页管理，这里只给入口 -->
    <view
      v-else-if="field.type === 'IMAGE' || field.type === 'IMAGES'"
      class="control control--picker"
      @tap="goto('/pages/profile/photos')"
    >
      <text class="placeholder">去照片管理页上传</text>
      <text class="arrow">›</text>
    </view>

    <!--
      行政区划：三级联动。
      没有这个分支的话 REGION 类型会掉进最后的兜底 input，
      变成一个让用户手打区划代码的空框——而常住城市还是必填项。
    -->
    <picker
      v-else-if="field.type === 'REGION'"
      mode="multiSelector"
      :range="regionRange"
      range-key="label"
      :value="regionIndex"
      @columnchange="onRegionColumn"
      @change="onRegionChange"
    >
      <view class="control control--picker">
        <text :class="{ placeholder: !regionText }">{{ regionText || '请选择地区' }}</text>
        <text class="arrow">›</text>
      </view>
    </picker>

    <!-- 兜底：出现没适配的类型时不至于整页白掉 -->
    <input v-else class="control" :value="(modelValue as string) ?? ''" :placeholder="field.placeholder || ''" placeholder-class="ph" @input="onInput" />

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

/**
 * 所有控件共用一套尺寸。
 *
 * 必须显式给 height 和 line-height：<input> 用的是自己的固有高度（偏矮），
 * 而 picker 是 flex 行、高度由文字撑开，两者放一起会明显不齐——
 * 表单里一行高一行矮，看着像没做完。
 */
.control {
  width: 100%;
  height: 88rpx;
  padding: 0 24rpx;
  line-height: 88rpx;
  background: $yq-surface-2;
  border: 1rpx solid $yq-border;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: $yq-text;
  box-sizing: border-box;
}

/* 多行输入：自我介绍这类要给足空间，用户才愿意写 */
.control--area {
  height: 220rpx;
  padding: 20rpx 24rpx;
  line-height: 1.6;
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

.placeholder,
.ph {
  color: $yq-text-muted;
  font-size: 28rpx;
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
