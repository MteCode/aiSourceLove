/**
 * 缘桥 领域枚举
 *
 * 这里的字符串值必须与 apps/server/prisma/schema.prisma 里的 enum 逐字一致，
 * 前后端、DB 三处共用同一套词汇表。改这里就要同步改 schema。
 */

// ============ 账号与角色 ============

/** 角色。RBAC 里角色只是权限的集合，这里列的是内置角色的 code */
export const RoleCode = {
  /** 超管：所有权限，不可删 */
  SUPER_ADMIN: 'SUPER_ADMIN',
  /** 管理员：除系统设置外的所有业务权限 */
  ADMIN: 'ADMIN',
  /** 审核员：只能审资料和照片 */
  AUDITOR: 'AUDITOR',
  /** 红娘 */
  MATCHMAKER: 'MATCHMAKER',
  /** 普通会员 */
  MEMBER: 'MEMBER',
} as const;
export type RoleCode = (typeof RoleCode)[keyof typeof RoleCode];

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  /** 封禁 */
  BANNED: 'BANNED',
  /** 注销 */
  DEACTIVATED: 'DEACTIVATED',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

// ============ 会员基础属性 ============

export const Gender = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
} as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

/** 婚史 */
export const MaritalStatus = {
  /** 未婚 */
  SINGLE: 'SINGLE',
  /** 离异 */
  DIVORCED: 'DIVORCED',
  /** 丧偶 */
  WIDOWED: 'WIDOWED',
} as const;
export type MaritalStatus = (typeof MaritalStatus)[keyof typeof MaritalStatus];

/** 子女情况 */
export const ChildrenStatus = {
  /** 无子女 */
  NONE: 'NONE',
  /** 有，随自己 */
  WITH_SELF: 'WITH_SELF',
  /** 有，不随自己 */
  WITH_OTHER: 'WITH_OTHER',
} as const;
export type ChildrenStatus = (typeof ChildrenStatus)[keyof typeof ChildrenStatus];

/**
 * 学历。顺序有意义（EDUCATION_RANK 用它算学历差），
 * 新增层级要同步改 EDUCATION_RANK。
 */
export const Education = {
  /** 高中及以下 */
  HIGH_SCHOOL: 'HIGH_SCHOOL',
  /** 大专 */
  JUNIOR_COLLEGE: 'JUNIOR_COLLEGE',
  /** 本科 */
  BACHELOR: 'BACHELOR',
  /** 硕士 */
  MASTER: 'MASTER',
  /** 博士 */
  DOCTOR: 'DOCTOR',
} as const;
export type Education = (typeof Education)[keyof typeof Education];

export const EDUCATION_RANK: Record<Education, number> = {
  [Education.HIGH_SCHOOL]: 1,
  [Education.JUNIOR_COLLEGE]: 2,
  [Education.BACHELOR]: 3,
  [Education.MASTER]: 4,
  [Education.DOCTOR]: 5,
};

/** 房产 */
export const HouseStatus = {
  NONE: 'NONE',
  /** 按揭 */
  MORTGAGE: 'MORTGAGE',
  /** 全款 */
  FULL_PAID: 'FULL_PAID',
} as const;
export type HouseStatus = (typeof HouseStatus)[keyof typeof HouseStatus];

/** 车产 */
export const CarStatus = {
  NONE: 'NONE',
  MORTGAGE: 'MORTGAGE',
  FULL_PAID: 'FULL_PAID',
} as const;
export type CarStatus = (typeof CarStatus)[keyof typeof CarStatus];

// ============ 模块1：录入与审核 ============

/** 动态表单字段类型 */
export const FieldType = {
  TEXT: 'TEXT',
  TEXTAREA: 'TEXTAREA',
  NUMBER: 'NUMBER',
  SELECT: 'SELECT',
  MULTI_SELECT: 'MULTI_SELECT',
  DATE: 'DATE',
  /** 省市区级联 */
  REGION: 'REGION',
  BOOLEAN: 'BOOLEAN',
  IMAGE: 'IMAGE',
  IMAGES: 'IMAGES',
  /** 数值区间，如期望年龄 25-32 */
  RANGE: 'RANGE',
} as const;
export type FieldType = (typeof FieldType)[keyof typeof FieldType];

