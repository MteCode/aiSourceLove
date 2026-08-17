import type { PageResult, UserStatus } from '@yuanqiao/shared';
import { request } from './request';
import type { AdminInviteDto, OperationLogRow, PermissionGroup, RegionNode, RoleRow, SysUserRow } from './types';

export const systemApi = {
  listUsers(query: { page?: number; pageSize?: number; keyword?: string; status?: UserStatus; roleCode?: string }) {
    return request.get<PageResult<SysUserRow>>('/system/users', query);
  },
  createUser(body: { phone: string; nickname: string; password: string; roleCodes: string[] }) {
    return request.post<SysUserRow>('/system/users', body);
  },
  updateUser(
    id: string,
    body: Partial<{ nickname: string; status: UserStatus; password: string; roleCodes: string[] }>,
  ) {
    return request.put<SysUserRow>(`/system/users/${id}`, body);
  },
  listRoles() {
    return request.get<RoleRow[]>('/system/roles');
  },
  listPermissions() {
    return request.get<PermissionGroup[]>('/system/permissions');
  },
  updateRolePermissions(id: string, permissionCodes: string[]) {
    return request.put<unknown>(`/system/roles/${id}/permissions`, { permissionCodes });
  },
  listLogs(query: {
    page?: number;
    pageSize?: number;
    keyword?: string;
    module?: string;
    success?: boolean;
    startDate?: string;
    endDate?: string;
  }) {
    return request.get<PageResult<OperationLogRow>>('/system/logs', query);
  },
  // ── 管理员邀请码 ──
  // 带这个码注册的用户才允许申请成为红娘；红娘自己分享出去的人只能是客户

  listInvites() {
    return request.get<AdminInviteDto[]>('/system/invites');
  },
  createInvite(body: { remark?: string; expiresInDays?: number; maxUses?: number }) {
    return request.post<AdminInviteDto>('/system/invites', body);
  },
  disableInvite(id: string) {
    return request.put<void>(`/system/invites/${id}/disable`);
  },

  regionTree() {
    return request.get<RegionNode[]>('/system/regions/tree');
  },
};
