"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangePasswordDto = exports.RefreshTokenDto = exports.WxMiniLoginDto = exports.PasswordLoginDto = exports.SmsLoginDto = exports.SendSmsCodeDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const PHONE_RE = /^1[3-9]\d{9}$/;
class SendSmsCodeDto {
    phone;
    scene = 'login';
}
exports.SendSmsCodeDto = SendSmsCodeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '手机号', example: '13800138000' }),
    (0, class_validator_1.Matches)(PHONE_RE, { message: '手机号格式不正确' }),
    __metadata("design:type", String)
], SendSmsCodeDto.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '场景', enum: ['login', 'bind', 'reset'], default: 'login' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['login', 'bind', 'reset']),
    __metadata("design:type", String)
], SendSmsCodeDto.prototype, "scene", void 0);
class SmsLoginDto {
    phone;
    code;
    inviteMatchmakerId;
}
exports.SmsLoginDto = SmsLoginDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '手机号', example: '13800138000' }),
    (0, class_validator_1.Matches)(PHONE_RE, { message: '手机号格式不正确' }),
    __metadata("design:type", String)
], SmsLoginDto.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '短信验证码', example: '8888' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(4, 6, { message: '验证码长度不正确' }),
    __metadata("design:type", String)
], SmsLoginDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '邀请人红娘 id，用于绑定归属' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SmsLoginDto.prototype, "inviteMatchmakerId", void 0);
class PasswordLoginDto {
    username;
    password;
}
exports.PasswordLoginDto = PasswordLoginDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '手机号/账号', example: '13800138000' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: '请输入账号' }),
    __metadata("design:type", String)
], PasswordLoginDto.prototype, "username", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '密码' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(6, { message: '密码至少 6 位' }),
    __metadata("design:type", String)
], PasswordLoginDto.prototype, "password", void 0);
class WxMiniLoginDto {
    code;
    phoneCode;
    nickname;
    avatar;
}
exports.WxMiniLoginDto = WxMiniLoginDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'wx.login 拿到的 code' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], WxMiniLoginDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '手机号授权 code（getPhoneNumber）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], WxMiniLoginDto.prototype, "phoneCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], WxMiniLoginDto.prototype, "nickname", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], WxMiniLoginDto.prototype, "avatar", void 0);
class RefreshTokenDto {
    refreshToken;
}
exports.RefreshTokenDto = RefreshTokenDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], RefreshTokenDto.prototype, "refreshToken", void 0);
class ChangePasswordDto {
    oldPassword;
    newPassword;
}
exports.ChangePasswordDto = ChangePasswordDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '旧密码，首次设置可不传' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ChangePasswordDto.prototype, "oldPassword", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '新密码，至少 8 位' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8, { message: '密码至少 8 位' }),
    __metadata("design:type", String)
], ChangePasswordDto.prototype, "newPassword", void 0);
//# sourceMappingURL=auth.dto.js.map