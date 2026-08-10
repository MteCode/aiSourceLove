/**
 * 状态机定义与校验。
 *
 * 为什么单独抽出来：审核状态和牵线状态是这个系统里最容易被随手 update 写乱的两处。
 * 所有流转必须过 assertTransition，非法流转直接抛错，而不是默默写进库里。
 */
import { IntroductionStatus, ProfileStatus, OrderStatus, WithdrawalStatus } from './enums';
/** 档案审核状态机 */
export const PROFILE_STATUS_TRANSITIONS = {
    [ProfileStatus.DRAFT]: [ProfileStatus.PENDING],
    // 待审可以直接被管理员下架（比如举报进来的）
    [ProfileStatus.PENDING]: [ProfileStatus.APPROVED, ProfileStatus.REJECTED, ProfileStatus.OFFLINE],
    // 通过后改了关键资料要重新送审；脱单/违规则下架
    [ProfileStatus.APPROVED]: [ProfileStatus.PENDING, ProfileStatus.OFFLINE],
    [ProfileStatus.REJECTED]: [ProfileStatus.PENDING, ProfileStatus.OFFLINE],
    // 下架后可重新送审上架
    [ProfileStatus.OFFLINE]: [ProfileStatus.PENDING],
};
/** 牵线状态机 */
export const INTRODUCTION_STATUS_TRANSITIONS = {
    [IntroductionStatus.INITIATED]: [IntroductionStatus.RECOMMENDED, IntroductionStatus.CANCELLED],
    [IntroductionStatus.RECOMMENDED]: [
        IntroductionStatus.PARTIALLY_AGREED,
        // 双方几乎同时点同意的情况，允许一步到位
        IntroductionStatus.BOTH_AGREED,
        IntroductionStatus.FAILED,
        IntroductionStatus.CANCELLED,
    ],
    [IntroductionStatus.PARTIALLY_AGREED]: [
        IntroductionStatus.BOTH_AGREED,
        IntroductionStatus.FAILED,
        IntroductionStatus.CANCELLED,
    ],
    [IntroductionStatus.BOTH_AGREED]: [
        IntroductionStatus.CONTACT_EXCHANGED,
        IntroductionStatus.FAILED,
        IntroductionStatus.CANCELLED,
    ],
    [IntroductionStatus.CONTACT_EXCHANGED]: [IntroductionStatus.MET, IntroductionStatus.FAILED],
    [IntroductionStatus.MET]: [IntroductionStatus.SUCCESS, IntroductionStatus.FAILED],
    // 终态
    [IntroductionStatus.SUCCESS]: [],
    [IntroductionStatus.FAILED]: [],
    [IntroductionStatus.CANCELLED]: [],
};
/** 订单状态机 */
export const ORDER_STATUS_TRANSITIONS = {
    [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CLOSED],
    [OrderStatus.PAID]: [OrderStatus.REFUNDING],
    [OrderStatus.REFUNDING]: [OrderStatus.REFUNDED, OrderStatus.PAID],
    [OrderStatus.REFUNDED]: [],
    [OrderStatus.CLOSED]: [],
};
/** 提现单状态机 */
export const WITHDRAWAL_STATUS_TRANSITIONS = {
    [WithdrawalStatus.PENDING]: [WithdrawalStatus.APPROVED, WithdrawalStatus.REJECTED],
    [WithdrawalStatus.APPROVED]: [WithdrawalStatus.PAID, WithdrawalStatus.REJECTED],
    [WithdrawalStatus.PAID]: [],
    [WithdrawalStatus.REJECTED]: [],
};
/** 牵线的终态集合，用于"这单还开着吗"的判断 */
export const INTRODUCTION_TERMINAL_STATUSES = [
    IntroductionStatus.SUCCESS,
    IntroductionStatus.FAILED,
    IntroductionStatus.CANCELLED,
];
export function canTransition(map, from, to) {
    const allowed = map[from];
    return Array.isArray(allowed) && allowed.includes(to);
}
/** 非法流转时抛错。调用方负责把它转成 HTTP 400。 */
export function assertTransition(map, from, to, label = '状态') {
    if (!canTransition(map, from, to)) {
        const allowed = (map[from] ?? []).join(', ') || '（终态，不可再流转）';
        throw new Error(`${label}不允许从 ${from} 流转到 ${to}；当前可流转到：${allowed}`);
    }
}
export function nextStatuses(map, from) {
    return map[from] ?? [];
}
//# sourceMappingURL=state-machine.js.map