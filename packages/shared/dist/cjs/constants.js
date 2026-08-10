"use strict";
/**
 * 中文标签表 + 业务常量。
 * 前后端共用，避免后台写一遍"离异"、小程序又写一遍。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SMS_CODE_INTERVAL_SECONDS = exports.SMS_CODE_TTL_SECONDS = exports.WITHDRAWAL_MIN_AMOUNT = exports.COMMISSION_COOLDOWN_DAYS = exports.ORDER_AUTO_CLOSE_MINUTES = exports.MATCH_LIMITS = exports.MATCH_WEIGHT_LABEL = exports.DEFAULT_MATCH_WEIGHTS = exports.BENEFIT_META = exports.RESET_CYCLE_LABEL = exports.VISIBILITY_LABEL = exports.ROLE_LABEL = exports.WITHDRAWAL_STATUS_LABEL = exports.COMMISSION_STATUS_LABEL = exports.ORDER_STATUS_LABEL = exports.INTRODUCTION_FLOW_STEPS = exports.INTRODUCTION_STATUS_LABEL = exports.PROFILE_SOURCE_LABEL = exports.AUDIT_STATUS_LABEL = exports.PROFILE_STATUS_LABEL = exports.CAR_LABEL = exports.HOUSE_LABEL = exports.EDUCATION_LABEL = exports.CHILDREN_LABEL = exports.MARITAL_LABEL = exports.GENDER_LABEL = void 0;
const enums_1 = require("./enums");
exports.GENDER_LABEL = {
    [enums_1.Gender.MALE]: '男',
    [enums_1.Gender.FEMALE]: '女',
};
exports.MARITAL_LABEL = {
    [enums_1.MaritalStatus.SINGLE]: '未婚',
    [enums_1.MaritalStatus.DIVORCED]: '离异',
    [enums_1.MaritalStatus.WIDOWED]: '丧偶',
};
exports.CHILDREN_LABEL = {
    [enums_1.ChildrenStatus.NONE]: '无子女',
    [enums_1.ChildrenStatus.WITH_SELF]: '有子女（随自己）',
    [enums_1.ChildrenStatus.WITH_OTHER]: '有子女（不随自己）',
};
exports.EDUCATION_LABEL = {
    [enums_1.Education.HIGH_SCHOOL]: '高中及以下',
    [enums_1.Education.JUNIOR_COLLEGE]: '大专',
    [enums_1.Education.BACHELOR]: '本科',
    [enums_1.Education.MASTER]: '硕士',
    [enums_1.Education.DOCTOR]: '博士',
};
exports.HOUSE_LABEL = {
    [enums_1.HouseStatus.NONE]: '暂无房产',
    [enums_1.HouseStatus.MORTGAGE]: '按揭购房',
    [enums_1.HouseStatus.FULL_PAID]: '全款购房',
};
exports.CAR_LABEL = {
    [enums_1.CarStatus.NONE]: '暂无车',
    [enums_1.CarStatus.MORTGAGE]: '按揭购车',
    [enums_1.CarStatus.FULL_PAID]: '全款购车',
};
exports.PROFILE_STATUS_LABEL = {
    [enums_1.ProfileStatus.DRAFT]: '草稿',
    [enums_1.ProfileStatus.PENDING]: '待审核',
    [enums_1.ProfileStatus.APPROVED]: '已通过',
    [enums_1.ProfileStatus.REJECTED]: '已驳回',
    [enums_1.ProfileStatus.OFFLINE]: '已下架',
};
exports.AUDIT_STATUS_LABEL = {
    [enums_1.AuditStatus.PENDING]: '待审核',
    [enums_1.AuditStatus.APPROVED]: '已通过',
    [enums_1.AuditStatus.REJECTED]: '已驳回',
};
exports.PROFILE_SOURCE_LABEL = {
    [enums_1.ProfileSource.SELF]: '用户自填',
    [enums_1.ProfileSource.MATCHMAKER]: '红娘代录',
    [enums_1.ProfileSource.IMPORT]: '后台导入',
};
exports.INTRODUCTION_STATUS_LABEL = {
    [enums_1.IntroductionStatus.INITIATED]: '已发起',
    [enums_1.IntroductionStatus.RECOMMENDED]: '已推荐',
    [enums_1.IntroductionStatus.PARTIALLY_AGREED]: '单方同意',
    [enums_1.IntroductionStatus.BOTH_AGREED]: '双方同意',
    [enums_1.IntroductionStatus.CONTACT_EXCHANGED]: '已交换联系方式',
    [enums_1.IntroductionStatus.MET]: '已见面',
    [enums_1.IntroductionStatus.SUCCESS]: '牵线成功',
    [enums_1.IntroductionStatus.FAILED]: '未成功',
    [enums_1.IntroductionStatus.CANCELLED]: '已取消',
};
/** 牵线流程的主干顺序，前端画步骤条用 */
exports.INTRODUCTION_FLOW_STEPS = [
    enums_1.IntroductionStatus.INITIATED,
    enums_1.IntroductionStatus.RECOMMENDED,
    enums_1.IntroductionStatus.BOTH_AGREED,
    enums_1.IntroductionStatus.CONTACT_EXCHANGED,
    enums_1.IntroductionStatus.MET,
    enums_1.IntroductionStatus.SUCCESS,
];
exports.ORDER_STATUS_LABEL = {
    [enums_1.OrderStatus.PENDING]: '待支付',
    [enums_1.OrderStatus.PAID]: '已支付',
    [enums_1.OrderStatus.CLOSED]: '已关闭',
    [enums_1.OrderStatus.REFUNDING]: '退款中',
    [enums_1.OrderStatus.REFUNDED]: '已退款',
};
exports.COMMISSION_STATUS_LABEL = {
    [enums_1.CommissionStatus.PENDING]: '待结算',
    [enums_1.CommissionStatus.SETTLED]: '可提现',
    [enums_1.CommissionStatus.WITHDRAWN]: '已提现',
    [enums_1.CommissionStatus.CANCELLED]: '已冲销',
};
exports.WITHDRAWAL_STATUS_LABEL = {
    [enums_1.WithdrawalStatus.PENDING]: '待审核',
    [enums_1.WithdrawalStatus.APPROVED]: '待打款',
    [enums_1.WithdrawalStatus.PAID]: '已打款',
    [enums_1.WithdrawalStatus.REJECTED]: '已拒绝',
};
exports.ROLE_LABEL = {
    [enums_1.RoleCode.SUPER_ADMIN]: '超级管理员',
    [enums_1.RoleCode.ADMIN]: '管理员',
    [enums_1.RoleCode.AUDITOR]: '审核员',
    [enums_1.RoleCode.MATCHMAKER]: '红娘',
    [enums_1.RoleCode.MEMBER]: '普通会员',
};
exports.VISIBILITY_LABEL = {
    [enums_1.VisibilityLevel.PUBLIC]: '公开',
    [enums_1.VisibilityLevel.MEMBER]: '登录可见',
    [enums_1.VisibilityLevel.VIP]: 'VIP 可见',
    [enums_1.VisibilityLevel.UNLOCKED]: '解锁后可见',
    [enums_1.VisibilityLevel.MATCHMAKER]: '仅红娘可见',
    [enums_1.VisibilityLevel.ADMIN]: '仅管理员可见',
};
exports.RESET_CYCLE_LABEL = {
    [enums_1.ResetCycle.NONE]: '不重置',
    [enums_1.ResetCycle.DAILY]: '每日重置',
    [enums_1.ResetCycle.MONTHLY]: '每月重置',
};
/** 权益元信息：名称、单位、默认重置周期 */
exports.BENEFIT_META = {
    [enums_1.BenefitCode.VIEW_PROFILE]: {
        label: '每日查看资料',
        unit: '人',
        defaultCycle: enums_1.ResetCycle.DAILY,
        desc: '每天可以查看多少份完整资料',
    },
    [enums_1.BenefitCode.UNLOCK_CONTACT]: {
        label: '解锁联系方式',
        unit: '次',
        defaultCycle: enums_1.ResetCycle.NONE,
        desc: '解锁后可见对方手机号/微信，用完为止',
    },
    [enums_1.BenefitCode.TOP_EXPOSURE]: {
        label: '置顶曝光',
        unit: '天',
        defaultCycle: enums_1.ResetCycle.NONE,
        desc: '在推荐列表中置顶展示的天数',
    },
    [enums_1.BenefitCode.AI_MATCH]: {
        label: 'AI 精准匹配',
        unit: '次',
        defaultCycle: enums_1.ResetCycle.DAILY,
        desc: '每天可调用几次 AI 深度匹配（走大模型，有成本）',
    },
    [enums_1.BenefitCode.SEE_VISITORS]: {
        label: '谁看过我',
        unit: '次',
        defaultCycle: enums_1.ResetCycle.DAILY,
        desc: '查看访客列表',
    },
    [enums_1.BenefitCode.ADVANCED_FILTER]: {
        label: '高级筛选',
        unit: '次',
        defaultCycle: enums_1.ResetCycle.DAILY,
        desc: '按学历/收入/房车等条件精筛',
    },
};
// ============ 匹配引擎参数 ============
/**
 * L2 加权打分的默认权重。总和不必为 1，最终会归一化。
 * 这套值是冷启动的经验起点，运营几个月后应该按"成单率"回归调参。
 */
