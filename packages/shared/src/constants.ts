/**
 * 中文标签表 + 业务常量。
 * 前后端共用，避免后台写一遍"离异"、小程序又写一遍。
 */

import {
  AuditStatus,
  BenefitCode,
  CarStatus,
  ChildrenStatus,
  CommissionStatus,
  Education,
  Gender,
  HouseStatus,
  IntroductionStatus,
  MaritalStatus,
  OrderStatus,
  ProfileSource,
  ProfileStatus,
  ResetCycle,
  RoleCode,
  VisibilityLevel,
  WithdrawalStatus,
} from './enums';

export const GENDER_LABEL: Record<Gender, string> = {
  [Gender.MALE]: '男',
  [Gender.FEMALE]: '女',
};

export const MARITAL_LABEL: Record<MaritalStatus, string> = {
  [MaritalStatus.SINGLE]: '未婚',
  [MaritalStatus.DIVORCED]: '离异',
  [MaritalStatus.WIDOWED]: '丧偶',
};

export const CHILDREN_LABEL: Record<ChildrenStatus, string> = {
  [ChildrenStatus.NONE]: '无子女',
  [ChildrenStatus.WITH_SELF]: '有子女（随自己）',
  [ChildrenStatus.WITH_OTHER]: '有子女（不随自己）',
};

export const EDUCATION_LABEL: Record<Education, string> = {
  [Education.HIGH_SCHOOL]: '高中及以下',
  [Education.JUNIOR_COLLEGE]: '大专',
  [Education.BACHELOR]: '本科',
  [Education.MASTER]: '硕士',
  [Education.DOCTOR]: '博士',
};

export const HOUSE_LABEL: Record<HouseStatus, string> = {
  [HouseStatus.NONE]: '暂无房产',
  [HouseStatus.MORTGAGE]: '按揭购房',
  [HouseStatus.FULL_PAID]: '全款购房',
};

export const CAR_LABEL: Record<CarStatus, string> = {
  [CarStatus.NONE]: '暂无车',
  [CarStatus.MORTGAGE]: '按揭购车',
  [CarStatus.FULL_PAID]: '全款购车',
};

export const PROFILE_STATUS_LABEL: Record<ProfileStatus, string> = {
  [ProfileStatus.DRAFT]: '草稿',
  [ProfileStatus.PENDING]: '待审核',
  [ProfileStatus.APPROVED]: '已通过',
  [ProfileStatus.REJECTED]: '已驳回',
  [ProfileStatus.OFFLINE]: '已下架',
};

export const AUDIT_STATUS_LABEL: Record<AuditStatus, string> = {
  [AuditStatus.PENDING]: '待审核',
  [AuditStatus.APPROVED]: '已通过',
  [AuditStatus.REJECTED]: '已驳回',
};

export const PROFILE_SOURCE_LABEL: Record<ProfileSource, string> = {
  [ProfileSource.SELF]: '用户自填',
  [ProfileSource.MATCHMAKER]: '红娘代录',
  [ProfileSource.IMPORT]: '后台导入',
};

export const INTRODUCTION_STATUS_LABEL: Record<IntroductionStatus, string> = {
  [IntroductionStatus.INITIATED]: '已发起',
  [IntroductionStatus.RECOMMENDED]: '已推荐',
  [IntroductionStatus.PARTIALLY_AGREED]: '单方同意',
  [IntroductionStatus.BOTH_AGREED]: '双方同意',
  [IntroductionStatus.CONTACT_EXCHANGED]: '已交换联系方式',
  [IntroductionStatus.MET]: '已见面',
  [IntroductionStatus.SUCCESS]: '牵线成功',
  [IntroductionStatus.FAILED]: '未成功',
  [IntroductionStatus.CANCELLED]: '已取消',
};

/** 牵线流程的主干顺序，前端画步骤条用 */
export const INTRODUCTION_FLOW_STEPS: readonly IntroductionStatus[] = [
  IntroductionStatus.INITIATED,
  IntroductionStatus.RECOMMENDED,
  IntroductionStatus.BOTH_AGREED,
  IntroductionStatus.CONTACT_EXCHANGED,
  IntroductionStatus.MET,
  IntroductionStatus.SUCCESS,
];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: '待支付',
  [OrderStatus.PAID]: '已支付',
  [OrderStatus.CLOSED]: '已关闭',
  [OrderStatus.REFUNDING]: '退款中',
  [OrderStatus.REFUNDED]: '已退款',
};

export const COMMISSION_STATUS_LABEL: Record<CommissionStatus, string> = {
  [CommissionStatus.PENDING]: '待结算',
  [CommissionStatus.SETTLED]: '可提现',
  [CommissionStatus.WITHDRAWN]: '已提现',
  [CommissionStatus.CANCELLED]: '已冲销',
};

export const WITHDRAWAL_STATUS_LABEL: Record<WithdrawalStatus, string> = {
  [WithdrawalStatus.PENDING]: '待审核',
  [WithdrawalStatus.APPROVED]: '待打款',
  [WithdrawalStatus.PAID]: '已打款',
  [WithdrawalStatus.REJECTED]: '已拒绝',
};

