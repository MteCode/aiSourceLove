import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PageResult, RoleCode } from '@yuanqiao/shared';
import { BizException } from '@/common/filters/all-exceptions.filter';
import { buildPageResult } from '@/common/dto/pagination.dto';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { UserContextService } from '@/modules/auth/user-context.service';
import {
  CreateSysUserDto,
  QueryLogDto,
  QueryUserDto,
  UpdateRolePermissionsDto,
  UpdateSysUserDto,
} from './dto/system.dto';

@Injectable()
export class SystemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContext: UserContextService,
  ) {}

  // ───────── 用户 ─────────

  async listUsers(query: QueryUserDto): Promise<PageResult<unknown>> {
    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.keyword?.trim()) {
      const kw = query.keyword.trim();
      where.OR = [{ phone: { contains: kw } }, { nickname: { contains: kw } }];
    }
    if (query.roleCode) where.roles = { some: { role: { code: query.roleCode } } };

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

    return buildPageResult(
      rows.map((u) => ({ ...u, roles: u.roles.map((r) => r.role) })),
      total,
      query.page,
      query.pageSize,
    );
  }

  /** 后台建账号（管理员/审核员）。C 端用户走短信注册，不用这个。 */
  async createUser(dto: CreateSysUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (exists) throw new BizException('该手机号已注册', 40930);

    const roles = await this.prisma.role.findMany({ where: { code: { in: dto.roleCodes } } });
    if (roles.length !== dto.roleCodes.length) {
      throw new BizException('存在无效的角色编码', 40080);
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

  async updateUser(id: string, dto: UpdateSysUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: { roles: true } });
    if (!user) throw new NotFoundException('用户不存在');

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
        if (roles.some((r) => r.code === RoleCode.SUPER_ADMIN)) {
          throw new BizException('超级管理员角色不可通过此接口分配', 40331);
        }
        await tx.userRole.deleteMany({
          where: { userId: id, role: { code: { not: RoleCode.SUPER_ADMIN } } },
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
    const byModule = new Map<string, typeof rows>();
    for (const p of rows) {
      const list = byModule.get(p.module) ?? [];
      list.push(p);
      byModule.set(p.module, list);
    }
    return [...byModule.entries()].map(([module, permissions]) => ({ module, permissions }));
  }

  async updateRolePermissions(roleId: string, dto: UpdateRolePermissionsDto) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('角色不存在');
    if (role.code === RoleCode.SUPER_ADMIN) {
      throw new BizException('超级管理员权限固定为全部，不可修改', 40332);
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

  async listLogs(query: QueryLogDto): Promise<PageResult<unknown>> {
    const where: Prisma.OperationLogWhereInput = {};
    if (query.module) where.module = query.module;
    if (query.success != null) where.success = query.success;
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
    return buildPageResult(rows, total, query.page, query.pageSize);
  }

  /** 清理 N 天前的日志，由定时任务调用 */
  async pruneLogs(days = 90): Promise<number> {
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

  async getDict(code: string) {
    const t = await this.prisma.dictType.findUnique({
      where: { code },
      include: { items: { where: { enabled: true }, orderBy: { sort: 'asc' } } },
    });
    if (!t) throw new NotFoundException(`字典 ${code} 不存在`);
    return t;
  }

  // ───────── 行政区划 ─────────

  /** 省市区。level=1 取省份，parentCode 取下级。 */
  async regions(parentCode?: string, level?: number) {
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
    const byParent = new Map<string, typeof all>();
    for (const r of all) {
      const key = r.parentCode ?? '__root__';
      const list = byParent.get(key) ?? [];
      list.push(r);
      byParent.set(key, list);
    }
    const build = (code: string): unknown[] =>
      (byParent.get(code) ?? []).map((r) => ({
        value: r.code,
        label: r.name,
        children: byParent.has(r.code) ? build(r.code) : undefined,
      }));
    return build('__root__');
  }
  // ── 管理员邀请码 ──
  //
  // 用途：区分注册来路。带这个码注册的人才允许申请成为红娘，
  // 红娘自己分享出去的人只能是客户。

  async listInvites() {
    return this.prisma.adminInvite.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async createInvite(input: { remark?: string; expiresInDays?: number; maxUses?: number }, operatorId: string) {
    // 短码：去掉 0/O/1/I 这类形近字符，运营要口头念给人听
    const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 8; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];

    return this.prisma.adminInvite.create({
      data: {
        code,
        remark: input.remark ?? null,
        createdBy: operatorId,
        expiresAt: input.expiresInDays
          ? new Date(Date.now() + input.expiresInDays * 24 * 3600 * 1000)
          : null,
        maxUses: input.maxUses ?? 0,
      },
    });
  }

  /// 停用而不是删除：已经发出去的码要留痕，出问题能追是哪一批
  async disableInvite(id: string) {
    const inv = await this.prisma.adminInvite.findUnique({ where: { id } });
    if (!inv) throw new NotFoundException('邀请码不存在');
    return this.prisma.adminInvite.update({ where: { id }, data: { enabled: false } });
  }

}
