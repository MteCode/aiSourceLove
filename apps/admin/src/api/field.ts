import type { FieldDefDto, FieldGroupDto, FormSchemaDto } from '@yuanqiao/shared';
import { request } from './request';

export type FieldDefInput = Partial<Omit<FieldDefDto, 'id' | 'groupName'>> & { groupId?: string };

export const fieldApi = {
  schema() {
    return request.get<FormSchemaDto>('/fields/schema');
  },
  preferenceSchema() {
    return request.get<FormSchemaDto>('/fields/schema/preference');
  },
  groups() {
    return request.get<FieldGroupDto[]>('/fields/groups');
  },
  createGroup(body: { code: string; name: string; sort?: number; enabled?: boolean }) {
    return request.post<FieldGroupDto>('/fields/groups', body);
  },
  updateGroup(id: string, body: Partial<{ code: string; name: string; sort: number; enabled: boolean }>) {
    return request.put<FieldGroupDto>(`/fields/groups/${id}`, body);
  },
  removeGroup(id: string) {
    return request.delete<unknown>(`/fields/groups/${id}`);
  },
  create(body: FieldDefInput) {
    return request.post<FieldDefDto>('/fields', body);
  },
  update(id: string, body: FieldDefInput) {
    return request.put<FieldDefDto>(`/fields/${id}`, body);
  },
  remove(id: string) {
    return request.delete<unknown>(`/fields/${id}`);
  },
};
