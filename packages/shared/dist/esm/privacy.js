/**
 * 隐私脱敏工具（模块4）。
 *
 * 放 shared 是因为后台也要预览脱敏效果、小程序也要显示占位文案，
 * 但注意：**真正的脱敏必须在服务端做**。这里的函数在前端只用于展示已脱敏数据的兜底，
 * 服务端绝不能把原始值下发给没权限的人再指望前端遮住。
 */
import { VisibilityLevel } from './enums';
export const ANONYMOUS_VIEWER = {
    userId: null,
    isSelf: false,
    isAdmin: false,
    isMatchmakerOf: false,
    isVip: false,
    isUnlocked: false,
};
/**
 * 算出观看者能看到的最高等级。
 *
 * 注意 UNLOCKED(3) > VIP(2)：VIP 不等于自动解锁所有人，
 * VIP 只是拿到了解锁次数，解锁仍要逐个消耗。这是让 VIP 有复购的关键。
 */
export function resolveViewerLevel(ctx) {
    if (ctx.isAdmin)
        return VisibilityLevel.ADMIN;
    if (ctx.isSelf)
        return VisibilityLevel.ADMIN; // 本人看自己等于全可见
    if (ctx.isMatchmakerOf)
        return VisibilityLevel.MATCHMAKER;
    if (ctx.isUnlocked)
        return VisibilityLevel.UNLOCKED;
    if (ctx.isVip)
        return VisibilityLevel.VIP;
    if (ctx.userId)
        return VisibilityLevel.MEMBER;
    return VisibilityLevel.PUBLIC;
}
export function canSee(viewerLevel, fieldLevel) {
    return viewerLevel >= fieldLevel;
}
/**
 * 姓名脱敏：张三 → 张*，欧阳修文 → 欧***
 * 单字名原样返回（没法脱，也没意义）。
 */
export function maskName(name) {
    if (!name)
        return '';
    const s = name.trim();
    if (s.length <= 1)
        return s;
    return s[0] + '*'.repeat(s.length - 1);
}
/** 手机号：13812348888 → 138****8888 */
export function maskPhone(phone) {
    if (!phone)
        return '';
    const s = phone.replace(/\s/g, '');
    if (s.length < 7)
        return '*'.repeat(s.length);
    return `${s.slice(0, 3)}****${s.slice(-4)}`;
}
/** 微信号 / QQ：只留首尾各 1 位 */
export function maskAccount(account) {
    if (!account)
        return '';
    const s = account.trim();
    if (s.length <= 2)
        return '*'.repeat(s.length);
    return `${s[0]}${'*'.repeat(Math.max(s.length - 2, 1))}${s[s.length - 1]}`;
}
/** 身份证：只留前3后2 */
export function maskIdCard(id) {
    if (!id)
        return '';
    const s = id.trim();
    if (s.length < 8)
        return '*'.repeat(s.length);
    return `${s.slice(0, 3)}${'*'.repeat(s.length - 5)}${s.slice(-2)}`;
}
/**
 * 工作单位这类"能被人肉出来"的字段：只保留到行业/区域粒度。
 * 例："字节跳动（北京）研发中心" → "互联网企业"这种映射交给字典，
 * 这里只做兜底：超过 4 个字就截断加省略。
 */
export function maskOrg(org) {
    if (!org)
        return '';
    const s = org.trim();
    if (s.length <= 2)
        return s;
    return `${s.slice(0, 2)}${'*'.repeat(Math.min(s.length - 2, 4))}`;
}
/** 没权限看时给前端的占位文案，让用户知道"要花钱/要牵线"才看得到 */
export const LOCKED_PLACEHOLDER = {
    [VisibilityLevel.PUBLIC]: '',
    [VisibilityLevel.MEMBER]: '登录后可见',
    [VisibilityLevel.VIP]: '开通 VIP 可见',
    [VisibilityLevel.UNLOCKED]: '解锁后可见',
    [VisibilityLevel.MATCHMAKER]: '仅红娘可见',
    [VisibilityLevel.ADMIN]: '不可见',
};
export function lockedValue(level, preview) {
    return {
        locked: true,
        requiredLevel: level,
        hint: LOCKED_PLACEHOLDER[level],
        ...(preview ? { preview } : {}),
    };
}
export function isMaskedValue(v) {
    return typeof v === 'object' && v !== null && v.locked === true;
}
//# sourceMappingURL=privacy.js.map