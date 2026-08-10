import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  DEFAULT_MATCH_WEIGHTS,
  MATCH_WEIGHT_LABEL,
  MatchResultDto,
  PageResult,
} from '@yuanqiao/shared';
import { CurrentUser, LogAction } from '@/common/decorators';
import type { AuthUser } from '@/common/types/auth-user';
import { MatchQueryDto, ScorePairDto } from './dto/match.dto';
import { MatchService } from './match.service';

@ApiTags('匹配引擎')
@Controller('match')
export class MatchController {
  constructor(private readonly match: MatchService) {}

  @Get()
  @ApiOperation({
    summary: '三层匹配推荐',
    description:
      'L1 SQL 硬过滤 → L2 双向加权打分 → L3 AI 语义匹配（enableAi=true 时开启，消耗权益）',
  })
  run(@Query() query: MatchQueryDto, @CurrentUser() user: AuthUser): Promise<PageResult<MatchResultDto>> {
    return this.match.run(query, user);
  }

  @Post('score-pair')
  @ApiOperation({ summary: '给指定两人打分（红娘牵线前看契合度）' })
  scorePair(@Body() dto: ScorePairDto) {
    return this.match.scorePair(dto.aProfileId, dto.bProfileId);
  }

  @Get('weights')
  @ApiOperation({ summary: '获取默认权重配置（后台调参页展示）' })
  weights() {
    return Object.entries(DEFAULT_MATCH_WEIGHTS).map(([key, value]) => ({
      key,
      label: MATCH_WEIGHT_LABEL[key as keyof typeof MATCH_WEIGHT_LABEL],
      value,
    }));
  }

  @Post('preview')
  @LogAction('匹配引擎', '权重调参预览')
  @ApiOperation({ summary: '用自定义权重预览匹配结果（后台调参）' })
  preview(@Body() dto: MatchQueryDto, @CurrentUser() user: AuthUser) {
    return this.match.run(dto, user);
  }
}
