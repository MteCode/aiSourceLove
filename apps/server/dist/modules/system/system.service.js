"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemService = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = __importStar(require("bcryptjs"));
const shared_1 = require("@yuanqiao/shared");
const all_exceptions_filter_1 = require("../../common/filters/all-exceptions.filter");
const pagination_dto_1 = require("../../common/dto/pagination.dto");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
const user_context_service_1 = require("../auth/user-context.service");
let SystemService = class SystemService {
    prisma;
    userContext;
    constructor(prisma, userContext) {
        this.prisma = prisma;
        this.userContext = userContext;
    }
    // ───────── 用户 ─────────
    async listUsers(query) {
        const where = { deletedAt: null };
        if (query.status)
            where.status = query.status;
        if (query.keyword?.trim()) {
            const kw = query.keyword.trim();
            where.OR = [{ phone: { contains: kw } }, { nickname: { contains: kw } }];
        }
        if (query.roleCode)
            where.roles = { some: { role: { code: query.roleCode } } };
        const [rows, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: query.skip,
                take: query.take,
                select: {
                    id: true, phone: true, nickname: true, avatar: true, status: true,
                    isVip: true, vipExpireAt: true, lastLoginAt: true, createdAt: true,
                    roles: { select: { role: { select: { code: true, name: true } } } },
                    profile: { select: { id: true, serialNo: true, status: true } },
                },
            }),
            this.prisma.user.count({ where }),
        ]);
        return (0, pagination_dto_1.buildPageResult)(rows.map((u) => ({ ...u, roles: u.roles.map((r) => r.role) })), total, query.page, query.pageSize);
    }
    /** 后台建账号（管理员/审核员）。C 端用户走短信注册，不用这个。 */
    async createUser(dto) {
        const exists = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
        if (exists)
            throw new all_exceptions_filter_1.BizException('该手机号已注册', 40930);
        const roles = await this.prisma.role.findMany({ where: { code: { in: dto.roleCodes } } });
        if (roles.length !== dto.roleCodes.length) {
            throw new all_exceptions_filter_1.BizException('存在无效的角色编码', 40080);
        }
        const user = await this.prisma.user.create({
            data: {
                phone: dto.phone,
                nickname: dto.nickname,
                passwordHash: await bcrypt.hash(dto.password, 10),
                roles: { create: roles.map((r) => ({ roleId: r.id })) },
            },
            select: { id: true, phone: true, nickname: true },
        });
        return user;
    }
    async updateUser(id, dto) {
        const user = await this.prisma.user.findUnique({ where: { id }, include: { roles: true } });
        if (!user)
            throw new common_1.NotFoundException('用户不存在');
        await this.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id },
                data: {
                    nickname: dto.nickname,
                    status: dto.status,
                    ...(dto.password ? { passwordHash: await bcrypt.hash(dto.password, 10) } : {}),
                },
            });
            if (dto.roleCodes) {
                const roles = await tx.role.findMany({ where: { code: { in: dto.roleCodes } } });
                // 超管角色不允许通过这个接口授予，避免越权提升
                if (roles.some((r) => r.code === shared_1.RoleCode.SUPER_ADMIN)) {
                    throw new all_exceptions_filter_1.BizException('超级管理员角色不可通过此接口分配', 40331);
                }
                await tx.userRole.deleteMany({
                    where: { userId: id, role: { code: { not: shared_1.RoleCode.SUPER_ADMIN } } },
                });
                await tx.userRole.createMany({
                    data: roles.map((r) => ({ userId: id, roleId: r.id })),
                    skipDuplicates: true,
                });
            }
        });
        await this.userContext.invalidate(id);
        return { success: true };
    }
    // ───────── 角色与权限 ─────────
    async listRoles() {
        return this.prisma.role.findMany({
            orderBy: { sort: 'asc' },
            include: {
                permissions: { include: { permission: true } },
                _count: { select: { users: true } },
            },
        });
    }
    async listPermissions() {
        const rows = await this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { sort: 'asc' }] });
        // 按模块分组，前端直接渲染权限树
        const byModule = new Map();
        for (const p of rows) {
            const list = byModule.get(p.module) ?? [];
            list.push(p);
            byModule.set(p.module, list);
        }
        return [...byModule.entries()].map(([module, permissions]) => ({ module, permissions }));
    }
    async updateRolePermissions(roleId, dto) {
        const role = await this.prisma.role.findUnique({ where: { id: roleId } });
        if (!role)
            throw new common_1.NotFoundException('角色不存在');
        if (role.code === shared_1.RoleCode.SUPER_ADMIN) {
            throw new all_exceptions_filter_1.BizException('超级管理员权限固定为全部，不可修改', 40332);
        }
        const perms = await this.prisma.permission.findMany({
            where: { code: { in: dto.permissionCodes } },
            select: { id: true },
        });
        await this.prisma.$transaction([
            this.prisma.rolePermission.deleteMany({ where: { roleId } }),
            this.prisma.rolePermission.createMany({
                data: perms.map((p) => ({ roleId, permissionId: p.id })),
                skipDuplicates: true,
            }),
        ]);
        // 该角色下所有用户的权限缓存都要刷
        const users = await this.prisma.userRole.findMany({ where: { roleId }, select: { userId: true } });
        await Promise.all(users.map((u) => this.userContext.invalidate(u.userId)));
        return { success: true, affectedUsers: users.length };
    }
    // ───────── 操作日志 ─────────
    async listLogs(query) {
        const where = {};
        if (query.module)
            where.module = query.module;
        if (query.success != null)
            where.success = query.success;
        if (query.keyword?.trim()) {
            const kw = query.keyword.trim();
            where.OR = [{ username: { contains: kw } }, { action: { contains: kw } }, { path: { contains: kw } }];
        }
        if (query.startDate || query.endDate) {
            where.createdAt = {
                ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
                ...(query.endDate ? { lte: new Date(`${query.endDate}T23:59:59`) } : {}),
            };
        }
        const [rows, total] = await Promise.all([
            this.prisma.operationLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: query.skip,
                take: query.take,
            }),
            this.prisma.operationLog.count({ where }),
        ]);
        return (0, pagination_dto_1.buildPageResult)(rows, total, query.page, query.pageSize);
    }
    /** 清理 N 天前的日志，由定时任务调用 */
    async pruneLogs(days = 90) {
        const r = await this.prisma.operationLog.deleteMany({
            where: { createdAt: { lt: new Date(Date.now() - days * 86400_000) } },
        });
        return r.count;
    }
    // ───────── 字典 ─────────
    async listDictTypes() {
        return this.prisma.dictType.findMany({
            orderBy: { code: 'asc' },
            include: { items: { where: { enabled: true }, orderBy: { sort: 'asc' } } },
        });
    }
    async getDict(code) {
        const t = await this.prisma.dictType.findUnique({
            where: { code },
            include: { items: { where: { enabled: true }, orderBy: { sort: 'asc' } } },
        });
        if (!t)
            throw new common_1.NotFoundException(`字典 ${code} 不存在`);
        return t;
    }
    // ───────── 行政区划 ─────────
    /** 省市区。level=1 取省份，parentCode 取下级。 */
    async regions(parentCode, level) {
        return this.prisma.region.findMany({
            where: {
                ...(parentCode ? { parentCode } : {}),
                ...(level ? { level } : parentCode ? {} : { level: 1 }),
            },
            orderBy: [{ sort: 'asc' }, { code: 'asc' }],
        });
    }
    /** 整棵树，前端级联选择器一次拿完（数据量不大时比逐级请求体验好） */
    async regionTree() {
        const all = await this.prisma.region.findMany({ orderBy: [{ sort: 'asc' }, { code: 'asc' }] });
        const byParent = new Map();
        for (const r of all) {
            const key = r.parentCode ?? '__root__';
            const list = byParent.get(key) ?? [];
            list.push(r);
            byParent.set(key, list);
        }
        const build = (code) => (byParent.get(code) ?? []).map((r) => ({
            value: r.code,
            label: r.name,
            children: byParent.has(r.code) ? build(r.code) : undefined,
        }));
        return build('__root__');
    }
};
exports.SystemService = SystemService;
exports.SystemService = SystemService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        user_context_service_1.UserContextService])
], SystemService);
//# sourceMappingURL=system.service.js.map