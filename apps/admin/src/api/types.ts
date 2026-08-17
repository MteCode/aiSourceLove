/**
 * 后台专用的响应形状。
 *
 * shared/types.ts 里的是「前后端共享契约」，后台管理还会用到一些
 * 直接来自 Prisma 的宽松结构（用户列表、提现单、角色…），放这里，
 * 不去污染 shared。
 */
import type { UserStatus, WithdrawalStatus, ProfileStatus } from '@yuanqiao/shared';

export interface SysUserRow {
  id: string;
  phone: string;
  nickname: string | null;
  avatar: string | null;
  status: UserStatus;
  isVip: boolean;
  vipExpireAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  roles: { code: string; name: string }[];
  profile: { id: string; serialNo: string; status: ProfileStatus } | null;
}

export interface RoleRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sort: number;
  permissions: { permission: { id: string; code: string; name: string; module: string } }[];
  _count: { users: number };
}

export interface PermissionGroup {
  module: string;
  permissions: { id: string; code: string; name: string; module: string }[];
}

export interface OperationLogRow {
  id: string;
  userId: string | null;
  username: string | null;
  module: string;
  action: string;
  method: string;
  path: string;
  params: string | null;
  ip: string | null;
  success: boolean;
  errorMsg: string | null;
  duration: number | null;
  createdAt: string;
}

export interface WithdrawalRow {
  id: string;
  matchmakerId: string;
  matchmaker: { name: string; phone: string } | null;
  amount: number;
  status: WithdrawalStatus;
  method: string | null;
  account: string | null;
  realName: string | null;
  rejectReason: string | null;
  remark: string | null;
  reviewedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface RegionNode {
  code: string;
  name: string;
  level: number;
  children?: RegionNode[];
}

export interface ReconcileRow {
  id: string;
  date: string;
  channel: string;
  result: string;
  localCount: number;
  remoteCount: number;
  localAmount: number;
  remoteAmount: number;
  detail: string | null;
  createdAt: string;
}

export interface PendingCount {
  profilePending: number;
  photoPending: number;
}

/** 管理员邀请码。后端 sys_admin_invite 表 */
export interface AdminInviteDto {
  id: string;
  code: string;
  remark: string | null;
  expiresAt: string | null;
  /** 0 = 不限次数 */
  maxUses: number;
  usedCount: number;
  enabled: boolean;
  createdAt: string;
}
