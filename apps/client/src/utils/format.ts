import { isMaskedValue } from '@yuanqiao/shared';

/** 分 → 元。后端金额一律是分，展示前必须过这里 */
export function fen2yuan(fen: number | null | undefined): string {
  if (fen == null) return '0.00';
  return (fen / 100).toFixed(2);
}

export function formatDate(v: string | null | undefined, withTime = false): string {
  if (!v) return '-';
  const d = new Date(v.replace(/-/g, '/'));
  if (Number.isNaN(d.getTime())) return '-';
  const p = (n: number) => String(n).padStart(2, '0');
  const day = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return withTime ? `${day} ${p(d.getHours())}:${p(d.getMinutes())}` : day;
}

/** 列表里的时间用相对描述更自然：刚刚 / 3 小时前 / 昨天 */
export function fromNow(v: string | null | undefined): string {
  if (!v) return '';
  const t = new Date(v.replace(/-/g, '/')).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  if (day === 1) return '昨天';
  if (day < 30) return `${day} 天前`;
  return formatDate(v);
}

export function formatIncome(yuan: number | null | undefined): string {
  if (yuan == null) return '未填写';
  if (yuan >= 10000) return `年收入 ${(yuan / 10000).toFixed(yuan % 10000 === 0 ? 0 : 1)} 万`;
  return `年收入 ${yuan} 元`;
}

/**
 * 脱敏字段的展示值。
 * 没权限的字段后端下发的是 MaskedValue，直接渲染会变成 [object Object]。
 */
export function plain(v: unknown, fallback = '未填写'): string {
  if (v == null || v === '') return fallback;
  if (isMaskedValue(v)) return v.preview || v.hint || '******';
  return String(v);
}

export { isMaskedValue };
