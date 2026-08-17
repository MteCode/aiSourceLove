import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProfileStatus, RoleCode } from '@yuanqiao/shared';
import {
  CurrentUser,
  LogAction,
  OptionalAuth,
  RequirePermissions,
  RequireRoles,
} from '@/common/decorators';
import type { AuthUser } from '@/common/types/auth-user';
import { isAdminUser } from '@/common/types/auth-user';
import { MatchmakerService } from '@/modules/matchmaker/matchmaker.service';
import { PrivacyService } from '@/modules/privacy/privacy.service';
import { ProfileService } from './profile.service';
import {
  AuditPhotoDto,
  AuditProfileDto,
  ClaimProfileDto,
  MatchmakerCreateProfileDto,
  QueryProfileDto,
  UpsertProfileDto,
  AdminUpdateProfileDto,
  PreferenceInputDto,
} from './dto/profile.dto';

@ApiTags('会员档案')
@Controller('profiles')
export class ProfileController {
  constructor(
    private readonly profile: ProfileService,
    private readonly privacy: PrivacyService,
    private readonly matchmaker: MatchmakerService,
  ) {}

  // ───────── 我的档案 ─────────

  @Get('me')
  @ApiOperation({ summary: '我的档案' })
  async me(@CurrentUser() user: AuthUser) {
    if (!user.profileId) return null;
    return this.profile.toDto(user.profileId, user);
  }

  @Put('me')
  @LogAction('会员档案', '填写/修改自己的档案')
  @ApiOperation({ summary: '创建或更新我的档案（改关键字段会自动重新送审）' })
  upsertMe(@CurrentUser() user: AuthUser, @Body() dto: UpsertProfileDto) {
    return this.profile.upsertSelf(user.userId, dto, user);
  }

  @Put('me/preference')
  @LogAction('会员档案', '修改择偶要求')
  @ApiOperation({
    summary: '只更新择偶要求',
    description: '与档案本体分开：走 upsertMe 会因为性别/生日/城市必填而被拦下。',
  })
  upsertPreference(@CurrentUser() user: AuthUser, @Body() dto: PreferenceInputDto) {
    return this.profile.upsertPreference(user.userId, dto, user);
  }

  @Post('me/submit')
  @LogAction('会员档案', '提交审核')
  @ApiOperation({ summary: '提交审核' })
  async submitMe(@CurrentUser() user: AuthUser) {
    if (!user.profileId) throw new BadRequestException('请先填写档案');
    await this.profile.submit(user.profileId, {
      id: user.userId,
      name: user.nickname ?? user.phone,
    });
    return this.profile.toDto(user.profileId, user);
  }

  @Post('me/claim')
  @LogAction('会员档案', '认领档案')
  @ApiOperation({ summary: '用编号认领红娘代录的档案' })
  claim(@CurrentUser('userId') userId: string, @Body() dto: ClaimProfileDto) {
    return this.profile.claim(userId, dto.serialNo);
  }

  @Get('me/audit-logs')
  @ApiOperation({ summary: '我的审核记录（看驳回理由）' })
  async myAuditLogs(@CurrentUser() user: AuthUser) {
    if (!user.profileId) return [];
    return this.profile.getAuditLogs(user.profileId);
  }

  @Get('me/visitors')
  @ApiOperation({ summary: '谁看过我' })
  async visitors(@CurrentUser() user: AuthUser) {
    if (!user.profileId) return [];
    if (!user.isVip) {
      throw new ForbiddenException('「谁看过我」是 VIP 专属功能');
    }
    return this.privacy.listVisitors(user.profileId);
  }

  // ───────── 广场 / 详情 ─────────

  @OptionalAuth()
  @Get('square')
  @ApiOperation({ summary: '会员广场（游客可见，按等级脱敏）' })
  square(@Query() query: QueryProfileDto, @CurrentUser() user: AuthUser | null) {
    return this.profile.listPublic(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: '档案详情（会计入每日查看配额）' })
  detail(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.profile.viewDetail(id, user);
  }

  @Post(':id/unlock-contact')
  @LogAction('隐私', '解锁联系方式')
  @ApiOperation({ summary: '消耗权益解锁对方联系方式（幂等，重复点不重复扣）' })
  unlock(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.privacy.unlockContact(userId, id);
  }

  // ───────── 照片 ─────────

  @Post('me/photos')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @LogAction('会员档案', '上传照片')
  @ApiOperation({ summary: '上传照片（服务端同步生成打码图）' })
  async uploadPhoto(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
    @Query('primary') primary?: string,
  ) {
    if (!file) throw new BadRequestException('请选择要上传的文件');
    if (!user.profileId) throw new BadRequestException('请先填写档案');
    return this.profile.addPhoto(user.profileId, file, primary === 'true');
  }

