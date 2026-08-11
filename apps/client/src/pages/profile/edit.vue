<script setup lang="ts">
import { onLoad, onShow } from '@dcloudio/uni-app';
import { computed, reactive, ref } from 'vue';
import { ProfileStatus, PROFILE_STATUS_LABEL, type FieldDefDto, type FieldGroupDto, type ProfileDto } from '@yuanqiao/shared';
import { fieldApi, profileApi } from '@/api';
import { useUserStore } from '@/stores/user';
import { confirm, hideLoading, loading, toast } from '@/utils/ui';

/**
 * 我的资料。
 *
 * 表单结构完全由后台的字段字典决定：isCore 的字段映射到 Profile 固定列，
 * 其余落 extras（EAV）。这里按 field.code 是否属于固定列来决定往哪个桶里放。
 */

const user = useUserStore();

const groups = ref<FieldGroupDto[]>([]);
const profile = ref<ProfileDto | null>(null);
const form = reactive<Record<string, unknown>>({});
const saving = ref(false);
const isFirst = ref(false);

onLoad((options) => {
  isFirst.value = options?.first === '1';
});

const statusText = computed(() =>
  profile.value ? PROFILE_STATUS_LABEL[profile.value.status] : '未创建',
);

const rejectedReason = ref('');

/** 驳回时后端会给出问题字段，标红引导用户改哪儿 */
const rejectedFields = ref<string[]>([]);

const canSubmit = computed(
  () =>
    !!profile.value &&
    profile.value.status !== ProfileStatus.PENDING &&
    profile.value.status !== ProfileStatus.APPROVED,
);

async function load(): Promise<void> {
  if (!user.requireLogin()) return;
  loading();
  try {
    const [schema, mine] = await Promise.all([fieldApi.schema(), profileApi.me()]);
    groups.value = schema.groups;
    profile.value = mine;
    fillForm(mine);
    if (mine && mine.status === ProfileStatus.REJECTED) await loadRejectReason();
  } finally {
    hideLoading();
  }
}

async function loadRejectReason(): Promise<void> {
  const logs = await profileApi.myAuditLogs();
  const last = logs.find((l) => l.toStatus === ProfileStatus.REJECTED);
  rejectedReason.value = last?.reason ?? '';
}

function fillForm(p: ProfileDto | null): void {
  for (const k of Object.keys(form)) delete form[k];
  if (!p) return;

  // 固定列：直接从档案对象上取。脱敏字段（MaskedValue）不回填，
  // 本人看自己是全可见的，理论上不会出现，兜底防止把锁对象塞进输入框
  const record = p as unknown as Record<string, unknown>;
  for (const g of groups.value) {
    for (const f of g.fields) {
      if (!f.isCore) continue;
      const v = record[f.code];
      if (v != null && typeof v === 'object' && 'locked' in (v as object)) continue;
      form[f.code] = v;
    }
  }
  // 扩展字段
  for (const [k, v] of Object.entries(p.extras ?? {})) form[k] = v;
}

function isRejected(code: string): boolean {
  return rejectedFields.value.includes(code);
}

/** 提交前按字段定义做一次本地校验，省掉一次网络往返 */
function validate(): string | null {
  for (const g of groups.value) {
    for (const f of g.fields) {
      if (!f.enabled) continue;
      const v = form[f.code];
      const empty = v == null || v === '' || (Array.isArray(v) && v.length === 0);
      if (f.required && empty) return `请填写「${f.label}」`;
      if (empty) continue;
      if (f.type === 'NUMBER' && typeof v === 'number') {
        if (f.minValue != null && v < f.minValue) return `「${f.label}」不能小于 ${f.minValue}`;
        if (f.maxValue != null && v > f.maxValue) return `「${f.label}」不能大于 ${f.maxValue}`;
      }
      if (f.regex && typeof v === 'string' && !new RegExp(f.regex).test(v)) {
        return `「${f.label}」格式不正确`;
      }
    }
  }
  return null;
}

/** 拆成固定列和 extras 两个桶——后端就是这么存的 */
function buildPayload(): Record<string, unknown> {
  const core: Record<string, unknown> = {};
  const extras: Record<string, unknown> = {};
  for (const g of groups.value) {
    for (const f of g.fields) {
      if (!f.enabled) continue;
      const v = form[f.code];
      if (v === undefined) continue;
      if (f.isCore) core[f.code] = v;
      else extras[f.code] = v;
    }
  }
  return { ...core, extras };
}

async function save(silent = false): Promise<boolean> {
  const err = validate();
  if (err) {
    toast(err);
    return false;
  }
  saving.value = true;
  try {
    profile.value = await profileApi.upsertMe(buildPayload());
    await user.refreshQuietly();
    if (!silent) toast('已保存', 'success');
    return true;
  } catch {
    return false;
  } finally {
    saving.value = false;
  }
}

