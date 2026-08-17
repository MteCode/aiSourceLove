import type {
  AuditLogDto,
  CommissionDto,
  CreateOrderResult,
  CurrentUser,
  FormSchemaDto,
  IntroductionDto,
  LoginResult,
  MatchResultDto,
  MatchmakerDto,
  MatchmakerStatsDto,
  MyMatchmakerDto,
  OrderDto,
  PageResult,
  ProfileBriefDto,
  ProfileDto,
  UserBenefitDto,
  VipPackageDto,
} from '@yuanqiao/shared';
import { request } from './request';

export * from './request';

// ───────── 认证 ─────────

export const authApi = {
  sendSmsCode(phone: string, scene: 'login' | 'bind' | 'reset' = 'login') {
    return request.post<{ success: boolean }>('/auth/sms-code', { phone, scene });
  },
  smsLogin(phone: string, code: string, inviteMatchmakerId?: string, adminInviteCode?: string) {
    return request.post<LoginResult>('/auth/login/sms', { phone, code, inviteMatchmakerId, adminInviteCode });
  },
  wxMiniLogin(code: string, extra?: { nickname?: string; avatar?: string }) {
    return request.post<LoginResult>('/auth/login/wx-mini', { code, ...extra });
  },
  me() {
    return request.get<CurrentUser>('/auth/me');
  },
  logout() {
    return request.post<unknown>('/auth/logout', undefined, { silent: true });
  },
};

// ───────── 档案 ─────────

export interface SquareQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  gender?: string;
  cityCode?: string;
  ageMin?: number;
  ageMax?: number;
}

export const profileApi = {
  me() {
    return request.get<ProfileDto | null>('/profiles/me');
  },
  upsertMe(body: Record<string, unknown>) {
    return request.put<ProfileDto>('/profiles/me', body);
  },

  /** 只保存择偶要求。走 upsertMe 会因为性别/生日/城市必填而被拦 */
  upsertPreference(body: Record<string, unknown>) {
    return request.put<ProfileDto>('/profiles/me/preference', body);
  },
  submit() {
    return request.post<ProfileDto>('/profiles/me/submit');
  },
  claim(serialNo: string) {
    return request.post<ProfileDto>('/profiles/me/claim', { serialNo });
  },
  myAuditLogs() {
    return request.get<AuditLogDto[]>('/profiles/me/audit-logs');
  },
  visitors() {
    return request.get<{ profile: ProfileBriefDto; viewedAt: string }[]>('/profiles/me/visitors', undefined, {
      silent: true,
    });
  },
  square(query: SquareQuery) {
    return request.get<PageResult<ProfileBriefDto>>('/profiles/square', query as Record<string, unknown>);
  },
  detail(id: string) {
    return request.get<ProfileDto>(`/profiles/${id}`, undefined, { silent: true });
  },
  unlockContact(id: string) {
    return request.post<ProfileDto>(`/profiles/${id}/unlock-contact`, undefined, { silent: true });
  },
  uploadPhoto(filePath: string, primary = false) {
    return request.upload<{ id: string; url: string }>('/profiles/me/photos', filePath, {
      primary: String(primary),
    });
  },
  deletePhoto(photoId: string) {
    return request.delete<unknown>(`/profiles/photos/${photoId}`);
  },
  setPrimaryPhoto(photoId: string) {
    return request.put<unknown>(`/profiles/photos/${photoId}/primary`);
  },
};

// ───────── 字段字典 ─────────

export const fieldApi = {
  schema() {
    return request.get<FormSchemaDto>('/fields/schema');
  },
  preferenceSchema() {
    return request.get<FormSchemaDto>('/fields/schema/preference');
  },
};

// ───────── 匹配 ─────────

export const matchApi = {
  run(query: { profileId: string; page?: number; pageSize?: number; enableAi?: boolean; cityCode?: string; minScore?: number }) {
    return request.get<PageResult<MatchResultDto>>('/match', query as Record<string, unknown>, { silent: true });
  },
  scorePair(aProfileId: string, bProfileId: string) {
    return request.post<MatchResultDto>('/match/score-pair', { aProfileId, bProfileId });
  },
};

// ───────── 牵线 ─────────

export const introApi = {
  list(query: { page?: number; pageSize?: number; status?: string; profileId?: string }) {
    return request.get<PageResult<IntroductionDto>>('/introductions', query as Record<string, unknown>);
  },
  detail(id: string) {
    return request.get<IntroductionDto>(`/introductions/${id}`);
  },
  /** 当事人表态。红娘不能代点，后端会校验身份 */
  agree(id: string, agree: boolean, note?: string) {
    return request.put<IntroductionDto>(`/introductions/${id}/agree`, { agree, note });
  },
  create(aProfileId: string, bProfileId: string, remark?: string) {
    return request.post<IntroductionDto>('/introductions', { aProfileId, bProfileId, remark });
  },
  advance(id: string, targetStatus: string, note?: string) {
    return request.put<IntroductionDto>(`/introductions/${id}/advance`, { targetStatus, note });
  },
};

// ───────── VIP / 订单 ─────────

export const vipApi = {
  packages() {
    return request.get<VipPackageDto[]>('/vip/packages');
  },
  myBenefits() {
    return request.get<UserBenefitDto[]>('/vip/benefits');
  },
};

export const orderApi = {
  create(packageId: string, payChannel?: string, openid?: string) {
    return request.post<CreateOrderResult>('/orders', { packageId, payChannel, openid });
  },
  mine(query: { page?: number; pageSize?: number; status?: string }) {
    return request.get<PageResult<OrderDto>>('/orders/mine', query as Record<string, unknown>);
  },
  detail(id: string) {
    return request.get<OrderDto>(`/orders/${id}`);
  },
  /** 仅 mock 通道：本地跑通支付链路用 */
  mockConfirm(outTradeNo: string) {
    return request.post<unknown>('/pay/mock/confirm', { outTradeNo, success: true });
  },
};

// ───────── 红娘 ─────────

export const matchmakerApi = {
  /** 我的专属红娘。客户视角，不含分润等内部数据 */
  myMatchmaker() {
    return request.get<MyMatchmakerDto | null>('/matchmakers/me/my-matchmaker');
  },

  apply(body: { name: string; phone: string; cityCode?: string; cityName?: string; bio?: string }) {
    return request.post<MatchmakerDto>('/matchmakers/apply', body);
  },
  me() {
    return request.get<MatchmakerDto | null>('/matchmakers/me', undefined, { silent: true });
  },
  myStats() {
    return request.get<MatchmakerStatsDto>('/matchmakers/me/stats');
  },
  myMembers(query: { page?: number; pageSize?: number }) {
    return request.get<PageResult<ProfileBriefDto>>('/matchmakers/me/members', query as Record<string, unknown>);
  },
  myCommissions(query: { page?: number; pageSize?: number; status?: string }) {
    return request.get<PageResult<CommissionDto>>('/commissions/me', query as Record<string, unknown>);
  },
  withdraw(body: { amount: number; method?: string; account?: string; realName?: string }) {
    return request.post<unknown>('/commissions/withdrawals', body);
  },
  myWithdrawals(query: { page?: number; pageSize?: number }) {
    return request.get<PageResult<Record<string, unknown>>>('/commissions/withdrawals', query as Record<string, unknown>);
  },
};

// ───────── 系统 ─────────

export const systemApi = {
  regionTree() {
    return request.get<{ code: string; name: string; children?: unknown[] }[]>('/system/regions/tree');
  },
};
