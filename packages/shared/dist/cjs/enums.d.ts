/**
 * 缘桥 领域枚举
 *
 * 这里的字符串值必须与 apps/server/prisma/schema.prisma 里的 enum 逐字一致，
 * 前后端、DB 三处共用同一套词汇表。改这里就要同步改 schema。
 */
/** 角色。RBAC 里角色只是权限的集合，这里列的是内置角色的 code */
export declare const RoleCode: {
    /** 超管：所有权限，不可删 */
    readonly SUPER_ADMIN: "SUPER_ADMIN";
    /** 管理员：除系统设置外的所有业务权限 */
    readonly ADMIN: "ADMIN";
    /** 审核员：只能审资料和照片 */
    readonly AUDITOR: "AUDITOR";
    /** 红娘 */
    readonly MATCHMAKER: "MATCHMAKER";
    /** 普通会员 */
    readonly MEMBER: "MEMBER";
};
export type RoleCode = (typeof RoleCode)[keyof typeof RoleCode];
export declare const UserStatus: {
    readonly ACTIVE: "ACTIVE";
    /** 封禁 */
    readonly BANNED: "BANNED";
    /** 注销 */
    readonly DEACTIVATED: "DEACTIVATED";
};
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];
export declare const Gender: {
    readonly MALE: "MALE";
    readonly FEMALE: "FEMALE";
};
export type Gender = (typeof Gender)[keyof typeof Gender];
/** 婚史 */
export declare const MaritalStatus: {
    /** 未婚 */
    readonly SINGLE: "SINGLE";
    /** 离异 */
    readonly DIVORCED: "DIVORCED";
    /** 丧偶 */
    readonly WIDOWED: "WIDOWED";
};
export type MaritalStatus = (typeof MaritalStatus)[keyof typeof MaritalStatus];
/** 子女情况 */
export declare const ChildrenStatus: {
    /** 无子女 */
    readonly NONE: "NONE";
    /** 有，随自己 */
    readonly WITH_SELF: "WITH_SELF";
    /** 有，不随自己 */
    readonly WITH_OTHER: "WITH_OTHER";
};
export type ChildrenStatus = (typeof ChildrenStatus)[keyof typeof ChildrenStatus];
/**
 * 学历。顺序有意义（EDUCATION_RANK 用它算学历差），
 * 新增层级要同步改 EDUCATION_RANK。
 */
export declare const Education: {
    /** 小学 */
    readonly PRIMARY_SCHOOL: "PRIMARY_SCHOOL";
    /** 初中 */
    readonly JUNIOR_HIGH: "JUNIOR_HIGH";
    /** 高中（含中专、职高） */
    readonly HIGH_SCHOOL: "HIGH_SCHOOL";
    /** 专科 */
    readonly JUNIOR_COLLEGE: "JUNIOR_COLLEGE";
    /** 本科 */
    readonly BACHELOR: "BACHELOR";
    /** 硕士 */
    readonly MASTER: "MASTER";
    /** 博士 */
    readonly DOCTOR: "DOCTOR";
};
export type Education = (typeof Education)[keyof typeof Education];
export declare const EDUCATION_RANK: Record<Education, number>;
/** 房产 */
export declare const HouseStatus: {
    readonly NONE: "NONE";
    /** 按揭 */
    readonly MORTGAGE: "MORTGAGE";
    /** 全款 */
    readonly FULL_PAID: "FULL_PAID";
};
export type HouseStatus = (typeof HouseStatus)[keyof typeof HouseStatus];
/** 车产 */
export declare const CarStatus: {
    readonly NONE: "NONE";
    readonly MORTGAGE: "MORTGAGE";
    readonly FULL_PAID: "FULL_PAID";
};
export type CarStatus = (typeof CarStatus)[keyof typeof CarStatus];
/** 动态表单字段类型 */
export declare const FieldType: {
    readonly TEXT: "TEXT";
    readonly TEXTAREA: "TEXTAREA";
    readonly NUMBER: "NUMBER";
    readonly SELECT: "SELECT";
    readonly MULTI_SELECT: "MULTI_SELECT";
    readonly DATE: "DATE";
    /** 省市区级联 */
    readonly REGION: "REGION";
    readonly BOOLEAN: "BOOLEAN";
    readonly IMAGE: "IMAGE";
    readonly IMAGES: "IMAGES";
    /** 数值区间，如期望年龄 25-32 */
    readonly RANGE: "RANGE";
};
export type FieldType = (typeof FieldType)[keyof typeof FieldType];
/**
 * 档案审核状态机。
 * 合法流转见 PROFILE_STATUS_TRANSITIONS，服务端每次流转都会校验。
 */
