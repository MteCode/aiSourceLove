import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CommissionStatus, IntroductionStatus, MatchmakerStatus, WithdrawalStatus } from '@yuanqiao/shared';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class ApplyMatchmakerDto {
  @ApiProperty({ example: '王红娘' })
  @IsString() @IsNotEmpty() @MaxLength(50)
  name!: string;

  @ApiProperty({ example: '13800138000' })
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(12)
  cityCode?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50)
  cityName?: string;

  @ApiPropertyOptional({ description: '个人简介' })
  @IsOptional() @IsString() @MaxLength(1000)
  bio?: string;

  @ApiPropertyOptional({ type: [String], description: '入驻材料图片地址' })
  @IsOptional() @IsArray() @IsString({ each: true })
  certImages?: string[];
}

export class ReviewMatchmakerDto {
  @ApiProperty({ enum: MatchmakerStatus })
  @IsEnum(MatchmakerStatus)
  status!: MatchmakerStatus;

  @ApiPropertyOptional({ description: '分润比例 0~1', example: 0.2 })
  @IsOptional() @IsNumber() @Min(0) @Max(1)
  commissionRate?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  remark?: string;
}

export class QueryMatchmakerDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString()
  keyword?: string;

  @ApiPropertyOptional({ enum: MatchmakerStatus })
  @IsOptional() @IsEnum(MatchmakerStatus)
  status?: MatchmakerStatus;

  @ApiPropertyOptional() @IsOptional() @IsString()
  cityCode?: string;
}

// ───────── 牵线 ─────────

export class CreateIntroductionDto {
  @ApiProperty({ description: 'A 方档案 id' })
  @IsString() @IsNotEmpty()
  aProfileId!: string;

  @ApiProperty({ description: 'B 方档案 id' })
  @IsString() @IsNotEmpty()
  bProfileId!: string;

  @ApiPropertyOptional({ description: '给双方的推荐语' })
  @IsOptional() @IsString() @MaxLength(1000)
  remark?: string;
}

export class AdvanceIntroductionDto {
  @ApiProperty({ enum: IntroductionStatus, description: '目标状态，会做状态机校验' })
  @IsEnum(IntroductionStatus)
  targetStatus!: IntroductionStatus;

  @ApiPropertyOptional({ description: '备注/结果反馈' })
  @IsOptional() @IsString() @MaxLength(1000)
  note?: string;
}

export class AgreeIntroductionDto {
  @ApiProperty({ description: '同意还是拒绝' })
  @Transform(({ value }) => value === true || value === 'true')
  agree!: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}

export class QueryIntroductionDto extends PaginationDto {
  @ApiPropertyOptional({ enum: IntroductionStatus })
  @IsOptional() @IsEnum(IntroductionStatus)
  status?: IntroductionStatus;

  @ApiPropertyOptional() @IsOptional() @IsString()
  matchmakerId?: string;

  @ApiPropertyOptional({ description: '涉及某个会员的所有牵线' })
  @IsOptional() @IsString()
  profileId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  keyword?: string;
}

// ───────── 分润 / 提现 ─────────

export class QueryCommissionDto extends PaginationDto {
  @ApiPropertyOptional({ enum: CommissionStatus })
  @IsOptional() @IsEnum(CommissionStatus)
  status?: CommissionStatus;

  @ApiPropertyOptional() @IsOptional() @IsString()
  matchmakerId?: string;
}

export class CreateWithdrawalDto {
  @ApiProperty({ description: '提现金额，单位分', example: 20000 })
  @IsInt() @Min(1)
  amount!: number;

  @ApiPropertyOptional({ enum: ['WECHAT', 'ALIPAY', 'BANK'], default: 'WECHAT' })
  @IsOptional() @IsString()
  method?: string;

  @ApiPropertyOptional({ description: '收款账号' })
  @IsOptional() @IsString() @MaxLength(100)
  account?: string;

  @ApiPropertyOptional({ description: '收款人真实姓名' })
  @IsOptional() @IsString() @MaxLength(50)
  realName?: string;
}

export class ReviewWithdrawalDto {
  @ApiProperty({ enum: WithdrawalStatus })
  @IsEnum(WithdrawalStatus)
  status!: WithdrawalStatus;

  @ApiPropertyOptional({ description: '拒绝理由' })
  @IsOptional() @IsString() @MaxLength(200)
  rejectReason?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  remark?: string;
}

export class QueryWithdrawalDto extends PaginationDto {
  @ApiPropertyOptional({ enum: WithdrawalStatus })
  @IsOptional() @IsEnum(WithdrawalStatus)
  status?: WithdrawalStatus;

  @ApiPropertyOptional() @IsOptional() @IsString()
  matchmakerId?: string;
}
