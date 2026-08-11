import type { ApiResponse } from '@yuanqiao/shared';
import { tokenStore } from '@/utils/storage';
import { toast } from '@/utils/ui';

/**
 * 统一请求层（uni.request 版）。
 *
 * 与后台管理端同构：拆信封、401 单飞刷新、失败 toast。
 * 差别是小程序没有 axios，也没有 cookie，全靠 header 带 token。
 */

const BASE = import.meta.env.VITE_API_BASE || '/api';

/** 权益耗尽的错误码，页面据此弹「开通 VIP」引导而不是普通报错 */
export const BENEFIT_EXHAUSTED = 40301;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  /** 不弹错误 toast，由调用方自己处理 */
  silent?: boolean;
}

let refreshing = false;
let waiters: ((token: string | null) => void)[] = [];

/** 登出回调由 store 注入，避免请求层反向依赖 store */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn;
}

interface RawResult {
  statusCode: number;
  data: unknown;
}

function raw(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  data: unknown,
  token: string,
): Promise<RawResult> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE}${url}`,
      method,
      data: data as Record<string, unknown>,
      header: token ? { Authorization: `Bearer ${token}` } : {},
      timeout: 20000,
      success: (res) => resolve({ statusCode: res.statusCode, data: res.data }),
      fail: (err) => reject(new ApiError(err.errMsg || '网络异常，请检查网络连接', -1)),
    });
  });
}

async function doRefresh(): Promise<string | null> {
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) return null;
  try {
    const res = await raw('/auth/refresh', 'POST', { refreshToken }, '');
    const body = res.data as ApiResponse<{ accessToken: string; refreshToken: string }>;
    if (res.statusCode !== 200 || body?.code !== 0) return null;
    tokenStore.set(body.data.accessToken, body.data.refreshToken);
    return body.data.accessToken;
  } catch {
    return null;
  }
}

async function invoke<T>(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  data?: unknown,
  options?: RequestOptions,
  retried = false,
): Promise<T> {
  let res: RawResult;
  try {
    res = await raw(url, method, data, tokenStore.access);
  } catch (e) {
    const err = e instanceof ApiError ? e : new ApiError('网络异常', -1);
    if (!options?.silent) toast(err.message);
    throw err;
  }

  // ── 401：刷新后重放一次 ──
  if (res.statusCode === 401 && !retried && !url.includes('/auth/refresh')) {
    let token: string | null;
    if (refreshing) {
      // 已有刷新在途，排队等它的结果
      token = await new Promise<string | null>((resolve) => waiters.push(resolve));
    } else {
      refreshing = true;
      token = await doRefresh();
      refreshing = false;
      waiters.forEach((fn) => fn(token));
      waiters = [];
    }

    if (!token) {
      tokenStore.clear();
      onUnauthorized?.();
      throw new ApiError('登录已过期，请重新登录', 401);
    }
    return invoke<T>(url, method, data, options, true);
  }

  const body = res.data as ApiResponse<T> | undefined;
  if (!body || typeof body !== 'object' || !('code' in body)) {
    return body as unknown as T;
  }
  if (body.code !== 0) {
    const err = new ApiError(body.message || '请求失败', body.code);
    // 权益不足要让页面弹开通引导，静默交给调用方处理
    if (!options?.silent && body.code !== BENEFIT_EXHAUSTED) toast(err.message);
    throw err;
  }
  return body.data;
}

export const request = {
  get<T>(url: string, params?: Record<string, unknown>, options?: RequestOptions): Promise<T> {
    const qs = params
      ? Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join('&')
      : '';
    return invoke<T>(qs ? `${url}?${qs}` : url, 'GET', undefined, options);
  },
  post<T>(url: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return invoke<T>(url, 'POST', data, options);
  },
  put<T>(url: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return invoke<T>(url, 'PUT', data, options);
  },
  delete<T>(url: string, options?: RequestOptions): Promise<T> {
    return invoke<T>(url, 'DELETE', undefined, options);
  },
  /** 上传走 uni.uploadFile，它不吃 uni.request 那套参数 */
  upload<T>(url: string, filePath: string, formData?: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      uni.uploadFile({
        url: `${BASE}${url}`,
        filePath,
        name: 'file',
        formData,
        header: { Authorization: `Bearer ${tokenStore.access}` },
        success: (res) => {
          try {
            const body = JSON.parse(res.data) as ApiResponse<T>;
            if (body.code !== 0) {
              toast(body.message);
              reject(new ApiError(body.message, body.code));
              return;
            }
            resolve(body.data);
          } catch {
            reject(new ApiError('上传失败：返回格式异常', -1));
          }
        },
        fail: (err) => {
          toast(err.errMsg || '上传失败');
          reject(new ApiError(err.errMsg || '上传失败', -1));
        },
      });
    });
  },
};