export declare const ProfileStatus: {
    /** 草稿：还没提交，只有本人和代录红娘看得到 */
    readonly DRAFT: "DRAFT";
    /** 待审 */
    readonly PENDING: "PENDING";
    /** 通过：可被检索、被推荐 */
    readonly APPROVED: "APPROVED";
    /** 驳回：带驳回理由，可改后重提 */
    readonly REJECTED: "REJECTED";
    /** 下架：已脱单/违规/主动隐身，不参与推荐 */
    readonly OFFLINE: "OFFLINE";
};
export type ProfileStatus = (typeof ProfileStatus)[keyof typeof ProfileStatus];
/** 照片单独走一套审核，避免一张图拖住整份资料 */
export declare const AuditStatus: {
    readonly PENDING: "PENDING";
    readonly APPROVED: "APPROVED";
    readonly REJECTED: "REJECTED";
};
export type AuditStatus = (typeof AuditStatus)[keyof typeof AuditStatus];
/** 资料来源：区分线上自填和线下地推代录，运营要看这个转化 */
export declare const ProfileSource: {
    /** 用户自填 */
    readonly SELF: "SELF";
    /** 红娘代录（线下地推资料） */
    readonly MATCHMAKER: "MATCHMAKER";
    /** 后台批量导入 */
    readonly IMPORT: "IMPORT";
};
export type ProfileSource = (typeof ProfileSource)[keyof typeof ProfileSource];
/**
 * 牵线状态流：发起 → 推荐 → 单方同意 → 双方同意 → 交换联系方式 → 线下见面 → 结果反馈
 * 任一步都可以 CANCELLED / FAILED 收口。
 */
export declare const IntroductionStatus: {
    /** 红娘发起，还没推给任何一方 */
    readonly INITIATED: "INITIATED";
    /** 已推荐给双方，等待意向 */
    readonly RECOMMENDED: "RECOMMENDED";
    /** 一方同意，等另一方 */
    readonly PARTIALLY_AGREED: "PARTIALLY_AGREED";
    /** 双方都同意 */
    readonly BOTH_AGREED: "BOTH_AGREED";
    /** 已交换联系方式（此刻触发隐私解锁） */
    readonly CONTACT_EXCHANGED: "CONTACT_EXCHANGED";
    /** 已线下见面 */
    readonly MET: "MET";
    /** 成了（触发红娘成单分润） */
    readonly SUCCESS: "SUCCESS";
    /** 没成 */
    readonly FAILED: "FAILED";
    /** 作废 */
    readonly CANCELLED: "CANCELLED";
};
export type IntroductionStatus = (typeof IntroductionStatus)[keyof typeof IntroductionStatus];
/** 牵线里的一方 */
export declare const IntroSide: {
    readonly A: "A";
    readonly B: "B";
};
export type IntroSide = (typeof IntroSide)[keyof typeof IntroSide];
export declare const MatchmakerStatus: {
    /** 待审核入驻 */
    readonly PENDING: "PENDING";
    readonly ACTIVE: "ACTIVE";
    /** 停用 */
    readonly SUSPENDED: "SUSPENDED";
};
export type MatchmakerStatus = (typeof MatchmakerStatus)[keyof typeof MatchmakerStatus];
/** 分润来源 */
export declare const CommissionSource: {
    /** 名下会员购买 VIP */
    readonly ORDER: "ORDER";
    /** 牵线成功 */
    readonly INTRO_SUCCESS: "INTRO_SUCCESS";
    /** 手工调账 */
    readonly MANUAL: "MANUAL";
};
export type CommissionSource = (typeof CommissionSource)[keyof typeof CommissionSource];
export declare const CommissionStatus: {
    /** 待结算（有冷静期，防退款） */
    readonly PENDING: "PENDING";
    /** 可提现 */
    readonly SETTLED: "SETTLED";
    /** 已提现 */
    readonly WITHDRAWN: "WITHDRAWN";
    /** 已冲销（订单退款了） */
    readonly CANCELLED: "CANCELLED";
};
export type CommissionStatus = (typeof CommissionStatus)[keyof typeof CommissionStatus];
export declare const WithdrawalStatus: {
    /** 待审核 */
    readonly PENDING: "PENDING";
    /** 审核通过，待打款 */
    readonly APPROVED: "APPROVED";
    /** 已打款 */
    readonly PAID: "PAID";
    readonly REJECTED: "REJECTED";
};
export type WithdrawalStatus = (typeof WithdrawalStatus)[keyof typeof WithdrawalStatus];
/**
 * 可见等级。数值越大越私密，观看者的"权限等级"≥ 字段等级才看得见。
 * 这是整个婚恋产品的命门：分级设计好了 VIP 才有人买。
 */
