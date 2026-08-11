import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { BenefitCode, OrderStatus, PayChannel, ResetCycle } from '@yuanqiao/shared';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class BenefitSpecDto {
  @ApiProperty({ enum: BenefitCode })
  @IsEnum(BenefitCode)
  code!: BenefitCode;

  @ApiProperty({ description: '额度：次数或天数', example: 10 })
  @IsInt()
  @Min(0)
  quota!: number;

  @ApiPropertyOptional({ enum: ResetCycle, description: '不传则用该权益的默认周期' })
  @IsOptional()
  @IsEnum(ResetCycle)
  cycle?: ResetCycle;
}

export class CreateVipPackageDto {
  @ApiProperty({ example: '月卡' })
  @IsString() @IsNotEmpty() @MaxLength(50)
  name!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  subtitle?: string;

  @ApiProperty({ description: '售价，单位分', example: 9900 })
  @IsInt() @Min(1)
  price!: number;

  @ApiPropertyOptional({ description: '划线原价，单位分' })
  @IsOptional() @IsInt() @Min(0)
  originalPrice?: number;

  @ApiProperty({ description: '有效天数', example: 30 })
  @IsInt() @Min(1)
  durationDays!: number;

  @ApiProperty({ type: [BenefitSpecDto], description: '权益清单，全部按次数/天数配' })
  @IsArray() @ValidateNested({ each: true }) @Type(() => BenefitSpecDto)
  benefits!: BenefitSpecDto[];

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isRecommended?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsInt()
  sort?: number;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  enabled?: boolean;
}

export class UpdateVipPackageDto extends PartialType(CreateVipPackageDto) {}

export class CreateOrderDto {
  @ApiProperty({ description: '套餐 id' })
  @IsString() @IsNotEmpty()
  packageId!: string;

  @ApiPropertyOptional({ enum: PayChannel, description: '不传则用系统配置的默认通道' })
  @IsOptional() @IsEnum(PayChannel)
  payChannel?: PayChannel;

  @ApiPropertyOptional({ description: '微信小程序支付需要' })
  @IsOptional() @IsString()
  openid?: string;
}

export class MockPayDto {
  @ApiProperty({ description: '商户交易号' })
  @IsString() @IsNotEmpty()
  outTradeNo!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean()
  success?: boolean;
}

export class RefundOrderDto {
  @ApiPropertyOptional({ description: '退款金额（分），不传则全额退' })
  @IsOptional() @IsInt() @Min(1)
  amount?: number;

  @ApiProperty({ description: '退款原因' })
  @IsString() @IsNotEmpty() @MaxLength(200)
  reason!: string;
}

export class QueryOrderDto extends PaginationDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional() @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ description: '订单号/手机号 模糊搜索' })
  @IsOptional() @IsString()
  keyword?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  userId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  matchmakerId?: string;
}
