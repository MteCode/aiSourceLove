/**
 * 前后端共用的纯函数。放这里的东西必须无副作用、不依赖 Node 或浏览器 API。
 */
import { Education } from './enums';
/** 由生日算周岁 */
export declare function calcAge(birthday: Date | string, at?: Date): number;
/** 由年龄反推生日区间，用于 SQL 硬过滤（比在 SQL 里算年龄快得多，能走索引） */
export declare function ageRangeToBirthdayRange(ageMin: number | null | undefined, ageMax: number | null | undefined, at?: Date): {
    gte?: Date;
    lte?: Date;
};
export declare function educationRank(e: Education | null | undefined): number;
/** 分 → 元，展示用 */
export declare function fenToYuan(fen: number): string;
/** 元 → 分，入库用。用字符串解析避免浮点误差 */
export declare function yuanToFen(yuan: number | string): number;
/** 把值夹到 [0,1] */
export declare function clamp01(v: number): number;
export declare function clamp(v: number, min: number, max: number): number;
/**
 * 高斯衰减：差值为 0 时得 1 分，差值越大分越低。
 * tolerance 是"半衰点"——差到这个数时大约得 0.6 分。
 * 用它比线性衰减更符合直觉：年龄差 1 岁和 2 岁几乎没区别，差 8 岁和 9 岁也没区别。
 */
export declare function gaussianScore(diff: number, tolerance: number): number;
/**
 * 调和平均。用于合成双向满足度：
 * 单向 1.0 + 另一向 0.2 的算术平均是 0.6（看着还行），调和平均只有 0.33（如实反映"剃头挑子一头热"）。
 */
export declare function harmonicMean(a: number, b: number): number;
/** 余弦相似度，用于 embedding 语义匹配 */
export declare function cosineSimilarity(a: number[], b: number[]): number;
/** 两点球面距离（公里），用于同城/距离打分 */
export declare function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number;
/** 生成展示编号，如 YQ2608100042 */
export declare function buildSerialNo(prefix: string, seq: number, at?: Date): string;
/** 手机号粗校验（中国大陆） */
export declare function isValidPhone(phone: string): boolean;
/** 日期 → YYYY-MM-DD（本地时区） */
export declare function toDateStr(d: Date): string;
/** 当日零点 */
export declare function startOfDay(d?: Date): Date;
/** 次日零点，权益按日重置用 */
export declare function startOfNextDay(d?: Date): Date;
export declare function startOfMonth(d?: Date): Date;
export declare function startOfNextMonth(d?: Date): Date;
export declare function addDays(d: Date, days: number): Date;
//# sourceMappingURL=utils.d.ts.map