  @Delete('photos/:photoId')
  @LogAction('会员档案', '删除照片')
  @ApiOperation({ summary: '删除照片' })
  deletePhoto(@Param('photoId') photoId: string, @CurrentUser() user: AuthUser) {
    return this.profile.deletePhoto(photoId, user.profileId, isAdminUser(user));
  }

  @Put('photos/:photoId/primary')
  @ApiOperation({ summary: '设为主图' })
  setPrimary(@Param('photoId') photoId: string) {
    return this.profile.setPrimaryPhoto(photoId);
  }

  @Put('photos/:photoId/audit')
  @RequirePermissions('profile:audit')
  @LogAction('审核', '审核照片')
  @ApiOperation({ summary: '审核照片' })
  auditPhoto(@Param('photoId') photoId: string, @Body() dto: AuditPhotoDto) {
    return this.profile.auditPhoto(photoId, dto);
  }
}

@ApiTags('会员档案 / 后台与红娘')
@Controller('admin/profiles')
export class AdminProfileController {
  constructor(
    private readonly profile: ProfileService,
    private readonly matchmaker: MatchmakerService,
  ) {}

  @Get()
  @ApiOperation({ summary: '会员列表（管理员看全部 / 红娘看名下+已通过）' })
  list(@Query() query: QueryProfileDto, @CurrentUser() user: AuthUser) {
    return this.profile.list(query, user);
  }

  @Get('pending-count')
  @RequirePermissions('profile:audit')
  @ApiOperation({ summary: '待审数量（后台角标）' })
  async pendingCount(@CurrentUser() user: AuthUser) {
    const [profiles, photos] = await Promise.all([
      this.profile.list(
        Object.assign(new QueryProfileDto(), { status: ProfileStatus.PENDING, page: 1, pageSize: 1 }),
        user,
      ),
      this.profile.list(
        Object.assign(new QueryProfileDto(), { hasPendingPhoto: true, page: 1, pageSize: 1 }),
        user,
      ),
    ]);
    return { profilePending: profiles.total, photoPending: photos.total };
  }

  @Get(':id')
  @ApiOperation({ summary: '档案详情（后台，不扣查看配额）' })
  detail(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.profile.toDto(id, user);
  }

  @Put(':id')
  @RequirePermissions('profile:edit')
  @LogAction('会员档案', '后台修改档案')
  @ApiOperation({
    summary: '后台修改档案',
    description: '主要用于补录真实姓名、联系方式这类会员端不填、只有红娘掌握的信息。',
  })
  updateByAdmin(
    @Param('id') id: string,
    @Body() dto: AdminUpdateProfileDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.profile.updateByAdmin(id, dto, user);
  }

  @Get(':id/audit-logs')
  @ApiOperation({ summary: '审核流水' })
  auditLogs(@Param('id') id: string) {
    return this.profile.getAuditLogs(id);
  }

  @Post('by-matchmaker')
  @RequireRoles(RoleCode.MATCHMAKER)
  @LogAction('会员档案', '红娘代录')
  @ApiOperation({
    summary: '红娘代录档案',
    description: '线下地推收上来的资料先录进系统，本人之后用编号认领。不需要对方已注册。',
  })
  async createByMatchmaker(
    @CurrentUser() user: AuthUser,
    @Body() dto: MatchmakerCreateProfileDto,
  ) {
    const mmId = await this.matchmaker.requireMatchmakerId(user.userId);
    return this.profile.createByMatchmaker(mmId, dto, {
      id: user.userId,
      name: user.nickname ?? user.phone,
      viewer: user,
    });
  }

  @Put(':id/audit')
  @RequirePermissions('profile:audit')
  @LogAction('审核', '审核档案')
  @ApiOperation({ summary: '审核档案（走状态机校验，驳回必须填理由）' })
  async audit(
    @Param('id') id: string,
    @Body() dto: AuditProfileDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.profile.audit(id, dto, { id: user.userId, name: user.nickname ?? user.phone });
    return this.profile.toDto(id, user);
  }

  @Put(':id/matchmaker')
  @RequirePermissions('profile:edit')
  @LogAction('会员档案', '调整归属红娘')
  @ApiOperation({ summary: '调整归属红娘' })
  assign(@Param('id') id: string, @Body('matchmakerId') matchmakerId: string | null) {
    return this.profile.assignMatchmaker(id, matchmakerId);
  }

  @Delete(':id')
  @RequirePermissions('profile:delete')
  @LogAction('会员档案', '删除档案')
  @ApiOperation({ summary: '删除档案（软删）' })
  remove(@Param('id') id: string) {
    return this.profile.remove(id);
  }
}
