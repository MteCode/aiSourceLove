import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { FieldType, VisibilityLevel } from '@yuanqiao/shared';

export class FieldOptionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  value!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiPropertyOptional({ description: '用于打分的数值映射，如收入档位' })
  @IsOptional()
  @IsNumber()
  score?: number;
}

export class CreateFieldGroupDto {
  @ApiProperty({ example: 'basic' })
  @Matches(/^[a-z][a-z0-9_]{1,29}$/, { message: 'code 只能用小写字母数字下划线，字母开头' })
  code!: string;

  @ApiProperty({ example: '基本信息' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sort?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateFieldGroupDto extends PartialType(CreateFieldGroupDto) {}

export class CreateFieldDefDto {
  @ApiProperty({ example: 'hobby' })
  @Matches(/^[a-zA-Z][a-zA-Z0-9_]{1,49}$/, { message: 'code 只能用字母数字下划线，字母开头' })
  code!: string;

  @ApiProperty({ example: '兴趣爱好' })
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiProperty({ enum: FieldType })
  @IsEnum(FieldType)
  type!: FieldType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  groupId!: string;

  @ApiPropertyOptional({ type: [FieldOptionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldOptionDto)
  options?: FieldOptionDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  placeholder?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  helpText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ description: '0公开 1会员 2VIP 3解锁后 4红娘 5管理员', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  visibility?: VisibilityLevel;

  @ApiPropertyOptional({ description: '是否映射到 Profile 固定列（只有内置字段能是 true）' })
  @IsOptional()
  @IsBoolean()
  isCore?: boolean;

  @ApiPropertyOptional({ description: '是否同时出现在择偶要求表单' })
  @IsOptional()
  @IsBoolean()
  isPreference?: boolean;

  @ApiPropertyOptional({ description: '参与打分的权重键' })
  @IsOptional()
  @IsString()
  weightKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  minValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  maxLength?: number;

  @ApiPropertyOptional({ description: '校验正则' })
  @IsOptional()
  @IsString()
  regex?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sort?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateFieldDefDto extends PartialType(CreateFieldDefDto) {}
