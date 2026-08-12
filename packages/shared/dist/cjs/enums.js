"use strict";
/**
 * 缘桥 领域枚举
 *
 * 这里的字符串值必须与 apps/server/prisma/schema.prisma 里的 enum 逐字一致，
 * 前后端、DB 三处共用同一套词汇表。改这里就要同步改 schema。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReconcileResult = exports.PayChannel = exports.PaymentStatus = exports.OrderStatus = exports.ResetCycle = exports.BenefitCode = exports.PhotoMaskMode = exports.UnlockSource = exports.VisibilityLevel = exports.WithdrawalStatus = exports.CommissionStatus = exports.CommissionSource = exports.MatchmakerStatus = exports.IntroSide = exports.IntroductionStatus = exports.ProfileSource = exports.AuditStatus = exports.ProfileStatus = exports.FieldType = exports.CarStatus = exports.HouseStatus = exports.EDUCATION_RANK = exports.Education = exports.ChildrenStatus = exports.MaritalStatus = exports.Gender = exports.UserStatus = exports.RoleCode = void 0;
// ============ 账号与角色 ============
/** 角色。RBAC 里角色只是权限的集合，这里列的是内置角色的 code */
exports.RoleCode = {
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
};
exports.UserStatus = {
    ACTIVE: 'ACTIVE',
    /** 封禁 */
    BANNED: 'BANNED',
    /** 注销 */
    DEACTIVATED: 'DEACTIVATED',
};
// ============ 会员基础属性 ============
exports.Gender = {
    MALE: 'MALE',
    FEMALE: 'FEMALE',
};
/** 婚史 */
exports.MaritalStatus = {
    /** 未婚 */
    SINGLE: 'SINGLE',
    /** 离异 */
    DIVORCED: 'DIVORCED',
    /** 丧偶 */
    WIDOWED: 'WIDOWED',
};
/** 子女情况 */
exports.ChildrenStatus = {
    /** 无子女 */
    NONE: 'NONE',
    /** 有，随自己 */
    WITH_SELF: 'WITH_SELF',
    /** 有，不随自己 */
    WITH_OTHER: 'WITH_OTHER',
};
/**
 * 学历。顺序有意义（EDUCATION_RANK 用它算学历差），
 * 新增层级要同步改 EDUCATION_RANK。
 */
exports.Education = {
    /** 小学 */
    PRIMARY_SCHOOL: 'PRIMARY_SCHOOL',
    /** 初中 */
    JUNIOR_HIGH: 'JUNIOR_HIGH',
    /** 高中（含中专、职高） */
    HIGH_SCHOOL: 'HIGH_SCHOOL',
    /** 专科 */
    JUNIOR_COLLEGE: 'JUNIOR_COLLEGE',
    /** 本科 */
    BACHELOR: 'BACHELOR',
    /** 硕士 */
    MASTER: 'MASTER',
    /** 博士 */
    DOCTOR: 'DOCTOR',
};
exports.EDUCATION_RANK = {
    [exports.Education.PRIMARY_SCHOOL]: 1,
    [exports.Education.JUNIOR_HIGH]: 2,
    [exports.Education.HIGH_SCHOOL]: 3,
    [exports.Education.JUNIOR_COLLEGE]: 4,
    [exports.Education.BACHELOR]: 5,
    [exports.Education.MASTER]: 6,
    [exports.Education.DOCTOR]: 7,
};
/** 房产 */
exports.HouseStatus = {
    NONE: 'NONE',
    /** 按揭 */
    MORTGAGE: 'MORTGAGE',
    /** 全款 */
    FULL_PAID: 'FULL_PAID',
};
/** 车产 */
exports.CarStatus = {
    NONE: 'NONE',
    MORTGAGE: 'MORTGAGE',
    FULL_PAID: 'FULL_PAID',
};
// ============ 模块1：录入与审核 ============
/** 动态表单字段类型 */
exports.FieldType = {
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
};
/**
 * 档案审核状态机。
 * 合法流转见 PROFILE_STATUS_TRANSITIONS，服务端每次流转都会校验。
 */
