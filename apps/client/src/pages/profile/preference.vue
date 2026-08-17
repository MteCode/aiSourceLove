<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { reactive, ref } from 'vue';
import {
  CHILDREN_LABEL,
  ChildrenStatus,
  EDUCATION_LABEL,
  Education,
  MARITAL_LABEL,
  MaritalStatus,
  type PreferenceDto,
} from '@yuanqiao/shared';
import { profileApi } from '@/api';
import { hideLoading, loading, toast } from '@/utils/ui';

/**
 * 择偶要求。
 *
 * 这份数据是匹配引擎里权重最高的一项（mutualPreference 0.4），
 * 填得越具体，推荐越准——所以每一项都给了「不限」的明确选项，
 * 而不是留空让用户猜。
 */

const EDU_OPTIONS = [
  { value: '', label: '不限' },
  ...Object.entries(EDUCATION_LABEL).map(([value, label]) => ({ value, label })),
];

const MARITAL_OPTIONS = Object.entries(MARITAL_LABEL).map(([value, label]) => ({ value, label }));
const CHILDREN_OPTIONS = Object.entries(CHILDREN_LABEL).map(([value, label]) => ({ value, label }));

const saving = ref(false);
const eduIndex = ref(0);

const form = reactive({
  ageMin: undefined as number | undefined,
  ageMax: undefined as number | undefined,
  heightMin: undefined as number | undefined,
  heightMax: undefined as number | undefined,
  educationMin: '' as string,
  incomeWan: undefined as number | undefined,
  maritalStatus: [] as string[],
  childrenStatus: [] as string[],
  requireHouse: false,
  requireCar: false,
  description: '',
});

async function load(): Promise<void> {
  loading();
  try {
    const p = await profileApi.me();
    const pref = p?.preference;
    if (!pref) return;
    fill(pref);
  } finally {
    hideLoading();
  }
}

function fill(pref: PreferenceDto): void {
  form.ageMin = pref.ageMin ?? undefined;
  form.ageMax = pref.ageMax ?? undefined;
  form.heightMin = pref.heightMin ?? undefined;
  form.heightMax = pref.heightMax ?? undefined;
  form.educationMin = pref.educationMin ?? '';
  // 收入在界面上用「万」，用户不会按元来想
  form.incomeWan = pref.incomeMin != null ? pref.incomeMin / 10000 : undefined;
  form.maritalStatus = [...pref.maritalStatus];
  form.childrenStatus = [...pref.childrenStatus];
  form.requireHouse = pref.requireHouse;
  form.requireCar = pref.requireCar;
  form.description = pref.description ?? '';
  eduIndex.value = Math.max(EDU_OPTIONS.findIndex((o) => o.value === form.educationMin), 0);
}

/** uni 的事件对象在各端形状不完全一致，统一收口成这个最小结构 */
type PickerEvent = { detail: { value: string } };
type SwitchEvent = { detail: { value: boolean } };

function num(e: PickerEvent): number | undefined {
  return e.detail.value === '' ? undefined : Number(e.detail.value);
}

function onEduChange(e: PickerEvent): void {
  eduIndex.value = Number(e.detail.value);
  form.educationMin = EDU_OPTIONS[eduIndex.value].value;
}

function onHouseChange(e: SwitchEvent): void {
  form.requireHouse = e.detail.value;
}

function onCarChange(e: SwitchEvent): void {
  form.requireCar = e.detail.value;
}

function onDescInput(e: PickerEvent): void {
  form.description = e.detail.value;
}

function toggle(list: string[], value: string): void {
  const i = list.indexOf(value);
  if (i >= 0) list.splice(i, 1);
  else list.push(value);
}

async function save(): Promise<void> {
  if (form.ageMin && form.ageMax && form.ageMin > form.ageMax) {
    toast('年龄下限不能大于上限');
    return;
  }
  if (form.heightMin && form.heightMax && form.heightMin > form.heightMax) {
    toast('身高下限不能大于上限');
    return;
  }

  saving.value = true;
  try {
    await profileApi.upsertMe({
      preference: {
        ageMin: form.ageMin,
        ageMax: form.ageMax,
        heightMin: form.heightMin,
        heightMax: form.heightMax,
        educationMin: form.educationMin || undefined,
        incomeMin: form.incomeWan != null ? Math.round(form.incomeWan * 10000) : undefined,
        maritalStatus: form.maritalStatus as MaritalStatus[],
        childrenStatus: form.childrenStatus as ChildrenStatus[],
        requireHouse: form.requireHouse,
        requireCar: form.requireCar,
        description: form.description || undefined,
      },
    });
    toast('已保存', 'success');
    setTimeout(() => uni.navigateBack(), 600);
  } finally {
    saving.value = false;
  }
}

onShow(load);
</script>

