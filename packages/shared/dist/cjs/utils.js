"use strict";
/**
 * 前后端共用的纯函数。放这里的东西必须无副作用、不依赖 Node 或浏览器 API。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calcAge = calcAge;
exports.ageRangeToBirthdayRange = ageRangeToBirthdayRange;
exports.educationRank = educationRank;
exports.fenToYuan = fenToYuan;
exports.yuanToFen = yuanToFen;
exports.clamp01 = clamp01;
exports.clamp = clamp;
exports.gaussianScore = gaussianScore;
exports.harmonicMean = harmonicMean;
exports.cosineSimilarity = cosineSimilarity;
exports.haversineKm = haversineKm;
exports.buildSerialNo = buildSerialNo;
exports.isValidPhone = isValidPhone;
exports.toDateStr = toDateStr;
exports.startOfDay = startOfDay;
exports.startOfNextDay = startOfNextDay;
exports.startOfMonth = startOfMonth;
exports.startOfNextMonth = startOfNextMonth;
exports.addDays = addDays;
const enums_1 = require("./enums");
/** 由生日算周岁 */
function calcAge(birthday, at = new Date()) {
    const b = typeof birthday === 'string' ? new Date(birthday) : birthday;
    let age = at.getFullYear() - b.getFullYear();
    const m = at.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && at.getDate() < b.getDate()))
        age--;
    return Math.max(age, 0);
}
/** 由年龄反推生日区间，用于 SQL 硬过滤（比在 SQL 里算年龄快得多，能走索引） */
function ageRangeToBirthdayRange(ageMin, ageMax, at = new Date()) {
    const out = {};
    // 年龄 <= ageMax  ⇒  生日 >= 今天减去 (ageMax+1) 年 的次日
    if (ageMax != null) {
        const d = new Date(at);
        d.setFullYear(d.getFullYear() - ageMax - 1);
        d.setDate(d.getDate() + 1);
        out.gte = d;
    }
    // 年龄 >= ageMin  ⇒  生日 <= 今天减去 ageMin 年
    if (ageMin != null) {
        const d = new Date(at);
        d.setFullYear(d.getFullYear() - ageMin);
        out.lte = d;
    }
    return out;
}
function educationRank(e) {
    return e ? (enums_1.EDUCATION_RANK[e] ?? 0) : 0;
}
/** 分 → 元，展示用 */
function fenToYuan(fen) {
    return (fen / 100).toFixed(2);
}
/** 元 → 分，入库用。用字符串解析避免浮点误差 */
function yuanToFen(yuan) {
    const s = typeof yuan === 'number' ? yuan.toFixed(2) : yuan.trim();
    const [int, dec = ''] = s.split('.');
    const decPadded = (dec + '00').slice(0, 2);
    return parseInt(int, 10) * 100 + parseInt(decPadded, 10) * (int.startsWith('-') ? -1 : 1);
}
/** 把值夹到 [0,1] */
function clamp01(v) {
    if (Number.isNaN(v))
        return 0;
    return v < 0 ? 0 : v > 1 ? 1 : v;
}
function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
}
/**
 * 高斯衰减：差值为 0 时得 1 分，差值越大分越低。
 * tolerance 是"半衰点"——差到这个数时大约得 0.6 分。
 * 用它比线性衰减更符合直觉：年龄差 1 岁和 2 岁几乎没区别，差 8 岁和 9 岁也没区别。
 */
function gaussianScore(diff, tolerance) {
    if (tolerance <= 0)
        return diff === 0 ? 1 : 0;
    return clamp01(Math.exp(-(diff * diff) / (2 * tolerance * tolerance)));
}
/**
 * 调和平均。用于合成双向满足度：
 * 单向 1.0 + 另一向 0.2 的算术平均是 0.6（看着还行），调和平均只有 0.33（如实反映"剃头挑子一头热"）。
 */
function harmonicMean(a, b) {
    if (a <= 0 || b <= 0)
        return 0;
    return (2 * a * b) / (a + b);
}
/** 余弦相似度，用于 embedding 语义匹配 */
function cosineSimilarity(a, b) {
    const n = Math.min(a.length, b.length);
    if (n === 0)
        return 0;
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < n; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    if (na === 0 || nb === 0)
        return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
/** 两点球面距离（公里），用于同城/距离打分 */
function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}
/** 生成展示编号，如 YQ2608100042 */
function buildSerialNo(prefix, seq, at = new Date()) {
    const yy = String(at.getFullYear()).slice(2);
    const mm = String(at.getMonth() + 1).padStart(2, '0');
    const dd = String(at.getDate()).padStart(2, '0');
    return `${prefix}${yy}${mm}${dd}${String(seq).padStart(4, '0')}`;
}
/** 手机号粗校验（中国大陆） */
function isValidPhone(phone) {
    return /^1[3-9]\d{9}$/.test(phone);
}
/** 日期 → YYYY-MM-DD（本地时区） */
function toDateStr(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
/** 当日零点 */
function startOfDay(d = new Date()) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}
/** 次日零点，权益按日重置用 */
function startOfNextDay(d = new Date()) {
    const x = startOfDay(d);
    x.setDate(x.getDate() + 1);
    return x;
}
function startOfMonth(d = new Date()) {
    const x = new Date(d.getFullYear(), d.getMonth(), 1);
    x.setHours(0, 0, 0, 0);
    return x;
}
function startOfNextMonth(d = new Date()) {
    return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}
function addDays(d, days) {
    const x = new Date(d);
    x.setDate(x.getDate() + days);
    return x;
}
//# sourceMappingURL=utils.js.map