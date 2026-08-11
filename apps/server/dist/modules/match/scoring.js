"use strict";
/**
 * L2 加权打分 —— 纯函数，不碰数据库，方便单测和后期调参。
 *
 * 设计要点：
 *  1. **双向**。很多相亲系统只算"A 是否符合 B 的要求"，
 *     结果推出一堆剃头挑子一头热的匹配，红娘约不出来人。
 *     这里两个方向都算，再用调和平均合成——一头热会被狠狠压分。
 *  2. 每一项都输出 note（人话解释）。红娘看不懂分数不会用，
 *     看得懂"年龄差 3 岁、同城、学历相当"才会信。
 *  3. 缺失数据不当作 0 分，当作"中性分" NEUTRAL。
 *     资料填得少的人不该因为没填而排到最后——那是新用户流失的主因。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateSatisfaction = evaluateSatisfaction;
exports.computeMatchScore = computeMatchScore;
const shared_1 = require("@yuanqiao/shared");
/** 数据缺失时给的中性分。不是 0，也不是 1。 */
const NEUTRAL = 0.5;
/**
 * 算「candidate 满足 pref（某人的择偶要求）的程度」。
 *
 * 硬性条件（婚史、子女、房车）不满足直接判 0 分权重项，
 * 弹性条件（年龄、身高、学历、收入）按接近程度给部分分——
 * 差 1 岁就判死刑不合理，但差 15 岁也不能当没看见。
 */