/**
 * 档案审核状态机。
 * 合法流转见 PROFILE_STATUS_TRANSITIONS，服务端每次流转都会校验。
 */
export const ProfileStatus = {
  /** 草稿：还没提交，只有本人和代录红娘看得到 */
  DRAFT: 'DRAFT',
  /** 待审 */
  PENDING: 'PENDING',
  /** 通过：可被检索、被推荐 */
  APPROVED: 'APPROVED',
  /** 驳回：带驳回理由，可改后重提 */
  REJECTED: 'REJECTED',
  /** 下架：已脱单/违规/主动隐身，不参与推荐 */
  OFFLINE: 'OFFLINE',
} as const;
export type ProfileStatus = (typeof ProfileStatus)[keyof typeof ProfileStatus];

/** 照片单独走一套审核，避免一张图拖住整份资料 */
export const AuditStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type AuditStatus = (typeof AuditStatus)[keyof typeof AuditStatus];

/** 资料来源：区分线上自填和线下地推代录，运营要看这个转化 */
export const ProfileSource = {
  /** 用户自填 */
  SELF: 'SELF',
  /** 红娘代录（线下地推资料） */
  MATCHMAKER: 'MATCHMAKER',
  /** 后台批量导入 */
  IMPORT: 'IMPORT',
} as const;
export type ProfileSource = (typeof ProfileSource)[keyof typeof ProfileSource];

// ============ 模块3：红娘与牵线 ============

/**
 * 牵线状态流：发起 → 推荐 → 单方同意 → 双方同意 → 交换联系方式 → 线下见面 → 结果反馈
 * 任一步都可以 CANCELLED / FAILED 收口。
 */
export const IntroductionStatus = {
  /** 红娘发起，还没推给任何一方 */
  INITIATED: 'INITIATED',
  /** 已推荐给双方，等待意向 */
  RECOMMENDED: 'RECOMMENDED',
  /** 一方同意，等另一方 */
  PARTIALLY_AGREED: 'PARTIALLY_AGREED',
  /** 双方都同意 */
  BOTH_AGREED: 'BOTH_AGREED',
  /** 已交换联系方式（此刻触发隐私解锁） */
  CONTACT_EXCHANGED: 'CONTACT_EXCHANGED',
  /** 已线下见面 */
  MET: 'MET',
  /** 成了（触发红娘成单分润） */
  SUCCESS: 'SUCCESS',
  /** 没成 */
  FAILED: 'FAILED',
  /** 作废 */
  CANCELLED: 'CANCELLED',
} as const;
export type IntroductionStatus = (typeof IntroductionStatus)[keyof typeof IntroductionStatus];

/** 牵线里的一方 */
export const IntroSide = {
  A: 'A',
  B: 'B',
} as const;
export type IntroSide = (typeof IntroSide)[keyof typeof IntroSide];

export const MatchmakerStatus = {
  /** 待审核入驻 */
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  /** 停用 */
  SUSPENDED: 'SUSPENDED',
} as const;
export type MatchmakerStatus = (typeof MatchmakerStatus)[keyof typeof MatchmakerStatus];

/** 分润来源 */
export const CommissionSource = {
  /** 名下会员购买 VIP */
  ORDER: 'ORDER',
  /** 牵线成功 */
  INTRO_SUCCESS: 'INTRO_SUCCESS',
  /** 手工调账 */
  MANUAL: 'MANUAL',
} as const;
export type CommissionSource = (typeof CommissionSource)[keyof typeof CommissionSource];

export const CommissionStatus = {
  /** 待结算（有冷静期，防退款） */
  PENDING: 'PENDING',
  /** 可提现 */
  SETTLED: 'SETTLED',
  /** 已提现 */
  WITHDRAWN: 'WITHDRAWN',
  /** 已冲销（订单退款了） */
  CANCELLED: 'CANCELLED',
} as const;
export type CommissionStatus = (typeof CommissionStatus)[keyof typeof CommissionStatus];

export const WithdrawalStatus = {
  /** 待审核 */
  PENDING: 'PENDING',
  /** 审核通过，待打款 */
  APPROVED: 'APPROVED',
  /** 已打款 */
  PAID: 'PAID',
  REJECTED: 'REJECTED',
} as const;
export type WithdrawalStatus = (typeof WithdrawalStatus)[keyof typeof WithdrawalStatus];

