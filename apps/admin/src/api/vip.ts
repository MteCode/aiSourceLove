import type { BenefitSpec, OrderDto, OrderStatus, PageResult, VipPackageDto } from '@yuanqiao/shared';
import { request } from './request';
import type { ReconcileRow } from './types';

export interface VipPackageInput {
  name: string;
  subtitle?: string;
  price: number;
  originalPrice?: number;
  durationDays: number;
  benefits: BenefitSpec[];
  isRecommended?: boolean;
  sort?: number;
  enabled?: boolean;
}

export const vipApi = {
  /** 后台要看到已下架的，所以走 all */
  all() {
    return request.get<VipPackageDto[]>('/vip/packages/all');
  },
  create(body: VipPackageInput) {
    return request.post<VipPackageDto>('/vip/packages', body);
  },
  update(id: string, body: Partial<VipPackageInput>) {
    return request.put<VipPackageDto>(`/vip/packages/${id}`, body);
  },
  remove(id: string) {
    return request.delete<unknown>(`/vip/packages/${id}`);
  },
};

export const orderApi = {
  list(query: {
    page?: number;
    pageSize?: number;
    status?: OrderStatus;
    keyword?: string;
    userId?: string;
    matchmakerId?: string;
  }) {
    return request.get<PageResult<OrderDto>>('/orders', query);
  },
  detail(id: string) {
    return request.get<OrderDto>(`/orders/${id}`);
  },
  refund(id: string, reason: string, amount?: number) {
    return request.post<OrderDto>(`/orders/${id}/refund`, { reason, amount });
  },
};

export const payApi = {
  reconcileList() {
    return request.get<ReconcileRow[]>('/pay/reconcile');
  },
  runReconcile(date?: string) {
    return request.post<unknown>('/pay/reconcile', { date });
  },
};
