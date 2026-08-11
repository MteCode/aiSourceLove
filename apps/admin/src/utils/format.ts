import dayjs from 'dayjs';
import { isMaskedValue } from '@yuanqiao/shared';

/** 分 → 元，保留两位。后端所有金额都是「分」，展示前必须过这个函数。 */
export function fen2yuan(fen: number | null | undefined): string {
  if (fen == null) return '-';
  return (fen / 100).toFixed(2);
}

/** 元 → 分，提交前用。用 Math.round 规避浮点误差（19.99 * 100 = 1998.9999…） */
export function yuan2fen(yuan: number | string | null | undefined): number {
  if (yuan === '' || yuan == null) return 0;
  return Math.round(Number(yuan) * 100);
}

export function formatDate(v: string | Date | null | undefined, fmt = 'YYYY-MM-DD HH:mm'): string {
  if (!v) return '-';
  return dayjs(v).format(fmt);
}

export function formatDay(v: string | Date | null | undefined): string {
  return formatDate(v, 'YYYY-MM-DD');
}

/** 年收入按「万」展示，列表里更好读 */
export function formatIncome(yuan: number | null | undefined): string {
  if (yuan == null) return '-';
  if (yuan >= 10000) return `${(yuan / 10000).toFixed(yuan % 10000 === 0 ? 0 : 1)} 万`;
  return `${yuan} 元`;
}

export function percent(v: number | null | undefined, digits = 1): string {
  if (v == null) return '-';
  return `${(v * 100).toFixed(digits)}%`;
}

/**
 * 脱敏字段的展示值。
 * 后端把没权限的字段替换成 MaskedValue（{ locked, requiredLevel, hint, preview }），
 * 直接 String() 会渲染成 [object Object]，所有展示都必须过这里。
 */
export function plain(v: unknown, fallback = '-'): string {
  if (v == null || v === '') return fallback;
  if (isMaskedValue(v)) return v.preview || v.hint || '******';
  return String(v);
}

export { isMaskedValue };
