import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CarStatus,
  ChildrenStatus,
  Education,
  Gender,
  HouseStatus,
  MaritalStatus,
  ProfileSource,
  ProfileStatus,
} from '@yuanqiao/shared';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class PreferenceInputDto {
  @ApiPropertyOptional({ minimum: 18, maximum: 80 })
  @IsOptional() @IsInt() @Min(18) @Max(80)
  ageMin?: number;

  @ApiPropertyOptional({ minimum: 18, maximum: 80 })
  @IsOptional() @IsInt() @Min(18) @Max(80)
  ageMax?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(130) @Max(230)
  heightMin?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(130) @Max(230)
  heightMax?: number;

  @ApiPropertyOptional({ enum: Education })
  @IsOptional() @IsEnum(Education)
  educationMin?: Education;

  @ApiPropertyOptional({ description: '期望年收入下限，单位元' })
  @IsOptional() @IsInt() @Min(0)
  incomeMin?: number;

  @ApiPropertyOptional({ enum: MaritalStatus, isArray: true, description: '空数组=不限' })
  @IsOptional() @IsArray() @IsEnum(MaritalStatus, { each: true })
  maritalStatus?: MaritalStatus[];

  @ApiPropertyOptional({ enum: ChildrenStatus, isArray: true, description: '空数组=不限' })
  @IsOptional() @IsArray() @IsEnum(ChildrenStatus, { each: true })
  childrenStatus?: ChildrenStatus[];

  @ApiPropertyOptional({ type: [String], description: '期望城市 adcode，空=不限' })
  @IsOptional() @IsArray() @IsString({ each: true })
  cityCodes?: string[];

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  requireHouse?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  requireCar?: boolean;

  @ApiPropertyOptional({ description: '择偶自由描述，AI 层做语义匹配用' })
  @IsOptional() @IsString() @MaxLength(1000)
  description?: string;
}

/** 档案录入。两条路径共用这个 DTO：用户自填 和 红娘代录。 */
export class UpsertProfileDto {
  @ApiPropertyOptional({ description: '真实姓名（默认脱敏展示）' })
  @IsOptional() @IsString() @MaxLength(50)
  realName?: string;

  @ApiPropertyOptional({ description: '昵称' })
  @IsOptional() @IsString() @MaxLength(50)
  nickname?: string;

  @ApiProperty({ enum: Gender })
  @IsEnum(Gender, { message: '请选择性别' })
  gender!: Gender;

  @ApiProperty({ description: '生日 YYYY-MM-DD', example: '1996-05-20' })
  @IsDateString({}, { message: '生日格式应为 YYYY-MM-DD' })
  birthday!: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(130) @Max(230)
  heightCm?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(30) @Max(200)
  weightKg?: number;

  @ApiPropertyOptional({ enum: Education })
  @IsOptional() @IsEnum(Education)
  education?: Education;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  school?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  occupation?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  company?: string;

  @ApiPropertyOptional({ description: '年收入，单位元' })
  @IsOptional() @IsInt() @Min(0) @Max(100000000)
  annualIncome?: number;

  @ApiPropertyOptional({ enum: MaritalStatus })
  @IsOptional() @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus;

  @ApiPropertyOptional({ enum: ChildrenStatus })
  @IsOptional() @IsEnum(ChildrenStatus)
  childrenStatus?: ChildrenStatus;

  @ApiPropertyOptional({ enum: HouseStatus })
  @IsOptional() @IsEnum(HouseStatus)
  houseStatus?: HouseStatus;

  @ApiPropertyOptional({ enum: CarStatus })
  @IsOptional() @IsEnum(CarStatus)
  carStatus?: CarStatus;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(12)
  provinceCode?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(12)
  cityCode?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(12)
  districtCode?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(12)
  hometownCityCode?: string;

  @ApiPropertyOptional({ description: '自我介绍' })
  @IsOptional() @IsString() @MaxLength(2000)
  introduction?: string;

  @ApiPropertyOptional({ description: '手机号' })
  @IsOptional() @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50)
  wechat?: string;

  @ApiPropertyOptional({ type: PreferenceInputDto })
  @IsOptional() @ValidateNested() @Type(() => PreferenceInputDto)
  preference?: PreferenceInputDto;

  @ApiPropertyOptional({
    description: '扩展字段（EAV），key 为 fieldDef.code。会按字段定义校验。',
    example: { hobby: ['旅行', '健身'], acceptLongDistance: true },
  })
  @IsOptional() @IsObject()
  extras?: Record<string, unknown>;
}

/** 红娘代录：多一个"给谁录"的信息，且不需要对方有账号 */
export class MatchmakerCreateProfileDto extends UpsertProfileDto {
  @ApiPropertyOptional({ description: '若该会员已注册，传其 userId 直接关联' })
  @IsOptional() @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: '是否立即提交审核', default: true })
  @IsOptional() @IsBoolean()
  submitNow?: boolean;
}

export class AuditProfileDto {
  @ApiProperty({ enum: [ProfileStatus.APPROVED, ProfileStatus.REJECTED, ProfileStatus.OFFLINE] })
  @IsEnum(ProfileStatus)
  targetStatus!: ProfileStatus;

  @ApiPropertyOptional({ description: '驳回/下架理由（驳回必填）' })
  @IsOptional() @IsString() @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ type: [String], description: '有问题的字段 code，前端高亮用' })
  @IsOptional() @IsArray() @IsString({ each: true })
  rejectedFields?: string[];
}

export class AuditPhotoDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsEnum(['APPROVED', 'REJECTED'] as never)
  status!: 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(200)
  reason?: string;
}

export class QueryProfileDto extends PaginationDto {
  @ApiPropertyOptional({ description: '编号/姓名/手机号 模糊搜索' })
  @IsOptional() @IsString()
  keyword?: string;

  @ApiPropertyOptional({ enum: ProfileStatus })
  @IsOptional() @IsEnum(ProfileStatus)
  status?: ProfileStatus;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional() @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional() @IsOptional() @IsString()
  cityCode?: string;

  @ApiPropertyOptional({ enum: ProfileSource })
  @IsOptional() @IsEnum(ProfileSource)
  source?: ProfileSource;

  @ApiPropertyOptional({ description: '归属红娘 id' })
  @IsOptional() @IsString()
  matchmakerId?: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(18) @Max(80)
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  ageMin?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(18) @Max(80)
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  ageMax?: number;

  @ApiPropertyOptional({ description: '只看有待审照片的' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  hasPendingPhoto?: boolean;
}

export class ClaimProfileDto {
  @ApiProperty({ description: '要认领的档案编号，如 YQ26081000001' })
  @IsString() @IsNotEmpty()
  serialNo!: string;
}