exports.ProfileStatus = {
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
};
/** 照片单独走一套审核，避免一张图拖住整份资料 */
exports.AuditStatus = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
};
/** 资料来源：区分线上自填和线下地推代录，运营要看这个转化 */
exports.ProfileSource = {
    /** 用户自填 */
    SELF: 'SELF',
    /** 红娘代录（线下地推资料） */
    MATCHMAKER: 'MATCHMAKER',
    /** 后台批量导入 */
    IMPORT: 'IMPORT',
};
// ============ 模块3：红娘与牵线 ============
/**
 * 牵线状态流：发起 → 推荐 → 单方同意 → 双方同意 → 交换联系方式 → 线下见面 → 结果反馈
 * 任一步都可以 CANCELLED / FAILED 收口。
 */
exports.IntroductionStatus = {
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
};
/** 牵线里的一方 */
exports.IntroSide = {
    A: 'A',
    B: 'B',
};
exports.MatchmakerStatus = {
    /** 待审核入驻 */
    PENDING: 'PENDING',
    ACTIVE: 'ACTIVE',
    /** 停用 */
    SUSPENDED: 'SUSPENDED',
};
/** 分润来源 */
exports.CommissionSource = {
    /** 名下会员购买 VIP */
    ORDER: 'ORDER',
    /** 牵线成功 */
    INTRO_SUCCESS: 'INTRO_SUCCESS',
    /** 手工调账 */
    MANUAL: 'MANUAL',
};
exports.CommissionStatus = {
    /** 待结算（有冷静期，防退款） */
    PENDING: 'PENDING',
    /** 可提现 */
    SETTLED: 'SETTLED',
    /** 已提现 */
    WITHDRAWN: 'WITHDRAWN',
    /** 已冲销（订单退款了） */
    CANCELLED: 'CANCELLED',
};
exports.WithdrawalStatus = {
    /** 待审核 */
    PENDING: 'PENDING',
    /** 审核通过，待打款 */
    APPROVED: 'APPROVED',
    /** 已打款 */
    PAID: 'PAID',
    REJECTED: 'REJECTED',
};
// ============ 模块4：隐私分级 ============
/**
 * 可见等级。数值越大越私密，观看者的"权限等级"≥ 字段等级才看得见。
 * 这是整个婚恋产品的命门：分级设计好了 VIP 才有人买。
 */
exports.VisibilityLevel = {
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
};
/** 解锁来源 */
exports.UnlockSource = {
    /** 消耗 VIP 权益次数解锁 */
    BENEFIT: 'BENEFIT',
    /** 牵线成功自动解锁 */
    INTRODUCTION: 'INTRODUCTION',
    /** 后台手工赠送 */
    ADMIN: 'ADMIN',
};
/** 照片脱敏方式 */
exports.PhotoMaskMode = {
    /** 不打码 */
    NONE: 'NONE',
    /** 整图高斯模糊 */
    BLUR: 'BLUR',
};
// ============ 模块5：VIP 与支付 ============
/**
 * 权益 code。全部按"次数/天数"设计，不做无限——
 * 无限权益卖一次就没有复购，且没法做成本控制。
 */
exports.BenefitCode = {
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
};
/** 权益重置周期 */
exports.ResetCycle = {
    /** 不重置，用完为止 */
    NONE: 'NONE',
    DAILY: 'DAILY',
    MONTHLY: 'MONTHLY',
};
exports.OrderStatus = {
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
};
exports.PaymentStatus = {
    PENDING: 'PENDING',
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
    REFUNDED: 'REFUNDED',
};
exports.PayChannel = {
    /** 本地模拟支付，用于开发和演示 */
    MOCK: 'MOCK',
    /** 微信支付（小程序 JSAPI / H5） */
    WECHAT: 'WECHAT',
    ALIPAY: 'ALIPAY',
};
/** 对账结果 */
exports.ReconcileResult = {
    /** 平账 */
    MATCHED: 'MATCHED',
    /** 我方无单，渠道有支付 —— 最危险，会资损 */
    MISSING_LOCAL: 'MISSING_LOCAL',
    /** 我方已付，渠道无记录 */
    MISSING_REMOTE: 'MISSING_REMOTE',
    /** 金额不一致 */
    AMOUNT_MISMATCH: 'AMOUNT_MISMATCH',
};
//# sourceMappingURL=enums.js.map