<template>
  <view class="yq-page">
    <view class="tip yq-card">
      <text class="yq-muted">
        择偶要求是匹配里权重最高的一项。留空表示不限，填得越具体推荐越准，
        但过于苛刻会让可匹配的人变少。
      </text>
    </view>

    <yq-card title="基本条件">
      <view class="row">
        <text class="label">年龄</text>
        <input class="input" type="number" :value="form.ageMin ?? ''" placeholder="不限" @input="(e: PickerEvent) => (form.ageMin = num(e))" />
        <text class="sep">-</text>
        <input class="input" type="number" :value="form.ageMax ?? ''" placeholder="不限" @input="(e: PickerEvent) => (form.ageMax = num(e))" />
        <text class="unit">岁</text>
      </view>

      <view class="row">
        <text class="label">身高</text>
        <input class="input" type="number" :value="form.heightMin ?? ''" placeholder="不限" @input="(e: PickerEvent) => (form.heightMin = num(e))" />
        <text class="sep">-</text>
        <input class="input" type="number" :value="form.heightMax ?? ''" placeholder="不限" @input="(e: PickerEvent) => (form.heightMax = num(e))" />
        <text class="unit">cm</text>
      </view>

      <view class="row">
        <text class="label">最低学历</text>
        <picker
          class="flex1"
          :range="EDU_OPTIONS"
          range-key="label"
          :value="eduIndex"
          @change="onEduChange"
        >
          <view class="picker">
            <text>{{ EDU_OPTIONS[eduIndex].label }}</text>
            <text class="arrow">›</text>
          </view>
        </picker>
      </view>

      <view class="row">
        <text class="label">年收入不低于</text>
        <input class="input flex1" type="digit" :value="form.incomeWan ?? ''" placeholder="不限" @input="(e: PickerEvent) => (form.incomeWan = num(e))" />
        <text class="unit">万</text>
      </view>
    </yq-card>

    <yq-card title="可接受的婚史">
      <view class="chips">
        <text
          v-for="o in MARITAL_OPTIONS"
          :key="o.value"
          :class="['chip', { 'chip--on': form.maritalStatus.includes(o.value) }]"
          @tap="toggle(form.maritalStatus, o.value)"
        >
          {{ o.label }}
        </text>
      </view>
      <text class="yq-muted hint">不选 = 不限</text>
    </yq-card>

    <yq-card title="可接受的子女情况">
      <view class="chips">
        <text
          v-for="o in CHILDREN_OPTIONS"
          :key="o.value"
          :class="['chip', { 'chip--on': form.childrenStatus.includes(o.value) }]"
          @tap="toggle(form.childrenStatus, o.value)"
        >
          {{ o.label }}
        </text>
      </view>
      <text class="yq-muted hint">不选 = 不限</text>
    </yq-card>

    <yq-card title="物质条件">
      <view class="switch-row">
        <text>要求有房</text>
        <switch :checked="form.requireHouse" color="$yq-primary" @change="onHouseChange" />
      </view>
      <view class="switch-row">
        <text>要求有车</text>
        <switch :checked="form.requireCar" color="$yq-primary" @change="onCarChange" />
      </view>
    </yq-card>

    <yq-card title="补充描述">
      <textarea
        class="area"
        :value="form.description"
        placeholder="用一段话描述你想找什么样的人。这段会参与 AI 语义匹配，写得越真实越有用。"
        maxlength="1000"
        @input="onDescInput"
      />
    </yq-card>

    <view class="footer">
      <button class="btn" :disabled="saving" @tap="save">保存</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.tip {
  font-size: 24rpx;
  line-height: 1.7;
}

.row {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid $yq-border;
}

.row:last-child {
  border-bottom: none;
}

.label {
  width: 200rpx;
  font-size: 28rpx;
}

.input {
  width: 140rpx;
  padding: 12rpx 16rpx;
  background: $yq-bg;
  border-radius: 10rpx;
  font-size: 28rpx;
  text-align: center;
}

.flex1 {
  flex: 1;
}

.sep,
.unit {
  padding: 0 12rpx;
  color: $yq-text-secondary;
}

.picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12rpx 16rpx;
  background: $yq-bg;
  border-radius: 10rpx;
}

.arrow {
  color: $yq-text-secondary;
}

.chips {
  display: flex;
  flex-wrap: wrap;
}

.chip {
  padding: 12rpx 28rpx;
  margin: 0 14rpx 14rpx 0;
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

.hint {
  font-size: 22rpx;
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 0;
}

.area {
  width: 100%;
  height: 200rpx;
  padding: 16rpx;
  background: $yq-bg;
  border-radius: 12rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

.footer {
  padding: 24rpx 20rpx calc(24rpx + env(safe-area-inset-bottom));
}

.btn {
  background: $yq-primary;
  color: $yq-on-primary;
  border-radius: 44rpx;
  font-size: 30rpx;
  line-height: 88rpx;
}
</style>
