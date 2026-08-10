/**
 * 隐私脱敏工具（模块4）。
 *
 * 放 shared 是因为后台也要预览脱敏效果、小程序也要显示占位文案，
 * 但注意：**真正的脱敏必须在服务端做**。这里的函数在前端只用于展示已脱敏数据的兜底，
 * 服务端绝不能把原始值下发给没权限的人再指望前端遮住。
 */
import { VisibilityLevel } from './enums';
/** 观看者相对某份档案的权限等级 */
export interface ViewerContext {
    /** 未登录为 null */
    userId: string | null;
    /** 是否本人 */
    isSelf: boolean;
    isAdmin: boolean;
    /** 是否红娘（且该档案在其名下，或其有全局红娘权限） */
    isMatchmakerOf: boolean;
    isVip: boolean;
    /** 是否已解锁该档案（付费解锁 或 牵线成功） */
    isUnlocked: boolean;
}
export declare const ANONYMOUS_VIEWER: ViewerContext;
/**
 * 算出观看者能看到的最高等级。
 *
 * 注意 UNLOCKED(3) > VIP(2)：VIP 不等于自动解锁所有人，
 * VIP 只是拿到了解锁次数，解锁仍要逐个消耗。这是让 VIP 有复购的关键。
 */
export declare function resolveViewerLevel(ctx: ViewerContext): VisibilityLevel;
export declare function canSee(viewerLevel: VisibilityLevel, fieldLevel: VisibilityLevel): boolean;
/**
 * 姓名脱敏：张三 → 张*，欧阳修文 → 欧***
 * 单字名原样返回（没法脱，也没意义）。
 */
export declare function maskName(name: string | null | undefined): string;
/** 手机号：13812348888 → 138****8888 */
export declare function maskPhone(phone: string | null | undefined): string;
/** 微信号 / QQ：只留首尾各 1 位 */
export declare function maskAccount(account: string | null | undefined): string;
/** 身份证：只留前3后2 */
export declare function maskIdCard(id: string | null | undefined): string;
/**
 * 工作单位这类"能被人肉出来"的字段：只保留到行业/区域粒度。
 * 例："字节跳动（北京）研发中心" → "互联网企业"这种映射交给字典，
 * 这里只做兜底：超过 4 个字就截断加省略。
 */
export declare function maskOrg(org: string | null | undefined): string;
/** 没权限看时给前端的占位文案，让用户知道"要花钱/要牵线"才看得到 */
export declare const LOCKED_PLACEHOLDER: Record<VisibilityLevel, string>;
/** 被隐藏字段在 API 里的统一形状，前端据此渲染"锁"图标和引导按钮 */
export interface MaskedValue {
    /** 恒为 true，前端用它判断这是个被锁的字段 */
    locked: true;
    /** 需要达到的等级 */
    requiredLevel: VisibilityLevel;
    /** 引导文案 */
    hint: string;
    /** 可选的脱敏预览，如 138****8888 */
    preview?: string;
}
export declare function lockedValue(level: VisibilityLevel, preview?: string): MaskedValue;
export declare function isMaskedValue(v: unknown): v is MaskedValue;
//# sourceMappingURL=privacy.d.ts.map