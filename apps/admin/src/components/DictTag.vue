<template>
  <el-tag v-if="label" :type="tagType" size="small" effect="light">{{ label }}</el-tag>
  <span v-else class="text-muted">-</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  AUDIT_STATUS_LABEL,
  COMMISSION_STATUS_LABEL,
  GENDER_LABEL,
  INTRODUCTION_STATUS_LABEL,
  ORDER_STATUS_LABEL,
  PROFILE_SOURCE_LABEL,
  PROFILE_STATUS_LABEL,
  WITHDRAWAL_STATUS_LABEL,
} from '@yuanqiao/shared';

type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger';

/**
 * 枚举 → 中文标签 + 语义色。
 *
 * 标签文案一律取自 shared/constants，页面里不许再手写中文，
 * 否则运营改一次说法就要满仓库 grep。
 */
const props = defineProps<{
  /** 枚举所属的域 */
  dict:
    | 'profileStatus'
    | 'auditStatus'
    | 'introStatus'
    | 'orderStatus'
    | 'commissionStatus'
    | 'withdrawalStatus'
    | 'gender'
    | 'source'
    | 'matchmakerStatus'
    | 'userStatus';
  value?: string | null;
}>();

const LABELS: Record<string, Record<string, string>> = {
  profileStatus: PROFILE_STATUS_LABEL,
  auditStatus: AUDIT_STATUS_LABEL,
  introStatus: INTRODUCTION_STATUS_LABEL,
  orderStatus: ORDER_STATUS_LABEL,
  commissionStatus: COMMISSION_STATUS_LABEL,
  withdrawalStatus: WITHDRAWAL_STATUS_LABEL,
  gender: GENDER_LABEL,
  source: PROFILE_SOURCE_LABEL,
  matchmakerStatus: { PENDING: '待审核', ACTIVE: '服务中', SUSPENDED: '已停用' },
  userStatus: { ACTIVE: '正常', BANNED: '已封禁', DEACTIVATED: '已注销' },
};

/** 状态值 → 色。同名状态在不同域里含义一致（PENDING 都是「等人处理」），所以可以共用一张表 */
const COLORS: Record<string, TagType> = {
  DRAFT: 'info',
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  OFFLINE: 'info',
  ACTIVE: 'success',
  SUSPENDED: 'danger',
  BANNED: 'danger',
  DEACTIVATED: 'info',
  INITIATED: 'info',
  RECOMMENDED: 'primary',
  PARTIALLY_AGREED: 'warning',
  BOTH_AGREED: 'primary',
  CONTACT_EXCHANGED: 'primary',
  MET: 'primary',
  SUCCESS: 'success',
  FAILED: 'danger',
  CANCELLED: 'info',
  PAID: 'success',
  CLOSED: 'info',
  REFUNDING: 'warning',
  REFUNDED: 'danger',
  SETTLED: 'success',
  WITHDRAWN: 'info',
  MALE: 'primary',
  FEMALE: 'danger',
  SELF: 'success',
  MATCHMAKER: 'warning',
  IMPORT: 'info',
};

const label = computed(() => (props.value ? (LABELS[props.dict]?.[props.value] ?? props.value) : ''));
const tagType = computed<TagType>(() => (props.value ? (COLORS[props.value] ?? 'info') : 'info'));
</script>