export declare const VisibilityLevel: {
    /** 任何人，含未登录（用于 SEO 展示页） */
    readonly PUBLIC: 0;
    /** 登录会员 */
    readonly MEMBER: 1;
    /** VIP 会员 */
    readonly VIP: 2;
    /** 已解锁：付费解锁该人 或 与该人牵线成功 */
    readonly UNLOCKED: 3;
    /** 仅红娘与管理员 */
    readonly MATCHMAKER: 4;
    /** 仅管理员 */
    readonly ADMIN: 5;
};
export type VisibilityLevel = (typeof VisibilityLevel)[keyof typeof VisibilityLevel];
/** 解锁来源 */
export declare const UnlockSource: {
    /** 消耗 VIP 权益次数解锁 */
    readonly BENEFIT: "BENEFIT";
    /** 牵线成功自动解锁 */
    readonly INTRODUCTION: "INTRODUCTION";
    /** 后台手工赠送 */
    readonly ADMIN: "ADMIN";
};
export type UnlockSource = (typeof UnlockSource)[keyof typeof UnlockSource];
/** 照片脱敏方式 */
export declare const PhotoMaskMode: {
    /** 不打码 */
    readonly NONE: "NONE";
    /** 整图高斯模糊 */
    readonly BLUR: "BLUR";
};
export type PhotoMaskMode = (typeof PhotoMaskMode)[keyof typeof PhotoMaskMode];
/**
 * 权益 code。全部按"次数/天数"设计，不做无限——
 * 无限权益卖一次就没有复购，且没法做成本控制。
 */
export declare const BenefitCode: {
    /** 每日可查看资料人数 */
    readonly VIEW_PROFILE: "VIEW_PROFILE";
    /** 解锁联系方式次数 */
    readonly UNLOCK_CONTACT: "UNLOCK_CONTACT";
    /** 置顶曝光天数 */
    readonly TOP_EXPOSURE: "TOP_EXPOSURE";
    /** 每日 AI 精准匹配次数 */
    readonly AI_MATCH: "AI_MATCH";
    /** 查看谁看过我 */
    readonly SEE_VISITORS: "SEE_VISITORS";
    /** 高级筛选 */
    readonly ADVANCED_FILTER: "ADVANCED_FILTER";
};
export type BenefitCode = (typeof BenefitCode)[keyof typeof BenefitCode];
/** 权益重置周期 */
export declare const ResetCycle: {
    /** 不重置，用完为止 */
    readonly NONE: "NONE";
    readonly DAILY: "DAILY";
    readonly MONTHLY: "MONTHLY";
};
export type ResetCycle = (typeof ResetCycle)[keyof typeof ResetCycle];
export declare const OrderStatus: {
    /** 待支付 */
    readonly PENDING: "PENDING";
    /** 已支付 */
    readonly PAID: "PAID";
    /** 已关闭（超时未付/用户取消） */
    readonly CLOSED: "CLOSED";
    /** 退款中 */
    readonly REFUNDING: "REFUNDING";
    /** 已退款 */
    readonly REFUNDED: "REFUNDED";
};
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
export declare const PaymentStatus: {
    readonly PENDING: "PENDING";
    readonly SUCCESS: "SUCCESS";
    readonly FAILED: "FAILED";
    readonly REFUNDED: "REFUNDED";
};
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];
export declare const PayChannel: {
    /** 本地模拟支付，用于开发和演示 */
    readonly MOCK: "MOCK";
    /** 微信支付（小程序 JSAPI / H5） */
    readonly WECHAT: "WECHAT";
    readonly ALIPAY: "ALIPAY";
};
export type PayChannel = (typeof PayChannel)[keyof typeof PayChannel];
/** 对账结果 */
export declare const ReconcileResult: {
    /** 平账 */
    readonly MATCHED: "MATCHED";
    /** 我方无单，渠道有支付 —— 最危险，会资损 */
    readonly MISSING_LOCAL: "MISSING_LOCAL";
    /** 我方已付，渠道无记录 */
    readonly MISSING_REMOTE: "MISSING_REMOTE";
    /** 金额不一致 */
    readonly AMOUNT_MISMATCH: "AMOUNT_MISMATCH";
};
export type ReconcileResult = (typeof ReconcileResult)[keyof typeof ReconcileResult];
//# sourceMappingURL=enums.d.ts.map