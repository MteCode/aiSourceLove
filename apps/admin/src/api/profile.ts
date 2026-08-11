import type {
  AuditLogDto,
  PageResult,
  ProfileDto,
  ProfileBriefDto,
  ProfileStatus,
  Gender,
  ProfileSource,
} from '@yuanqiao/shared';
import { request } from './request';
import type { PendingCount } from './types';

export interface ProfileQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: ProfileStatus;
  gender?: Gender;
  cityCode?: string;
  source?: ProfileSource;
  matchmakerId?: string;
  ageMin?: number;
  ageMax?: number;
  hasPendingPhoto?: boolean;
}

export const profileApi = {
  list(query: ProfileQuery) {
    return request.get<PageResult<ProfileBriefDto>>('/admin/profiles', query);
  },
  pendingCount() {
    return request.get<PendingCount>('/admin/profiles/pending-count', undefined, { silent: true });
  },
  detail(id: string) {
    return request.get<ProfileDto>(`/admin/profiles/${id}`);
  },
  auditLogs(id: string) {
    return request.get<AuditLogDto[]>(`/admin/profiles/${id}/audit-logs`);
  },
  audit(id: string, body: { targetStatus: ProfileStatus; reason?: string; rejectedFields?: string[] }) {
    return request.put<ProfileDto>(`/admin/profiles/${id}/audit`, body);
  },
  assignMatchmaker(id: string, matchmakerId: string | null) {
    return request.put<unknown>(`/admin/profiles/${id}/matchmaker`, { matchmakerId });
  },
  remove(id: string) {
    return request.delete<unknown>(`/admin/profiles/${id}`);
  },
  auditPhoto(photoId: string, status: 'APPROVED' | 'REJECTED', reason?: string) {
    return request.put<unknown>(`/profiles/photos/${photoId}/audit`, { status, reason });
  },
  setPrimaryPhoto(photoId: string) {
    return request.put<unknown>(`/profiles/photos/${photoId}/primary`);
  },
  deletePhoto(photoId: string) {
    return request.delete<unknown>(`/profiles/photos/${photoId}`);
  },
};
