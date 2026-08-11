import type { MatchResultDto, MatchWeightKey, PageResult } from '@yuanqiao/shared';
import { request } from './request';

export interface MatchPreviewBody {
  profileId: string;
  page?: number;
  pageSize?: number;
  enableAi?: boolean;
  weights?: Partial<Record<MatchWeightKey, number>>;
  cityCode?: string;
  minScore?: number;
}

export const matchApi = {
  weights() {
    return request.get<{ key: MatchWeightKey; label: string; value: number }[]>('/match/weights');
  },
  run(query: MatchPreviewBody) {
    return request.get<PageResult<MatchResultDto>>('/match', query);
  },
  /** 后台调参：用自定义权重预览，不落库 */
  preview(body: MatchPreviewBody) {
    return request.post<PageResult<MatchResultDto>>('/match/preview', body);
  },
  scorePair(aProfileId: string, bProfileId: string) {
    return request.post<MatchResultDto>('/match/score-pair', { aProfileId, bProfileId });
  },
};
