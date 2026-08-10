import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@yuanqiao/shared';
import { CurrentUser, LogAction, RequirePermissions, RequireRoles } from '@/common/decorators';
import { PaginationDto } from '@/common/dto/pagination.dto';
import type { AuthUser } from '@/common/types/auth-user';
import { CommissionService } from './commission.service';
import { IntroductionService } from './introduction.service';
import { MatchmakerService } from './matchmaker.service';
import {
  AdvanceIntroductionDto,
  AgreeIntroductionDto,
  ApplyMatchmakerDto,
  CreateIntroductionDto,
  CreateWithdrawalDto,
  QueryCommissionDto,
  QueryIntroductionDto,
  QueryMatchmakerDto,
  QueryWithdrawalDto,
  ReviewMatchmakerDto,
  ReviewWithdrawalDto,
} from './dto/matchmaker.dto';

@ApiTags('红娘系统')
@Controller('matchmakers')
export class MatchmakerController {
  constructor(
    private readonly matchmaker: MatchmakerService,
    private readonly introduction: IntroductionService,
    private readonly commission: CommissionService,
  ) {}

  // ───────── 入驻 ─────────

  @Post('apply')
  @LogAction('红娘', '提交入驻申请')
  @ApiOperation({ summary: '申请成为红娘' })
  apply(@CurrentUser('userId') userId: string, @Body() dto: ApplyMatchmakerDto) {
    return this.matchmaker.apply(userId, dto);
  }

  @Get('me')
  @ApiOperation({ summary: '我的红娘信息' })
  async me(@CurrentUser('userId') userId: string) {
    const mm = await this.matchmaker.findByUserId(userId);
    return mm ? this.matchmaker.toDto(mm.id) : null;
  }

  @Get('me/stats')
  @RequireRoles(RoleCode.MATCHMAKER)
  @ApiOperation({ summary: '我的业绩看板（含牵线漏斗）' })
  async myStats(@CurrentUser('userId') userId: string) {
    const id = await this.matchmaker.requireMatchmakerId(userId);
    return this.matchmaker.stats(id);
  }

  @Get('me/members')
  @RequireRoles(RoleCode.MATCHMAKER)
  @ApiOperation({ summary: '我名下的会员' })
  async myMembers(@CurrentUser('userId') userId: string, @Query() page: PaginationDto) {
    const id = await this.matchmaker.requireMatchmakerId(userId);
    return this.matchmaker.members(id, page.page, page.pageSize);
  }

  // ───────── 后台管理 ─────────

  @Get()
  @RequirePermissions('matchmaker:list')
  @ApiOperation({ summary: '红娘列表' })
  list(@Query() query: QueryMatchmakerDto) {
    return this.matchmaker.list(query);
  }

  @Get(':id')
  @RequirePermissions('matchmaker:list')
  @ApiOperation({ summary: '红娘详情' })
  detail(@Param('id') id: string) {
    return this.matchmaker.toDto(id);
  }

  @Get(':id/stats')
  @RequirePermissions('matchmaker:list')
  @ApiOperation({ summary: '红娘业绩' })
  stats(@Param('id') id: string) {
    return this.matchmaker.stats(id);
  }

  @Put(':id/review')
  @RequirePermissions('matchmaker:review')
  @LogAction('红娘', '审核入驻')
  @ApiOperation({ summary: '审核红娘入驻 / 调整分润比例' })
  review(@Param('id') id: string, @Body() dto: ReviewMatchmakerDto) {
    return this.matchmaker.review(id, dto);
  }
}

@ApiTags('红娘系统 / 牵线')
@Controller('introductions')
export class IntroductionController {
  constructor(
    private readonly introduction: IntroductionService,
    private readonly matchmaker: MatchmakerService,
  ) {}