function evaluateSatisfaction(candidate, pref) {
    if (!pref) {
        // 对方没填要求 = 不挑 = 全都满足
        return { score: 1, met: [], unmet: [], criteriaCount: 0 };
    }
    const parts = [];
    const met = [];
    const unmet = [];
    const age = (0, shared_1.calcAge)(candidate.birthday);
    // ── 年龄区间（弹性：超出边界按超出幅度衰减）──
    if (pref.ageMin != null || pref.ageMax != null) {
        const lo = pref.ageMin ?? 0;
        const hi = pref.ageMax ?? 200;
        if (age >= lo && age <= hi) {
            parts.push(1);
            met.push(`年龄 ${age} 岁在期望的 ${lo}-${hi} 岁内`);
        }
        else {
            const over = age < lo ? lo - age : age - hi;
            const s = (0, shared_1.gaussianScore)(over, 3); // 超出 3 岁约得 0.6 分
            parts.push(s);
            unmet.push(`年龄 ${age} 岁，超出期望 ${lo}-${hi} 岁 ${over} 岁`);
        }
    }
    // ── 身高区间 ──
    if ((pref.heightMin != null || pref.heightMax != null) && candidate.heightCm != null) {
        const lo = pref.heightMin ?? 0;
        const hi = pref.heightMax ?? 300;
        const h = candidate.heightCm;
        if (h >= lo && h <= hi) {
            parts.push(1);
            met.push(`身高 ${h}cm 符合要求`);
        }
        else {
            const over = h < lo ? lo - h : h - hi;
            parts.push((0, shared_1.gaussianScore)(over, 5));
            unmet.push(`身高 ${h}cm，期望 ${lo}-${hi}cm`);
        }
    }
    // ── 学历下限（高于要求满分，低一档给 0.5，低两档以上 0.2）──
    if (pref.educationMin) {
        const need = (0, shared_1.educationRank)(pref.educationMin);
        const has = (0, shared_1.educationRank)(candidate.education);
        if (has === 0) {
            parts.push(NEUTRAL);
        }
        else if (has >= need) {
            parts.push(1);
            met.push(`学历达到要求`);
        }
        else {
            const gap = need - has;
            const s = gap === 1 ? 0.5 : 0.2;
            parts.push(s);
            unmet.push(`学历低于期望 ${gap} 档`);
        }
    }
    // ── 收入下限 ──
    if (pref.incomeMin != null && pref.incomeMin > 0) {
        if (candidate.annualIncome == null) {
            parts.push(NEUTRAL);
        }
        else if (candidate.annualIncome >= pref.incomeMin) {
            parts.push(1);
            met.push(`收入达到期望`);
        }
        else {
            // 达成率，最低给 0.1
            const ratio = (0, shared_1.clamp01)(candidate.annualIncome / pref.incomeMin);
            parts.push(Math.max(ratio * 0.8, 0.1));
            unmet.push(`年收入 ${Math.round(candidate.annualIncome / 10000)} 万，期望 ${Math.round(pref.incomeMin / 10000)} 万以上`);
        }
    }
    // ── 婚史（硬性）──
    if (pref.maritalStatus.length) {
        if (pref.maritalStatus.includes(candidate.maritalStatus)) {
            parts.push(1);
            met.push(`婚史${shared_1.MARITAL_LABEL[candidate.maritalStatus]}，符合要求`);
        }
        else {
            parts.push(0);
            unmet.push(`婚史${shared_1.MARITAL_LABEL[candidate.maritalStatus]}，对方仅接受${pref.maritalStatus.map((m) => shared_1.MARITAL_LABEL[m]).join('/')}`);
        }
    }
    // ── 子女（硬性）──
    if (pref.childrenStatus.length) {
        if (pref.childrenStatus.includes(candidate.childrenStatus)) {
            parts.push(1);
            met.push('子女情况符合要求');
        }
        else {
            parts.push(0);
            unmet.push('子女情况不符合对方要求');
        }
    }
    // ── 期望城市（硬性）──
    if (pref.cityCodes.length) {
        if (candidate.cityCode && pref.cityCodes.includes(candidate.cityCode)) {
            parts.push(1);
            met.push('所在城市符合要求');
        }
        else {
            parts.push(0);
            unmet.push('所在城市不在对方期望范围内');
        }
    }
    // ── 房 / 车（硬性）──
    if (pref.requireHouse) {
        const ok = candidate.houseStatus === shared_1.HouseStatus.MORTGAGE || candidate.houseStatus === shared_1.HouseStatus.FULL_PAID;
        parts.push(ok ? 1 : 0);
        (ok ? met : unmet).push(ok ? '有房，符合要求' : '对方要求有房');
    }
    if (pref.requireCar) {
        const ok = candidate.carStatus === shared_1.CarStatus.MORTGAGE || candidate.carStatus === shared_1.CarStatus.FULL_PAID;
        parts.push(ok ? 1 : 0);
        (ok ? met : unmet).push(ok ? '有车，符合要求' : '对方要求有车');
    }
    if (!parts.length)
        return { score: 1, met, unmet, criteriaCount: 0 };
    return {
        score: (0, shared_1.clamp01)(parts.reduce((s, v) => s + v, 0) / parts.length),
        met,
        unmet,
        criteriaCount: parts.length,
    };
}
// ─────────── 单项打分 ───────────
function scoreAgeGap(a, b) {
    const ageA = (0, shared_1.calcAge)(a.birthday);
    const ageB = (0, shared_1.calcAge)(b.birthday);
    const gap = Math.abs(ageA - ageB);
    // 容忍度 5 岁：差 5 岁约 0.6 分，差 10 岁约 0.14 分
    return { raw: (0, shared_1.gaussianScore)(gap, 5), note: `年龄差 ${gap} 岁（${ageA} / ${ageB}）` };
}
function scoreEducation(a, b) {
    const ra = (0, shared_1.educationRank)(a.education);
    const rb = (0, shared_1.educationRank)(b.education);
    if (ra === 0 || rb === 0)
        return { raw: NEUTRAL, note: '学历信息不完整' };
    const gap = Math.abs(ra - rb);
    return { raw: (0, shared_1.gaussianScore)(gap, 1.2), note: gap === 0 ? '学历相同' : `学历相差 ${gap} 档` };
}
function scoreIncome(a, b) {
    if (a.annualIncome == null || b.annualIncome == null) {
        return { raw: NEUTRAL, note: '收入信息不完整' };
    }
    const hi = Math.max(a.annualIncome, b.annualIncome);
    const lo = Math.min(a.annualIncome, b.annualIncome);
    if (hi === 0)
        return { raw: NEUTRAL, note: '收入信息不完整' };
    // 比值越接近 1 越搭。差 3 倍以上明显不搭。
    const ratio = lo / hi;
    return {
        raw: (0, shared_1.clamp01)(ratio ** 0.5),
        note: `年收入 ${Math.round(a.annualIncome / 10000)} 万 / ${Math.round(b.annualIncome / 10000)} 万`,
    };
}
function scoreDistance(a, b) {
    if (a.cityCode && b.cityCode && a.cityCode === b.cityCode) {
        return { raw: 1, note: '同城' };
    }
    if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
        const km = (0, shared_1.haversineKm)(a.lat, a.lng, b.lat, b.lng);
        // 100km 内还行，300km 以上就很难持续见面了
        return { raw: (0, shared_1.gaussianScore)(km, 150), note: `相距约 ${Math.round(km)} 公里` };
    }
    if (a.provinceCode && b.provinceCode && a.provinceCode === b.provinceCode) {
        return { raw: 0.6, note: '同省不同市' };
    }
    return { raw: 0.2, note: '异地' };
}
/**
 * 身高搭配。按国内相亲市场的普遍偏好：男略高于女。
 * 这不是价值判断，是对市场现状的拟合——如果你的目标人群不吃这套，
 * 把这个函数改掉或者把 height 权重调成 0 就行。
 */
