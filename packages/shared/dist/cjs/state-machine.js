"use strict";
/**
 * 状态机定义与校验。
 *
 * 为什么单独抽出来：审核状态和牵线状态是这个系统里最容易被随手 update 写乱的两处。
 * 所有流转必须过 assertTransition，非法流转直接抛错，而不是默默写进库里。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.INTRODUCTION_TERMINAL_STATUSES = exports.WITHDRAWAL_STATUS_TRANSITIONS = exports.ORDER_STATUS_TRANSITIONS = exports.INTRODUCTION_STATUS_TRANSITIONS = exports.PROFILE_STATUS_TRANSITIONS = void 0;
exports.canTransition = canTransition;
exports.assertTransition = assertTransition;
exports.nextStatuses = nextStatuses;
const enums_1 = require("./enums");
/** 档案审核状态机 */
exports.PROFILE_STATUS_TRANSITIONS = {
    [enums_1.ProfileStatus.DRAFT]: [enums_1.ProfileStatus.PENDING],
    // 待审可以直接被管理员下架（比如举报进来的）
    [enums_1.ProfileStatus.PENDING]: [enums_1.ProfileStatus.APPROVED, enums_1.ProfileStatus.REJECTED, enums_1.ProfileStatus.OFFLINE],
    // 通过后改了关键资料要重新送审；脱单/违规则下架
    [enums_1.ProfileStatus.APPROVED]: [enums_1.ProfileStatus.PENDING, enums_1.ProfileStatus.OFFLINE],
    [enums_1.ProfileStatus.REJECTED]: [enums_1.ProfileStatus.PENDING, enums_1.ProfileStatus.OFFLINE],
    // 下架后可重新送审上架
    [enums_1.ProfileStatus.OFFLINE]: [enums_1.ProfileStatus.PENDING],
};
/** 牵线状态机 */
exports.INTRODUCTION_STATUS_TRANSITIONS = {
    [enums_1.IntroductionStatus.INITIATED]: [enums_1.IntroductionStatus.RECOMMENDED, enums_1.IntroductionStatus.CANCELLED],
    [enums_1.IntroductionStatus.RECOMMENDED]: [
        enums_1.IntroductionStatus.PARTIALLY_AGREED,
        // 双方几乎同时点同意的情况，允许一步到位
        enums_1.IntroductionStatus.BOTH_AGREED,
        enums_1.IntroductionStatus.FAILED,
        enums_1.IntroductionStatus.CANCELLED,
    ],
    [enums_1.IntroductionStatus.PARTIALLY_AGREED]: [
        enums_1.IntroductionStatus.BOTH_AGREED,
        enums_1.IntroductionStatus.FAILED,
        enums_1.IntroductionStatus.CANCELLED,
    ],
    [enums_1.IntroductionStatus.BOTH_AGREED]: [
        enums_1.IntroductionStatus.CONTACT_EXCHANGED,
        enums_1.IntroductionStatus.FAILED,
        enums_1.IntroductionStatus.CANCELLED,
    ],
    [enums_1.IntroductionStatus.CONTACT_EXCHANGED]: [enums_1.IntroductionStatus.MET, enums_1.IntroductionStatus.FAILED],
    [enums_1.IntroductionStatus.MET]: [enums_1.IntroductionStatus.SUCCESS, enums_1.IntroductionStatus.FAILED],
    // 终态
    [enums_1.IntroductionStatus.SUCCESS]: [],
    [enums_1.IntroductionStatus.FAILED]: [],
    [enums_1.IntroductionStatus.CANCELLED]: [],
};
/** 订单状态机 */
exports.ORDER_STATUS_TRANSITIONS = {
    [enums_1.OrderStatus.PENDING]: [enums_1.OrderStatus.PAID, enums_1.OrderStatus.CLOSED],
    [enums_1.OrderStatus.PAID]: [enums_1.OrderStatus.REFUNDING],
    [enums_1.OrderStatus.REFUNDING]: [enums_1.OrderStatus.REFUNDED, enums_1.OrderStatus.PAID],
    [enums_1.OrderStatus.REFUNDED]: [],
    [enums_1.OrderStatus.CLOSED]: [],
};
/** 提现单状态机 */
exports.WITHDRAWAL_STATUS_TRANSITIONS = {
    [enums_1.WithdrawalStatus.PENDING]: [enums_1.WithdrawalStatus.APPROVED, enums_1.WithdrawalStatus.REJECTED],
    [enums_1.WithdrawalStatus.APPROVED]: [enums_1.WithdrawalStatus.PAID, enums_1.WithdrawalStatus.REJECTED],
    [enums_1.WithdrawalStatus.PAID]: [],
    [enums_1.WithdrawalStatus.REJECTED]: [],
};
/** 牵线的终态集合，用于"这单还开着吗"的判断 */
exports.INTRODUCTION_TERMINAL_STATUSES = [
    enums_1.IntroductionStatus.SUCCESS,
    enums_1.IntroductionStatus.FAILED,
    enums_1.IntroductionStatus.CANCELLED,
];
function canTransition(map, from, to) {
    const allowed = map[from];
    return Array.isArray(allowed) && allowed.includes(to);
}
/** 非法流转时抛错。调用方负责把它转成 HTTP 400。 */
function assertTransition(map, from, to, label = '状态') {
    if (!canTransition(map, from, to)) {
        const allowed = (map[from] ?? []).join(', ') || '（终态，不可再流转）';
        throw new Error(`${label}不允许从 ${from} 流转到 ${to}；当前可流转到：${allowed}`);
    }
}
function nextStatuses(map, from) {
    return map[from] ?? [];
}
//# sourceMappingURL=state-machine.js.map