import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { CurrentUser as CurrentUserDto, LoginResult } from '@yuanqiao/shared';
import { ClientIp, CurrentUser, LogAction, Public } from '@/common/decorators';
import type { AuthUser } from '@/common/types/auth-user';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  PasswordLoginDto,
  RefreshTokenDto,
  SendSmsCodeDto,
  SmsLoginDto,
  WxMiniLoginDto,
} from './dto/auth.dto';

@ApiTags('认证')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('sms-code')
  @ApiOperation({ summary: '发送短信验证码' })
  sendSmsCode(@Body() dto: SendSmsCodeDto) {
    return this.auth.sendSmsCode(dto.phone, dto.scene);
  }

  @Public()
  @Post('login/sms')
  @ApiOperation({ summary: '手机号验证码登录（号码不存在则自动注册）' })
  smsLogin(@Body() dto: SmsLoginDto, @ClientIp() ip: string): Promise<LoginResult> {
    return this.auth.smsLogin(dto.phone, dto.code, ip, dto.inviteMatchmakerId);
  }

  @Public()
  @Post('login/password')
  @ApiOperation({ summary: '账号密码登录（后台）' })
  passwordLogin(@Body() dto: PasswordLoginDto, @ClientIp() ip: string): Promise<LoginResult> {
    return this.auth.passwordLogin(dto.username, dto.password, ip);
  }

  @Public()
  @Post('login/wx-mini')
  @ApiOperation({ summary: '微信小程序登录' })
  wxMiniLogin(@Body() dto: WxMiniLoginDto, @ClientIp() ip: string): Promise<LoginResult> {
    return this.auth.wxMiniLogin(dto.code, ip, { nickname: dto.nickname, avatar: dto.avatar });
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: '刷新 token' })
  refresh(@Body() dto: RefreshTokenDto, @ClientIp() ip: string): Promise<LoginResult> {
    return this.auth.refresh(dto.refreshToken, ip);
  }

  @Get('me')
  @ApiOperation({ summary: '获取当前登录用户' })
  me(@CurrentUser() user: AuthUser): Promise<CurrentUserDto> {
    return this.auth.toCurrentUser(user);
  }

  @Post('change-password')
  @LogAction('认证', '修改密码')
  @ApiOperation({ summary: '修改密码' })
  changePassword(@CurrentUser('userId') userId: string, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(userId, dto.oldPassword, dto.newPassword);
  }

  @Post('logout')
  @ApiOperation({ summary: '退出登录' })
  logout(@Req() _req: Request) {
    // JWT 无状态，服务端不维护会话；前端清掉本地 token 即可。
    // 需要"服务端强制下线"时再引入 token 黑名单（Redis + jti）。
    return { success: true };
  }
}
