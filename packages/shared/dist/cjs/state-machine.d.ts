/**
 * 状态机定义与校验。
 *
 * 为什么单独抽出来：审核状态和牵线状态是这个系统里最容易被随手 update 写乱的两处。
 * 所有流转必须过 assertTransition，非法流转直接抛错，而不是默默写进库里。
 */
import { IntroductionStatus, ProfileStatus, OrderStatus, WithdrawalStatus } from './enums';
export type TransitionMap<T extends string> = Readonly<Record<T, readonly T[]>>;
/** 档案审核状态机 */
export declare const PROFILE_STATUS_TRANSITIONS: TransitionMap<ProfileStatus>;
/** 牵线状态机 */
export declare const INTRODUCTION_STATUS_TRANSITIONS: TransitionMap<IntroductionStatus>;
/** 订单状态机 */
export declare const ORDER_STATUS_TRANSITIONS: TransitionMap<OrderStatus>;
/** 提现单状态机 */
export declare const WITHDRAWAL_STATUS_TRANSITIONS: TransitionMap<WithdrawalStatus>;
/** 牵线的终态集合，用于"这单还开着吗"的判断 */
export declare const INTRODUCTION_TERMINAL_STATUSES: readonly IntroductionStatus[];
export declare function canTransition<T extends string>(map: TransitionMap<T>, from: T, to: T): boolean;
/** 非法流转时抛错。调用方负责把它转成 HTTP 400。 */
export declare function assertTransition<T extends string>(map: TransitionMap<T>, from: T, to: T, label?: string): void;
export declare function nextStatuses<T extends string>(map: TransitionMap<T>, from: T): readonly T[];
//# sourceMappingURL=state-machine.d.ts.map