function scoreHeight(a, b) {
    if (a.heightCm == null || b.heightCm == null) {
        return { raw: NEUTRAL, note: '身高信息不完整' };
    }
    const male = a.gender === shared_1.Gender.MALE ? a : b;
    const female = a.gender === shared_1.Gender.MALE ? b : a;
    if (male.heightCm == null || female.heightCm == null) {
        return { raw: NEUTRAL, note: '身高信息不完整' };
    }
    const diff = male.heightCm - female.heightCm;
    // 理想差 12cm，容忍度 10
    const raw = (0, shared_1.gaussianScore)(Math.abs(diff - 12), 10);
    return { raw, note: `身高差 ${diff}cm（男 ${male.heightCm} / 女 ${female.heightCm}）` };
}
function computeMatchScore(input) {
    const { self, candidate, semantic } = input;
    const w = { ...shared_1.DEFAULT_MATCH_WEIGHTS, ...input.weights };
    // 双向满足度
    const selfSatisfiesCandidatePref = evaluateSatisfaction(self, candidate.preference);
    const candidateSatisfiesSelfPref = evaluateSatisfaction(candidate, self.preference);
    const mutual = (0, shared_1.harmonicMean)(selfSatisfiesCandidatePref.score, candidateSatisfiesSelfPref.score);
    const items = [
        {
            key: 'mutualPreference',
            raw: mutual,
            note: `我方满足对方要求 ${(selfSatisfiesCandidatePref.score * 100).toFixed(0)}%，` +
                `对方满足我方要求 ${(candidateSatisfiesSelfPref.score * 100).toFixed(0)}%`,
        },
        { key: 'ageGap', ...scoreAgeGap(self, candidate) },
        { key: 'education', ...scoreEducation(self, candidate) },
        { key: 'income', ...scoreIncome(self, candidate) },
        { key: 'distance', ...scoreDistance(self, candidate) },
        { key: 'height', ...scoreHeight(self, candidate) },
    ];
    // AI 层没跑时，把 semantic 的权重摊回给其它项，而不是塞个 0.5 进去稀释结果
    const hasSemantic = semantic != null;
    if (hasSemantic) {
        items.push({
            key: 'semantic',
            raw: (0, shared_1.clamp01)(semantic),
            note: `自我介绍与择偶描述的语义契合度 ${(semantic * 100).toFixed(0)}%`,
        });
    }
    const totalWeight = items.reduce((s, it) => s + (w[it.key] ?? 0), 0);
    const details = items.map((it) => {
        const weight = (w[it.key] ?? 0) / (totalWeight || 1);
        return {
            key: it.key,
            label: shared_1.MATCH_WEIGHT_LABEL[it.key],
            raw: Number(it.raw.toFixed(4)),
            weight: Number(weight.toFixed(4)),
            weighted: Number((it.raw * weight).toFixed(4)),
            note: it.note,
        };
    });
    const score = Math.round(details.reduce((s, d) => s + d.weighted, 0) * 100);
    // 亮点 / 顾虑：给红娘看的人话摘要
    const highlights = [
        ...candidateSatisfiesSelfPref.met.slice(0, 3),
        ...details
            .filter((d) => d.raw >= 0.85 && d.key !== 'mutualPreference')
            .map((d) => d.note)
            .slice(0, 2),
    ];
    const concerns = [
        ...candidateSatisfiesSelfPref.unmet,
        ...selfSatisfiesCandidatePref.unmet.map((u) => `（对方视角）${u}`),
    ].slice(0, 4);
    return {
        score: Math.max(0, Math.min(100, score)),
        details,
        aSatisfiesB: Number(selfSatisfiesCandidatePref.score.toFixed(4)),
        bSatisfiesA: Number(candidateSatisfiesSelfPref.score.toFixed(4)),
        highlights: [...new Set(highlights)],
        concerns: [...new Set(concerns)],
    };
}
//# sourceMappingURL=scoring.js.map