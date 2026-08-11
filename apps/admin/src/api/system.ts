import type { PageResult, UserStatus } from '@yuanqiao/shared';
import { request } from './request';
import type { OperationLogRow, PermissionGroup, RegionNode, RoleRow, SysUserRow } from './types';

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
  regionTree() {
    return request.get<RegionNode[]>('/system/regions/tree');
  },
};
