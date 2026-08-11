import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LogAction, Public, RequirePermissions } from '@/common/decorators';
import { SystemService } from './system.service';
import {
  CreateSysUserDto,
  QueryLogDto,
  QueryUserDto,
  UpdateRolePermissionsDto,
  UpdateSysUserDto,
} from './dto/system.dto';

@ApiTags('系统管理')
@Controller('system')
export class SystemController {
  constructor(private readonly system: SystemService) {}

  // ── 用户 ──

  @Get('users')
  @RequirePermissions('system:user:list')
  @ApiOperation({ summary: '用户列表' })
  listUsers(@Query() query: QueryUserDto) {
    return this.system.listUsers(query);
  }

  @Post('users')
  @RequirePermissions('system:user:edit')
  @LogAction('系统管理', '新建后台账号')
  @ApiOperation({ summary: '新建后台账号' })
  createUser(@Body() dto: CreateSysUserDto) {
    return this.system.createUser(dto);
  }

  @Put('users/:id')
  @RequirePermissions('system:user:edit')
  @LogAction('系统管理', '修改用户')
  @ApiOperation({ summary: '修改用户（角色/状态/重置密码）' })
  updateUser(@Param('id') id: string, @Body() dto: UpdateSysUserDto) {
    return this.system.updateUser(id, dto);
  }

  // ── 角色权限 ──

  @Get('roles')
  @RequirePermissions('system:role:list')
  @ApiOperation({ summary: '角色列表（含已授权限）' })
  listRoles() {
    return this.system.listRoles();
  }

  @Get('permissions')
  @RequirePermissions('system:role:list')
  @ApiOperation({ summary: '权限点（按模块分组，前端渲染权限树）' })
  listPermissions() {
    return this.system.listPermissions();
  }

  @Put('roles/:id/permissions')
  @RequirePermissions('system:role:edit')
  @LogAction('系统管理', '修改角色权限')
  @ApiOperation({ summary: '设置角色权限（改完该角色用户立即生效）' })
  updateRolePermissions(@Param('id') id: string, @Body() dto: UpdateRolePermissionsDto) {
    return this.system.updateRolePermissions(id, dto);
  }

  // ── 日志 ──

  @Get('logs')
  @RequirePermissions('system:log:list')
  @ApiOperation({ summary: '操作日志' })
  listLogs(@Query() query: QueryLogDto) {
    return this.system.listLogs(query);
  }

  // ── 字典 ──

  @Get('dicts')
  @ApiOperation({ summary: '全部字典' })
  listDicts() {
    return this.system.listDictTypes();
  }

  @Public()
  @Get('dicts/:code')
  @ApiOperation({ summary: '按 code 取字典' })
  getDict(@Param('code') code: string) {
    return this.system.getDict(code);
  }

  // ── 行政区划 ──

  @Public()
  @Get('regions')
  @ApiOperation({ summary: '行政区划（不传 parentCode 返回省份）' })
  regions(@Query('parentCode') parentCode?: string, @Query('level') level?: string) {
    return this.system.regions(parentCode, level ? Number(level) : undefined);
  }

  @Public()
  @Get('regions/tree')
  @ApiOperation({ summary: '行政区划树（级联选择器用）' })
  regionTree() {
    return this.system.regionTree();
  }
}
