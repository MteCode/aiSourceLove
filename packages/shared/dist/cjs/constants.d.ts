/**
 * 中文标签表 + 业务常量。
 * 前后端共用，避免后台写一遍"离异"、小程序又写一遍。
 */
import { AuditStatus, BenefitCode, CarStatus, ChildrenStatus, CommissionStatus, Education, Gender, HouseStatus, IntroductionStatus, MaritalStatus, OrderStatus, ProfileSource, ProfileStatus, ResetCycle, RoleCode, VisibilityLevel, WithdrawalStatus } from './enums';
export declare const GENDER_LABEL: Record<Gender, string>;
export declare const MARITAL_LABEL: Record<MaritalStatus, string>;
export declare const CHILDREN_LABEL: Record<ChildrenStatus, string>;
export declare const EDUCATION_LABEL: Record<Education, string>;
export declare const HOUSE_LABEL: Record<HouseStatus, string>;
export declare const CAR_LABEL: Record<CarStatus, string>;
export declare const PROFILE_STATUS_LABEL: Record<ProfileStatus, string>;
export declare const AUDIT_STATUS_LABEL: Record<AuditStatus, string>;
export declare const PROFILE_SOURCE_LABEL: Record<ProfileSource, string>;
export declare const INTRODUCTION_STATUS_LABEL: Record<IntroductionStatus, string>;
/** 牵线流程的主干顺序，前端画步骤条用 */
export declare const INTRODUCTION_FLOW_STEPS: readonly IntroductionStatus[];
export declare const ORDER_STATUS_LABEL: Record<OrderStatus, string>;
export declare const COMMISSION_STATUS_LABEL: Record<CommissionStatus, string>;
export declare const WITHDRAWAL_STATUS_LABEL: Record<WithdrawalStatus, string>;
export declare const ROLE_LABEL: Record<RoleCode, string>;
export declare const VISIBILITY_LABEL: Record<VisibilityLevel, string>;
export declare const RESET_CYCLE_LABEL: Record<ResetCycle, string>;
/** 权益元信息：名称、单位、默认重置周期 */
export declare const BENEFIT_META: Record<BenefitCode, {
    label: string;
    unit: string;
    defaultCycle: ResetCycle;
    desc: string;
}>;
/**
 * L2 加权打分的默认权重。总和不必为 1，最终会归一化。
 * 这套值是冷启动的经验起点，运营几个月后应该按"成单率"回归调参。
 */
export declare const DEFAULT_MATCH_WEIGHTS: {
    /** 双向择偶条件满足度 —— 权重最高，很多系统只算单向，这是主要差距来源 */
    readonly mutualPreference: 0.4;
    /** 年龄差 */
    readonly ageGap: 0.12;
    /** 学历差 */
    readonly education: 0.1;
    /** 收入 */
    readonly income: 0.1;
    /** 地理距离 / 同城 */
    readonly distance: 0.13;
    /** 身高搭配 */
    readonly height: 0.05;
    /** AI 语义匹配（第二期开启，mock 时给中性分） */
    readonly semantic: 0.1;
};
export type MatchWeightKey = keyof typeof DEFAULT_MATCH_WEIGHTS;
export declare const MATCH_WEIGHT_LABEL: Record<MatchWeightKey, string>;
/** 匹配引擎的硬性上限，防止单次请求扫全表 */
export declare const MATCH_LIMITS: {
    /** L1 硬过滤后最多带进 L2 打分的候选数 */
    readonly maxCandidates: 500;
    /** L2 打分后最多带进 L3 AI 层的候选数（AI 有成本，只给头部） */
    readonly maxAiCandidates: 20;
    /** 单次返回上限 */
    readonly maxPageSize: 50;
};
/** 订单未支付自动关闭时长（分钟） */
export declare const ORDER_AUTO_CLOSE_MINUTES = 30;
/** 分润冷静期（天）：订单支付后多久才把分润从"待结算"转"可提现"，防退款 */
export declare const COMMISSION_COOLDOWN_DAYS = 7;
/** 提现最低金额（分） */
export declare const WITHDRAWAL_MIN_AMOUNT = 10000;
/** 手机验证码有效期（秒） */
export declare const SMS_CODE_TTL_SECONDS = 300;
/** 同一手机号发送验证码的最小间隔（秒） */
export declare const SMS_CODE_INTERVAL_SECONDS = 60;
//# sourceMappingURL=constants.d.ts.map