import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FieldDefDto, FieldGroupDto, FormSchemaDto } from '@yuanqiao/shared';
import { LogAction, OptionalAuth, RequirePermissions } from '@/common/decorators';
import { FieldService } from './field.service';
import {
  CreateFieldDefDto,
  CreateFieldGroupDto,
  UpdateFieldDefDto,
  UpdateFieldGroupDto,
} from './dto/field.dto';

@ApiTags('字段字典 / 动态表单')
@Controller('fields')
export class FieldController {
  constructor(private readonly field: FieldService) {}

  // ── 前端渲染用 ──

  @OptionalAuth()
  @Get('schema')
  @ApiOperation({ summary: '获取档案录入表单 schema' })
  getSchema(): Promise<FormSchemaDto> {
    return this.field.getFormSchema();
  }

  @OptionalAuth()
  @Get('schema/preference')
  @ApiOperation({ summary: '获取择偶要求表单 schema' })
  getPreferenceSchema(): Promise<FormSchemaDto> {
    return this.field.getPreferenceSchema();
  }

  // ── 后台配置 ──

  @Get('groups')
  @RequirePermissions('field:list')
  @ApiOperation({ summary: '字段分组列表（含字段）' })
  listGroups(): Promise<FieldGroupDto[]> {
    return this.field.listGroups();
  }

  @Post('groups')
  @RequirePermissions('field:edit')
  @LogAction('字段字典', '新建分组')
  @ApiOperation({ summary: '新建字段分组' })
  createGroup(@Body() dto: CreateFieldGroupDto): Promise<FieldGroupDto> {
    return this.field.createGroup(dto);
  }

  @Put('groups/:id')
  @RequirePermissions('field:edit')
  @LogAction('字段字典', '修改分组')
  @ApiOperation({ summary: '修改字段分组' })
  updateGroup(@Param('id') id: string, @Body() dto: UpdateFieldGroupDto): Promise<FieldGroupDto> {
    return this.field.updateGroup(id, dto);
  }

  @Delete('groups/:id')
  @RequirePermissions('field:edit')
  @LogAction('字段字典', '删除分组')
  @ApiOperation({ summary: '删除字段分组' })
  deleteGroup(@Param('id') id: string) {
    return this.field.deleteGroup(id);
  }

  @Post()
  @RequirePermissions('field:edit')
  @LogAction('字段字典', '新建字段')
  @ApiOperation({ summary: '新建字段（运营加字段不用发版）' })
  createField(@Body() dto: CreateFieldDefDto): Promise<FieldDefDto> {
    return this.field.createField(dto);
  }

  @Put(':id')
  @RequirePermissions('field:edit')
  @LogAction('字段字典', '修改字段')
  @ApiOperation({ summary: '修改字段' })
  updateField(@Param('id') id: string, @Body() dto: UpdateFieldDefDto): Promise<FieldDefDto> {
    return this.field.updateField(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('field:edit')
  @LogAction('字段字典', '删除字段')
  @ApiOperation({ summary: '删除字段（默认软删=停用，hard=true 才真删）' })
  deleteField(@Param('id') id: string, @Query('hard') hard?: string) {
    return this.field.deleteField(id, hard === 'true');
  }
}
