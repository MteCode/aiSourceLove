import axios, { AxiosError, type AxiosRequestConfig, type AxiosInstance } from 'axios';
import { ElMessage } from 'element-plus';
import type { ApiResponse } from '@yuanqiao/shared';
import { tokenStore } from '@/utils/storage';

/**
 * 统一请求层。
 *
 * 约定：
 * - 后端所有接口返回 { code, message, data, traceId }，这里拆信封，业务代码直接拿 data；
 * - code !== 0 一律抛错并 toast，所以调用方只需要 try/catch 或者不管；
 * - 401 走「单飞刷新」：并发的 401 只发一次 refresh，其余排队等结果后重放。
 */

/** 权益耗尽——调用方要弹「开通 VIP」引导，所以保留错误码 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: number,
    readonly traceId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  /** 静默模式：不弹错误 toast，由调用方自己处理 */
  silent?: boolean;
}

const http: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 20000,
});

// ── 请求拦截：带 token ──
http.interceptors.request.use((config) => {
  const token = tokenStore.access;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── 刷新 token 的单飞控制 ──
let refreshing = false;
/** 刷新期间到达的 401 请求，拿到新 token 后统一重放 */
let waiters: ((token: string | null) => void)[] = [];

function notifyWaiters(token: string | null): void {
  waiters.forEach((fn) => fn(token));
  waiters = [];
}

/** 登出回调由 user store 注入，避免 request 层反向依赖 store 造成循环引用 */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn;
}

async function doRefresh(): Promise<string | null> {
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) return null;
  try {
    // 用裸 axios，避开拦截器，否则刷新失败会递归
    const { data } = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
      '/api/auth/refresh',
      { refreshToken },
    );
    if (data.code !== 0) return null;
    tokenStore.set(data.data.accessToken, data.data.refreshToken);
    return data.data.accessToken;
  } catch {
    return null;
  }
}

// ── 响应拦截：拆信封 + 401 重放 ──
http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const status = error.response?.status;
    const config = error.config as AxiosRequestConfig & { _retried?: boolean };

    // 刷新接口本身 401 就别再救了
    if (status === 401 && config && !config._retried && !config.url?.includes('/auth/refresh')) {
      config._retried = true;

      if (refreshing) {
        // 已有刷新在途，排队等它
        const token = await new Promise<string | null>((resolve) => waiters.push(resolve));
        if (!token) return Promise.reject(error);
        config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
        return http.request(config);
      }

      refreshing = true;
      const token = await doRefresh();
      refreshing = false;
      notifyWaiters(token);

      if (!token) {
        tokenStore.clear();
        onUnauthorized?.();
        return Promise.reject(error);
      }
      config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
      return http.request(config);
    }

    return Promise.reject(error);
  },
);

async function invoke<T>(config: AxiosRequestConfig, options?: RequestOptions): Promise<T> {
  try {
    const res = await http.request<ApiResponse<T>>(config);
    const body = res.data;

    // 少数接口（支付回调）不走信封，形状不对就原样返回
    if (!body || typeof body !== 'object' || !('code' in body)) {
      return body as unknown as T;
    }
    if (body.code !== 0) {
      throw new ApiError(body.message || '请求失败', body.code, body.traceId);
    }
    return body.data;
  } catch (e) {
    const err = toApiError(e);
    if (!options?.silent) ElMessage.error(err.message);
    throw err;
  }
}

function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (axios.isAxiosError(e)) {
    const body = e.response?.data as ApiResponse<unknown> | undefined;
    if (body?.message) return new ApiError(body.message, body.code ?? -1, body.traceId);
    if (e.code === 'ECONNABORTED') return new ApiError('请求超时，请重试', -1);
    if (!e.response) return new ApiError('网络异常，请检查网络连接', -1);
    return new ApiError(`请求失败（${e.response.status}）`, -1);
  }
  return new ApiError((e as Error)?.message || '未知错误', -1);
}

export const request = {
  get<T>(url: string, params?: unknown, options?: RequestOptions): Promise<T> {
    return invoke<T>({ method: 'GET', url, params }, options);
  },
  post<T>(url: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return invoke<T>({ method: 'POST', url, data }, options);
  },
  put<T>(url: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return invoke<T>({ method: 'PUT', url, data }, options);
  },
  delete<T>(url: string, params?: unknown, options?: RequestOptions): Promise<T> {
    return invoke<T>({ method: 'DELETE', url, params }, options);
  },
  upload<T>(url: string, file: File, params?: Record<string, string>): Promise<T> {
    const form = new FormData();
    form.append('file', file);
    return invoke<T>({
      method: 'POST',
      url,
      data: form,
      params,
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export default http;
