import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';
import type { MatchWeightKey } from '@yuanqiao/shared';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class MatchQueryDto extends PaginationDto {
  @ApiProperty({ description: '给谁匹配。红娘可传名下任意会员；普通用户只能传自己' })
  @IsString()
  @IsNotEmpty({ message: '请指定要匹配的档案' })
  profileId!: string;

  @ApiPropertyOptional({ description: '是否启用 AI 层（会消耗 AI_MATCH 权益）', default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  enableAi?: boolean;

  @ApiPropertyOptional({ description: '临时覆盖权重，后台调参用', example: { mutualPreference: 0.5 } })
  @IsOptional()
  @IsObject()
  weights?: Partial<Record<MatchWeightKey, number>>;

  @ApiPropertyOptional({ description: '只看某城市' })
  @IsOptional()
  @IsString()
  cityCode?: string;

  @ApiPropertyOptional({ description: '最低分过滤', minimum: 0, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  @Max(100)
  minScore?: number;
}

export class ScorePairDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  aProfileId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  bProfileId!: string;
}
