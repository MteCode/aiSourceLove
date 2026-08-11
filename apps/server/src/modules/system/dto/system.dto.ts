import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserStatus } from '@yuanqiao/shared';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class QueryUserDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString()
  keyword?: string;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional() @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ description: '按角色筛选' })
  @IsOptional() @IsString()
  roleCode?: string;
}

export class CreateSysUserDto {
  @ApiProperty({ example: '13800138001' })
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone!: string;

  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(50)
  nickname!: string;

  @ApiProperty({ minLength: 8 })
  @IsString() @MinLength(8, { message: '密码至少 8 位' })
  password!: string;

  @ApiProperty({ type: [String], example: ['AUDITOR'] })
  @IsArray() @IsString({ each: true })
  roleCodes!: string[];
}

export class UpdateSysUserDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50)
  nickname?: string;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional() @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ description: '重置密码' })
  @IsOptional() @IsString() @MinLength(8)
  password?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  roleCodes?: string[];
}

export class UpdateRolePermissionsDto {
  @ApiProperty({ type: [String] })
  @IsArray() @IsString({ each: true })
  permissionCodes!: string[];
}

export class QueryLogDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString()
  keyword?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  module?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : value === 'true' || value === true))
  @IsBoolean()
  success?: boolean;

  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional() @IsString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-08-31' })
  @IsOptional() @IsString()
  endDate?: string;
}
