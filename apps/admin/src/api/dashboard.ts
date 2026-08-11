import type { DashboardDto } from '@yuanqiao/shared';
import { request } from './request';

export const dashboardApi = {
  overview() {
    return request.get<DashboardDto>('/dashboard');
  },
};
