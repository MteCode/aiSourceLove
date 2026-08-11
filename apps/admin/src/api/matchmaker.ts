import type {
  CommissionDto,
  CommissionStatus,
  IntroductionDto,
  IntroductionStatus,
  MatchmakerDto,
  MatchmakerStatsDto,
  MatchmakerStatus,
  PageResult,
  WithdrawalStatus,
} from '@yuanqiao/shared';
import { request } from './request';
import type { WithdrawalRow } from './types';

export const matchmakerApi = {
  list(query: { page?: number; pageSize?: number; keyword?: string; status?: MatchmakerStatus; cityCode?: string }) {
    return request.get<PageResult<MatchmakerDto>>('/matchmakers', query);
  },
  detail(id: string) {
    return request.get<MatchmakerDto>(`/matchmakers/${id}`);
  },
  stats(id: string) {
    return request.get<MatchmakerStatsDto>(`/matchmakers/${id}/stats`);
  },
  review(id: string, body: { status: MatchmakerStatus; commissionRate?: number; remark?: string }) {
    return request.put<MatchmakerDto>(`/matchmakers/${id}/review`, body);
  },
};

export const introductionApi = {
  list(query: {
    page?: number;
    pageSize?: number;
    status?: IntroductionStatus;
    matchmakerId?: string;
    profileId?: string;
    keyword?: string;
  }) {
    return request.get<PageResult<IntroductionDto>>('/introductions', query);
  },
  detail(id: string) {
    return request.get<IntroductionDto>(`/introductions/${id}`);
  },
  advance(id: string, targetStatus: IntroductionStatus, note?: string) {
    return request.put<IntroductionDto>(`/introductions/${id}/advance`, { targetStatus, note });
  },
};

export const commissionApi = {
  list(query: { page?: number; pageSize?: number; status?: CommissionStatus; matchmakerId?: string }) {
    return request.get<PageResult<CommissionDto>>('/commissions', query);
  },
  /** 把过了冷静期的分润批量转「可提现」 */
  settle() {
    return request.post<{ count: number; amount: number }>('/commissions/settle');
  },
  listWithdrawals(query: { page?: number; pageSize?: number; status?: WithdrawalStatus; matchmakerId?: string }) {
    return request.get<PageResult<WithdrawalRow>>('/commissions/withdrawals', query);
  },
  reviewWithdrawal(id: string, body: { status: WithdrawalStatus; rejectReason?: string; remark?: string }) {
    return request.put<WithdrawalRow>(`/commissions/withdrawals/${id}/review`, body);
  },
};