// ============ 模块4：隐私分级 ============

/**
 * 可见等级。数值越大越私密，观看者的"权限等级"≥ 字段等级才看得见。
 * 这是整个婚恋产品的命门：分级设计好了 VIP 才有人买。
 */
export const VisibilityLevel = {
  /** 任何人，含未登录（用于 SEO 展示页） */
  PUBLIC: 0,
  /** 登录会员 */
  MEMBER: 1,
  /** VIP 会员 */
  VIP: 2,
  /** 已解锁：付费解锁该人 或 与该人牵线成功 */
  UNLOCKED: 3,
  /** 仅红娘与管理员 */
  MATCHMAKER: 4,
  /** 仅管理员 */
  ADMIN: 5,
} as const;
export type VisibilityLevel = (typeof VisibilityLevel)[keyof typeof VisibilityLevel];

/** 解锁来源 */
export const UnlockSource = {
  /** 消耗 VIP 权益次数解锁 */
  BENEFIT: 'BENEFIT',
  /** 牵线成功自动解锁 */
  INTRODUCTION: 'INTRODUCTION',
  /** 后台手工赠送 */
  ADMIN: 'ADMIN',
} as const;
export type UnlockSource = (typeof UnlockSource)[keyof typeof UnlockSource];

/** 照片脱敏方式 */
export const PhotoMaskMode = {
  /** 不打码 */
  NONE: 'NONE',
  /** 整图高斯模糊 */
  BLUR: 'BLUR',
} as const;
export type PhotoMaskMode = (typeof PhotoMaskMode)[keyof typeof PhotoMaskMode];

// ============ 模块5：VIP 与支付 ============

/**
 * 权益 code。全部按"次数/天数"设计，不做无限——
 * 无限权益卖一次就没有复购，且没法做成本控制。
 */
export const BenefitCode = {
  /** 每日可查看资料人数 */
  VIEW_PROFILE: 'VIEW_PROFILE',
  /** 解锁联系方式次数 */
  UNLOCK_CONTACT: 'UNLOCK_CONTACT',
  /** 置顶曝光天数 */
  TOP_EXPOSURE: 'TOP_EXPOSURE',
  /** 每日 AI 精准匹配次数 */
  AI_MATCH: 'AI_MATCH',
  /** 查看谁看过我 */
  SEE_VISITORS: 'SEE_VISITORS',
  /** 高级筛选 */
  ADVANCED_FILTER: 'ADVANCED_FILTER',
} as const;
export type BenefitCode = (typeof BenefitCode)[keyof typeof BenefitCode];

/** 权益重置周期 */
export const ResetCycle = {
  /** 不重置，用完为止 */
  NONE: 'NONE',
  DAILY: 'DAILY',
  MONTHLY: 'MONTHLY',
} as const;
export type ResetCycle = (typeof ResetCycle)[keyof typeof ResetCycle];

export const OrderStatus = {
  /** 待支付 */
  PENDING: 'PENDING',
  /** 已支付 */
  PAID: 'PAID',
  /** 已关闭（超时未付/用户取消） */
  CLOSED: 'CLOSED',
  /** 退款中 */
  REFUNDING: 'REFUNDING',
  /** 已退款 */
  REFUNDED: 'REFUNDED',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const PaymentStatus = {
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PayChannel = {
  /** 本地模拟支付，用于开发和演示 */
  MOCK: 'MOCK',
  /** 微信支付（小程序 JSAPI / H5） */
  WECHAT: 'WECHAT',
  ALIPAY: 'ALIPAY',
} as const;
export type PayChannel = (typeof PayChannel)[keyof typeof PayChannel];

/** 对账结果 */
export const ReconcileResult = {
  /** 平账 */
  MATCHED: 'MATCHED',
  /** 我方无单，渠道有支付 —— 最危险，会资损 */
  MISSING_LOCAL: 'MISSING_LOCAL',
  /** 我方已付，渠道无记录 */
  MISSING_REMOTE: 'MISSING_REMOTE',
  /** 金额不一致 */
  AMOUNT_MISMATCH: 'AMOUNT_MISMATCH',
} as const;
export type ReconcileResult = (typeof ReconcileResult)[keyof typeof ReconcileResult];