export const ROLE_LABEL: Record<RoleCode, string> = {
  [RoleCode.SUPER_ADMIN]: '超级管理员',
  [RoleCode.ADMIN]: '管理员',
  [RoleCode.AUDITOR]: '审核员',
  [RoleCode.MATCHMAKER]: '红娘',
  [RoleCode.MEMBER]: '普通会员',
};

export const VISIBILITY_LABEL: Record<VisibilityLevel, string> = {
  [VisibilityLevel.PUBLIC]: '公开',
  [VisibilityLevel.MEMBER]: '登录可见',
  [VisibilityLevel.VIP]: 'VIP 可见',
  [VisibilityLevel.UNLOCKED]: '解锁后可见',
  [VisibilityLevel.MATCHMAKER]: '仅红娘可见',
  [VisibilityLevel.ADMIN]: '仅管理员可见',
};

export const RESET_CYCLE_LABEL: Record<ResetCycle, string> = {
  [ResetCycle.NONE]: '不重置',
  [ResetCycle.DAILY]: '每日重置',
  [ResetCycle.MONTHLY]: '每月重置',
};

/** 权益元信息：名称、单位、默认重置周期 */
export const BENEFIT_META: Record<
  BenefitCode,
  { label: string; unit: string; defaultCycle: ResetCycle; desc: string }
> = {
  [BenefitCode.VIEW_PROFILE]: {
    label: '每日查看资料',
    unit: '人',
    defaultCycle: ResetCycle.DAILY,
    desc: '每天可以查看多少份完整资料',
  },
  [BenefitCode.UNLOCK_CONTACT]: {
    label: '解锁联系方式',
    unit: '次',
    defaultCycle: ResetCycle.NONE,
    desc: '解锁后可见对方手机号/微信，用完为止',
  },
  [BenefitCode.TOP_EXPOSURE]: {
    label: '置顶曝光',
    unit: '天',
    defaultCycle: ResetCycle.NONE,
    desc: '在推荐列表中置顶展示的天数',
  },
  [BenefitCode.AI_MATCH]: {
    label: 'AI 精准匹配',
    unit: '次',
    defaultCycle: ResetCycle.DAILY,
    desc: '每天可调用几次 AI 深度匹配（走大模型，有成本）',
  },
  [BenefitCode.SEE_VISITORS]: {
    label: '谁看过我',
    unit: '次',
    defaultCycle: ResetCycle.DAILY,
    desc: '查看访客列表',
  },
  [BenefitCode.ADVANCED_FILTER]: {
    label: '高级筛选',
    unit: '次',
    defaultCycle: ResetCycle.DAILY,
    desc: '按学历/收入/房车等条件精筛',
  },
};

// ============ 匹配引擎参数 ============

/**
 * L2 加权打分的默认权重。总和不必为 1，最终会归一化。
 * 这套值是冷启动的经验起点，运营几个月后应该按"成单率"回归调参。
 */
export const DEFAULT_MATCH_WEIGHTS = {
  /** 双向择偶条件满足度 —— 权重最高，很多系统只算单向，这是主要差距来源 */
  mutualPreference: 0.4,
  /** 年龄差 */
  ageGap: 0.12,
  /** 学历差 */
  education: 0.1,
  /** 收入 */
  income: 0.1,
  /** 地理距离 / 同城 */
  distance: 0.13,
  /** 身高搭配 */
  height: 0.05,
  /** AI 语义匹配（第二期开启，mock 时给中性分） */
  semantic: 0.1,
} as const;

export type MatchWeightKey = keyof typeof DEFAULT_MATCH_WEIGHTS;

export const MATCH_WEIGHT_LABEL: Record<MatchWeightKey, string> = {
  mutualPreference: '双向择偶条件满足度',
  ageGap: '年龄差',
  education: '学历匹配',
  income: '收入匹配',
  distance: '地理距离',
  height: '身高搭配',
  semantic: 'AI 语义匹配',
};

/** 匹配引擎的硬性上限，防止单次请求扫全表 */
export const MATCH_LIMITS = {
  /** L1 硬过滤后最多带进 L2 打分的候选数 */
  maxCandidates: 500,
  /** L2 打分后最多带进 L3 AI 层的候选数（AI 有成本，只给头部） */
  maxAiCandidates: 20,
  /** 单次返回上限 */
  maxPageSize: 50,
} as const;

// ============ 其它业务常量 ============

/** 订单未支付自动关闭时长（分钟） */
export const ORDER_AUTO_CLOSE_MINUTES = 30;

/** 分润冷静期（天）：订单支付后多久才把分润从"待结算"转"可提现"，防退款 */
export const COMMISSION_COOLDOWN_DAYS = 7;

/** 提现最低金额（分） */
export const WITHDRAWAL_MIN_AMOUNT = 10000;

/** 手机验证码有效期（秒） */
export const SMS_CODE_TTL_SECONDS = 300;

/** 同一手机号发送验证码的最小间隔（秒） */
export const SMS_CODE_INTERVAL_SECONDS = 60;
