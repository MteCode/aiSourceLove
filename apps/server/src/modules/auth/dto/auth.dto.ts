import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';

const PHONE_RE = /^1[3-9]\d{9}$/;

export class SendSmsCodeDto {
  @ApiProperty({ description: '手机号', example: '13800138000' })
  @Matches(PHONE_RE, { message: '手机号格式不正确' })
  phone!: string;

  @ApiProperty({ description: '场景', enum: ['login', 'bind', 'reset'], default: 'login' })
  @IsOptional()
  @IsIn(['login', 'bind', 'reset'])
  scene: 'login' | 'bind' | 'reset' = 'login';
}

export class SmsLoginDto {
  @ApiProperty({ description: '手机号', example: '13800138000' })
  @Matches(PHONE_RE, { message: '手机号格式不正确' })
  phone!: string;

  @ApiProperty({ description: '短信验证码', example: '8888' })
  @IsString()
  @Length(4, 6, { message: '验证码长度不正确' })
  code!: string;

  @ApiPropertyOptional({ description: '邀请人红娘 id，用于绑定归属' })
  @IsOptional()
  @IsString()
  inviteMatchmakerId?: string;

  /** 管理员邀请码。带上它注册的人才允许申请成为红娘 */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adminInviteCode?: string;
}

export class PasswordLoginDto {
  @ApiProperty({ description: '手机号/账号', example: '13800138000' })
  @IsString()
  @IsNotEmpty({ message: '请输入账号' })
  username!: string;

  @ApiProperty({ description: '密码' })
  @IsString()
  @MinLength(6, { message: '密码至少 6 位' })
  password!: string;
}

export class WxMiniLoginDto {
  @ApiProperty({ description: 'wx.login 拿到的 code' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiPropertyOptional({ description: '手机号授权 code（getPhoneNumber）' })
  @IsOptional()
  @IsString()
  phoneCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nickname?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatar?: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class ChangePasswordDto {
  @ApiPropertyOptional({ description: '旧密码，首次设置可不传' })
  @IsOptional()
  @IsString()
  oldPassword?: string;

  @ApiProperty({ description: '新密码，至少 8 位' })
  @IsString()
  @MinLength(8, { message: '密码至少 8 位' })
  newPassword!: string;
}
