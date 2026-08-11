import type { CurrentUser, LoginResult } from '@yuanqiao/shared';
import { request } from './request';

export const authApi = {
  passwordLogin(username: string, password: string) {
    return request.post<LoginResult>('/auth/login/password', { username, password });
  },
  me() {
    return request.get<CurrentUser>('/auth/me');
  },
  changePassword(oldPassword: string | undefined, newPassword: string) {
    return request.post<unknown>('/auth/change-password', { oldPassword, newPassword });
  },
  logout() {
    return request.post<unknown>('/auth/logout', undefined, { silent: true });
  },
};