async function submitAudit(): Promise<void> {
  if (!(await save(true))) return;
  if (!(await confirm('提交后资料进入审核队列，审核期间不能修改。确定提交吗？', '提交审核'))) return;
  try {
    profile.value = await profileApi.submit();
    await user.refreshQuietly();
    toast('已提交审核', 'success');
  } catch {
    // 错误已由请求层提示
  }
}

function goPreference(): void {
  uni.navigateTo({ url: '/pages/profile/preference' });
}

function goPhotos(): void {
  uni.navigateTo({ url: '/pages/profile/photos' });
}

function goClaim(): void {
  uni.navigateTo({ url: '/pages/profile/claim' });
}

onShow(load);
</script>

<template>
  <view class="yq-page">
    <!-- 状态条：审核中/被驳回时最需要看到的信息 -->
    <view :class="['status', `status--${profile?.status ?? 'NONE'}`]">
      <view class="yq-between">
        <text class="status-text">资料状态：{{ statusText }}</text>
        <text v-if="profile" class="serial">{{ profile.serialNo }}</text>
      </view>
      <text v-if="profile?.status === 'PENDING'" class="status-tip">
        审核一般在 24 小时内完成，通过后就能被推荐给合适的人
      </text>
      <text v-else-if="profile?.status === 'REJECTED'" class="status-tip">
        驳回原因：{{ rejectedReason || '请检查资料完整性' }}
      </text>
      <text v-else-if="profile?.status === 'APPROVED'" class="status-tip">
        资料已通过。修改关键信息后需要重新审核
      </text>
      <text v-else-if="isFirst" class="status-tip">
        完善资料后提交审核，通过才能开始匹配。若红娘已线下帮你录过，可直接
        <text class="link" @tap="goClaim">用编号认领</text>
      </text>
    </view>

    <view v-for="g in groups" :key="g.id" class="yq-card">
      <text class="group-title">{{ g.name }}</text>
      <template v-for="f in g.fields" :key="f.id">
        <view v-if="f.enabled" :class="{ 'field-rejected': isRejected(f.code) }">
          <yq-dynamic-field :field="f" v-model="form[f.code]" />
        </view>
      </template>
    </view>

    <view class="yq-card">
      <view class="link-row" @tap="goPreference">
        <text>择偶要求</text>
        <text class="arrow">›</text>
      </view>
      <view class="link-row" @tap="goPhotos">
        <text>我的照片</text>
        <text class="arrow">›</text>
      </view>
      <view class="link-row" @tap="goClaim">
        <text>认领红娘代录的档案</text>
        <text class="arrow">›</text>
      </view>
    </view>

    <view class="footer">
      <button class="btn btn--plain" :disabled="saving" @tap="save(false)">保存草稿</button>
      <button class="btn btn--primary" :disabled="saving || !canSubmit" @tap="submitAudit">
        {{ profile?.status === 'PENDING' ? '审核中' : '提交审核' }}
      </button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.status {
  margin: 20rpx;
  padding: 24rpx;
  border-radius: $yq-radius;
  background: #fff;
}

.status--PENDING {
  background: #fdf6ec;
}

.status--REJECTED {
  background: #fef0f0;
}

.status--APPROVED {
  background: #f0f9eb;
}

.status-text {
  font-size: 30rpx;
  font-weight: 600;
}

.serial {
  color: $yq-text-secondary;
  font-size: 24rpx;
}

.status-tip {
  display: block;
  margin-top: 10rpx;
  color: $yq-text-secondary;
  font-size: 24rpx;
  line-height: 1.6;
}

.link {
  color: $yq-primary;
}

.group-title {
  display: block;
  margin-bottom: 8rpx;
  padding-left: 12rpx;
  border-left: 6rpx solid $yq-primary;
  font-size: 30rpx;
  font-weight: 600;
}

.field-rejected {
  margin: 0 -12rpx;
  padding: 0 12rpx;
  background: #fef0f0;
  border-radius: 8rpx;
}

.link-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 26rpx 0;
  border-bottom: 1rpx solid $yq-border;
  font-size: 28rpx;
}

.link-row:last-child {
  border-bottom: none;
}

.arrow {
  color: $yq-text-secondary;
}

.footer {
  display: flex;
  gap: 20rpx;
  padding: 24rpx 20rpx calc(24rpx + env(safe-area-inset-bottom));
}

.btn {
  flex: 1;
  border-radius: 44rpx;
  font-size: 30rpx;
  line-height: 84rpx;
}

.btn--primary {
  background: $yq-primary;
  color: #fff;
}

.btn--primary[disabled] {
  background: #f0c3ce;
}

.btn--plain {
  background: #fff;
  color: $yq-text;
  border: 1rpx solid $yq-border;
}
</style>