  @Post()
  @RequireRoles(RoleCode.MATCHMAKER)
  @LogAction('牵线', '发起牵线')
  @ApiOperation({ summary: '发起牵线' })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateIntroductionDto) {
    const mmId = await this.matchmaker.requireMatchmakerId(user.userId);
    return this.introduction.create(mmId, dto, {
      id: user.userId,
      name: user.nickname ?? user.phone,
    });
  }

  @Get()
  @ApiOperation({ summary: '牵线列表（管理员看全部 / 红娘看自己的 / 会员看参与的）' })
  list(@Query() query: QueryIntroductionDto, @CurrentUser() user: AuthUser) {
    return this.introduction.list(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: '牵线详情（含完整事件流水）' })
  detail(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.introduction.toDto(id, user);
  }

  @Put(':id/advance')
  @LogAction('牵线', '推进状态')
  @ApiOperation({
    summary: '推进牵线状态',
    description: '走状态机校验。→CONTACT_EXCHANGED 会自动解锁双方联系方式；→SUCCESS 会记红娘分润。',
  })
  advance(
    @Param('id') id: string,
    @Body() dto: AdvanceIntroductionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.introduction.advance(
      id,
      dto,
      { id: user.userId, name: user.nickname ?? user.phone },
      user,
    );
  }

  @Put(':id/agree')
  @LogAction('牵线', '当事人表态')
  @ApiOperation({ summary: '当事人同意/婉拒（只能本人操作，红娘不能代点）' })
  agree(@Param('id') id: string, @Body() dto: AgreeIntroductionDto, @CurrentUser() user: AuthUser) {
    return this.introduction.agree(id, dto, user);
  }
}

@ApiTags('红娘系统 / 分润提现')
@Controller('commissions')
export class CommissionController {
  constructor(
    private readonly commission: CommissionService,
    private readonly matchmaker: MatchmakerService,
  ) {}

  @Get('me')
  @RequireRoles(RoleCode.MATCHMAKER)
  @ApiOperation({ summary: '我的分润记录' })
  async mine(@CurrentUser('userId') userId: string, @Query() query: QueryCommissionDto) {
    const id = await this.matchmaker.requireMatchmakerId(userId);
    return this.commission.listCommissions({ ...query, matchmakerId: id } as QueryCommissionDto);
  }

  @Get()
  @RequirePermissions('commission:list')
  @ApiOperation({ summary: '分润记录（后台）' })
  list(@Query() query: QueryCommissionDto) {
    return this.commission.listCommissions(query);
  }

  @Post('withdrawals')
  @RequireRoles(RoleCode.MATCHMAKER)
  @LogAction('提现', '发起提现')
  @ApiOperation({ summary: '发起提现' })
  async withdraw(@CurrentUser('userId') userId: string, @Body() dto: CreateWithdrawalDto) {
    const id = await this.matchmaker.requireMatchmakerId(userId);
    return this.commission.createWithdrawal(id, dto);
  }

  @Get('withdrawals')
  @ApiOperation({ summary: '提现单列表' })
  async listWithdrawals(@Query() query: QueryWithdrawalDto, @CurrentUser() user: AuthUser) {
    // 红娘只能看自己的
    if (user.matchmakerId && !user.permissions.includes('withdrawal:list')) {
      return this.commission.listWithdrawals({
        ...query,
        matchmakerId: user.matchmakerId,
      } as QueryWithdrawalDto);
    }
    return this.commission.listWithdrawals(query);
  }

  @Put('withdrawals/:id/review')
  @RequirePermissions('withdrawal:review')
  @LogAction('提现', '审核提现')
  @ApiOperation({ summary: '审核提现（拒绝会把钱退回余额）' })
  reviewWithdrawal(
    @Param('id') id: string,
    @Body() dto: ReviewWithdrawalDto,
    @CurrentUser('userId') operatorId: string,
  ) {
    return this.commission.reviewWithdrawal(id, dto, operatorId);
  }

  @Post('settle')
  @RequirePermissions('commission:settle')
  @LogAction('分润', '手动结算')
  @ApiOperation({ summary: '手动触发结算（把过冷静期的分润转为可提现）' })
  settle() {
    return this.commission.settleDue();
  }
}
