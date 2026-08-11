"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var FieldService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FieldService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@yuanqiao/shared");
const all_exceptions_filter_1 = require("../../common/filters/all-exceptions.filter");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
const redis_service_1 = require("../../infra/redis/redis.service");
const SCHEMA_CACHE_KEY = 'schema:form:v1';
const SCHEMA_CACHE_TTL = 300;
/**
 * 字段字典服务（模块1 的地基）。
 *
 * 核心思想：**字段绝不硬编码**。运营三个月后一定会想加字段，
 * 那时如果字段写死在 DTO 和表结构里，加一个"是否接受异地"就要发一次版。
 *
 * 混合存储策略：
 *   isCore=true  → 映射到 Profile 固定列，能建索引，参与 L1 硬过滤
 *   isCore=false → 存 ProfileFieldValue（EAV），随便加，不用改表
 *
 * 纯 EAV 会被"性别+年龄+城市"的组合查询打死，纯固定列又加不了字段，所以必须混合。
 */
let FieldService = class FieldService {
    static { FieldService_1 = this; }
    prisma;
    redis;
    logger = new common_1.Logger(FieldService_1.name);
    /** isCore 字段只能是这些——它们对应 Profile 上真实存在的列 */
    static CORE_FIELD_CODES = new Set([
        'realName', 'nickname', 'gender', 'birthday', 'heightCm', 'weightKg',
        'education', 'school', 'occupation', 'company', 'annualIncome',
        'maritalStatus', 'childrenStatus', 'houseStatus', 'carStatus',
        'provinceCode', 'cityCode', 'districtCode', 'hometownCityCode',
        'introduction', 'phone', 'wechat',
    ]);
    constructor(prisma, redis) {
        this.prisma = prisma;
        this.redis = redis;
    }
    // ───────── 读取 schema ─────────
    /** 完整表单 schema，前端拿到直接渲染。带缓存。 */
    async getFormSchema(force = false) {
        if (!force) {
            const cached = await this.redis.getJson(SCHEMA_CACHE_KEY);
            if (cached)
                return cached;
        }
        const groups = await this.prisma.fieldGroup.findMany({
            where: { enabled: true },
            orderBy: { sort: 'asc' },
            include: {
                fields: { where: { enabled: true }, orderBy: { sort: 'asc' } },
            },
        });
        const schema = {
            groups: groups.map((g) => this.toGroupDto(g, g.fields)),
            // 用最新的 updatedAt 当版本号，字段一改前端缓存自动失效
            version: String(groups.reduce((max, g) => Math.max(max, ...g.fields.map((f) => f.updatedAt.getTime()), 0), 0)),
        };
        await this.redis.setJson(SCHEMA_CACHE_KEY, schema, SCHEMA_CACHE_TTL);
        return schema;
    }
    /** 择偶要求表单：只取 isPreference 的字段 */
    async getPreferenceSchema() {
        const full = await this.getFormSchema();
        return {
            version: full.version,
            groups: full.groups
                .map((g) => ({ ...g, fields: g.fields.filter((f) => f.isPreference) }))
                .filter((g) => g.fields.length > 0),
        };
    }
    /** 所有启用字段的扁平列表（内部用，比如校验和打分） */
    async getEnabledFields() {
        const schema = await this.getFormSchema();
        return schema.groups.flatMap((g) => g.fields);
    }
    /** 只要扩展字段（EAV 那部分） */
    async getExtraFields() {
        return (await this.getEnabledFields()).filter((f) => !f.isCore);
    }
    async invalidateCache() {
        await this.redis.del(SCHEMA_CACHE_KEY);
    }
    // ───────── 分组 CRUD ─────────
    async listGroups() {
        const groups = await this.prisma.fieldGroup.findMany({
            orderBy: { sort: 'asc' },
            include: { fields: { orderBy: { sort: 'asc' } } },
        });
        return groups.map((g) => this.toGroupDto(g, g.fields));
    }
    async createGroup(dto) {
        const g = await this.prisma.fieldGroup.create({
            data: { code: dto.code, name: dto.name, sort: dto.sort ?? 0, enabled: dto.enabled ?? true },
        });
        await this.invalidateCache();
        return this.toGroupDto(g, []);
    }
    async updateGroup(id, dto) {
        const g = await this.prisma.fieldGroup.update({
            where: { id },
            data: { name: dto.name, sort: dto.sort, enabled: dto.enabled },
            include: { fields: { orderBy: { sort: 'asc' } } },
        });
        await this.invalidateCache();
        return this.toGroupDto(g, g.fields);
    }
    async deleteGroup(id) {
        const count = await this.prisma.fieldDef.count({ where: { groupId: id } });
        if (count > 0) {
            throw new all_exceptions_filter_1.BizException(`该分组下还有 ${count} 个字段，请先移除或改到其它分组`, 40903);
        }
        await this.prisma.fieldGroup.delete({ where: { id } });
        await this.invalidateCache();
        return { success: true };
    }
    // ───────── 字段 CRUD ─────────
    async createField(dto) {
        this.assertCoreCodeValid(dto.code, dto.isCore ?? false);
        this.assertOptionsPresent(dto.type, dto.options);
        const group = await this.prisma.fieldGroup.findUnique({ where: { id: dto.groupId } });
        if (!group)
            throw new common_1.NotFoundException('字段分组不存在');
        const f = await this.prisma.fieldDef.create({
            data: {
                code: dto.code,
                label: dto.label,
                type: dto.type,
                groupId: dto.groupId,
                options: (dto.options ?? undefined),
                placeholder: dto.placeholder,
                helpText: dto.helpText,
                required: dto.required ?? false,
                visibility: dto.visibility ?? shared_1.VisibilityLevel.MEMBER,
                isCore: dto.isCore ?? false,
                isPreference: dto.isPreference ?? false,
                weightKey: dto.weightKey,
                minValue: dto.minValue,
                maxValue: dto.maxValue,
                maxLength: dto.maxLength,
                regex: dto.regex,
                sort: dto.sort ?? 0,
                enabled: dto.enabled ?? true,
            },
            include: { group: true },
        });
        await this.invalidateCache();
        return this.toFieldDto(f, f.group.name);
    }
    async updateField(id, dto) {
        const existing = await this.prisma.fieldDef.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException('字段不存在');
        // code 和 isCore 一旦定了就不能改：已经有数据落在这个 code 上了，
        // 改了等于所有存量值凭空消失。要改就新建一个字段。
        if (dto.code && dto.code !== existing.code) {
            throw new all_exceptions_filter_1.BizException('字段 code 不可修改（已有数据依赖它）。如需更名请改 label。', 40012);
        }
        if (dto.isCore != null && dto.isCore !== existing.isCore) {
            throw new all_exceptions_filter_1.BizException('字段的存储位置（isCore）不可修改，请新建字段并迁移数据', 40013);
        }
        this.assertOptionsPresent(dto.type ?? existing.type, dto.options ?? existing.options ?? undefined);
        const f = await this.prisma.fieldDef.update({
            where: { id },
            data: {
                label: dto.label,
                type: dto.type,
                groupId: dto.groupId,
                options: (dto.options ?? undefined),
                placeholder: dto.placeholder,
                helpText: dto.helpText,
                required: dto.required,
                visibility: dto.visibility,
                isPreference: dto.isPreference,
                weightKey: dto.weightKey,
                minValue: dto.minValue,
                maxValue: dto.maxValue,
                maxLength: dto.maxLength,
                regex: dto.regex,
                sort: dto.sort,
                enabled: dto.enabled,
            },
            include: { group: true },
        });
        await this.invalidateCache();
        return this.toFieldDto(f, f.group.name);
    }
    /**
     * 删除字段。默认只做停用（软删），因为硬删会连带删掉所有会员在这个字段上填的值。
     * 真要硬删得显式传 hard=true，并且会告诉你要删掉多少条数据。
     */
    async deleteField(id, hard = false) {
        const f = await this.prisma.fieldDef.findUnique({ where: { id } });
        if (!f)
            throw new common_1.NotFoundException('字段不存在');
        if (f.isCore)
            throw new all_exceptions_filter_1.BizException('内置核心字段不可删除，只能停用', 40014);
        const affected = await this.prisma.profileFieldValue.count({ where: { fieldCode: f.code } });
        if (!hard) {
            await this.prisma.fieldDef.update({ where: { id }, data: { enabled: false } });
        }
        else {
            // onDelete: Cascade 会自动清掉 ProfileFieldValue
            await this.prisma.fieldDef.delete({ where: { id } });
        }
        await this.invalidateCache();
        return { success: true, affectedValues: affected };
    }
    // ───────── 动态值校验 ─────────
    /**
     * 用字段定义校验一批动态值。返回清洗后的值（类型已转换）。
     * 这是动态表单的安全边界：前端传什么都可能，这里必须按定义收紧。
     */
    async validateAndNormalize(values, opts = { requireRequired: false }) {
        const fields = await this.getEnabledFields();
        const byCode = new Map(fields.map((f) => [f.code, f]));
        const normalized = {};
        const errors = [];
        for (const [code, raw] of Object.entries(values)) {
            const def = byCode.get(code);
            if (!def) {
                // 静默忽略未知字段，而不是报错——前端缓存了旧 schema 时不该整个提交失败
                this.logger.debug(`忽略未知字段 ${code}`);
                continue;
            }
            const r = this.normalizeOne(def, raw);
            if (r.error)
                errors.push(`${def.label}：${r.error}`);
            else if (r.value !== undefined)
                normalized[code] = r.value;
        }
        if (opts.requireRequired) {
            for (const f of fields) {
                if (!f.required)
                    continue;
                const v = normalized[f.code];
                if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) {
                    errors.push(`${f.label}：必填`);
                }
            }
        }
        return { normalized, errors };
    }
    normalizeOne(def, raw) {
        if (raw === null || raw === undefined || raw === '') {
            return { value: null };
        }
        switch (def.type) {
            case shared_1.FieldType.NUMBER: {
                const n = typeof raw === 'number' ? raw : Number(raw);
                if (!Number.isFinite(n))
                    return { error: '必须是数字' };
                if (def.minValue != null && n < def.minValue)
                    return { error: `不能小于 ${def.minValue}` };
                if (def.maxValue != null && n > def.maxValue)
                    return { error: `不能大于 ${def.maxValue}` };
                return { value: n };
            }
            case shared_1.FieldType.BOOLEAN:
                return { value: raw === true || raw === 'true' || raw === 1 || raw === '1' };
            case shared_1.FieldType.DATE: {
                const d = new Date(String(raw));
                if (Number.isNaN(d.getTime()))
                    return { error: '日期格式不正确' };
                return { value: d };
            }
            case shared_1.FieldType.SELECT: {
                const s = String(raw);
                const allowed = (def.options ?? []).map((o) => o.value);
                if (allowed.length && !allowed.includes(s))
                    return { error: `不是有效选项` };
                return { value: s };
            }
            case shared_1.FieldType.MULTI_SELECT: {
                const arr = Array.isArray(raw) ? raw.map(String) : [String(raw)];
                const allowed = new Set((def.options ?? []).map((o) => o.value));
                if (allowed.size) {
                    const bad = arr.filter((v) => !allowed.has(v));
                    if (bad.length)
                        return { error: `包含无效选项：${bad.join(', ')}` };
                }
                return { value: arr };
            }
            case shared_1.FieldType.RANGE: {
                const v = raw;
                if (typeof v !== 'object')
                    return { error: '区间格式不正确' };
                const min = v.min == null ? null : Number(v.min);
                const max = v.max == null ? null : Number(v.max);
                if (min != null && max != null && min > max)
                    return { error: '下限不能大于上限' };
                return { value: { min, max } };
            }
            case shared_1.FieldType.IMAGES: {
                const arr = Array.isArray(raw) ? raw.map(String) : [String(raw)];
                return { value: arr };
            }
            case shared_1.FieldType.REGION:
            case shared_1.FieldType.IMAGE:
            case shared_1.FieldType.TEXT:
            case shared_1.FieldType.TEXTAREA:
            default: {
                const s = String(raw);
                if (def.maxLength != null && s.length > def.maxLength) {
                    return { error: `不能超过 ${def.maxLength} 个字` };
                }
                if (def.regex) {
                    try {
                        if (!new RegExp(def.regex).test(s))
                            return { error: '格式不正确' };
                    }
                    catch {
                        this.logger.warn(`字段 ${def.code} 的正则无效：${def.regex}`);
                    }
                }
                return { value: s };
            }
        }
    }
    // ───────── 辅助 ─────────
    assertCoreCodeValid(code, isCore) {
        if (isCore && !FieldService_1.CORE_FIELD_CODES.has(code)) {
            throw new all_exceptions_filter_1.BizException(`isCore=true 的字段 code 必须是 Profile 上真实存在的列。可选：${[...FieldService_1.CORE_FIELD_CODES].join(', ')}`, 40015);
        }
    }
    assertOptionsPresent(type, options) {
        if ((type === shared_1.FieldType.SELECT || type === shared_1.FieldType.MULTI_SELECT) && !options?.length) {
            throw new all_exceptions_filter_1.BizException('单选/多选字段必须提供 options', 40016);
        }
    }
    toGroupDto(g, fields) {
        return {
            id: g.id,
            code: g.code,
            name: g.name,
            sort: g.sort,
            fields: fields.map((f) => this.toFieldDto(f, g.name)),
        };
    }
    toFieldDto(f, groupName) {
        return {
            id: f.id,
            code: f.code,
            label: f.label,
            type: f.type,
            groupId: f.groupId,
            groupName,
            options: f.options ?? null,
            placeholder: f.placeholder,
            helpText: f.helpText,
            required: f.required,
            visibility: f.visibility,
            isCore: f.isCore,
            isPreference: f.isPreference,
            weightKey: f.weightKey ?? null,
            minValue: f.minValue,
            maxValue: f.maxValue,
            maxLength: f.maxLength,
            regex: f.regex,
            sort: f.sort,
            enabled: f.enabled,
        };
    }
};
exports.FieldService = FieldService;
exports.FieldService = FieldService = FieldService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService])
], FieldService);
//# sourceMappingURL=field.service.js.map