exports.DEFAULT_MATCH_WEIGHTS = {
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
};
exports.MATCH_WEIGHT_LABEL = {
    mutualPreference: '双向择偶条件满足度',
    ageGap: '年龄差',
    education: '学历匹配',
    income: '收入匹配',
    distance: '地理距离',
    height: '身高搭配',
    semantic: 'AI 语义匹配',
};
/** 匹配引擎的硬性上限，防止单次请求扫全表 */
exports.MATCH_LIMITS = {
    /** L1 硬过滤后最多带进 L2 打分的候选数 */
    maxCandidates: 500,
    /** L2 打分后最多带进 L3 AI 层的候选数（AI 有成本，只给头部） */
    maxAiCandidates: 20,
    /** 单次返回上限 */
    maxPageSize: 50,
};
// ============ 其它业务常量 ============
/** 订单未支付自动关闭时长（分钟） */
exports.ORDER_AUTO_CLOSE_MINUTES = 30;
/** 分润冷静期（天）：订单支付后多久才把分润从"待结算"转"可提现"，防退款 */
exports.COMMISSION_COOLDOWN_DAYS = 7;
/** 提现最低金额（分） */
exports.WITHDRAWAL_MIN_AMOUNT = 10000;
/** 手机验证码有效期（秒） */
exports.SMS_CODE_TTL_SECONDS = 300;
/** 同一手机号发送验证码的最小间隔（秒） */
exports.SMS_CODE_INTERVAL_SECONDS = 60;
//# sourceMappingURL=constants.js.map