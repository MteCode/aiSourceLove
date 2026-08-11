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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("../../common/decorators");
const auth_service_1 = require("./auth.service");
const auth_dto_1 = require("./dto/auth.dto");
let AuthController = class AuthController {
    auth;
    constructor(auth) {
        this.auth = auth;
    }
    sendSmsCode(dto) {
        return this.auth.sendSmsCode(dto.phone, dto.scene);
    }
    smsLogin(dto, ip) {
        return this.auth.smsLogin(dto.phone, dto.code, ip, dto.inviteMatchmakerId);
    }
    passwordLogin(dto, ip) {
        return this.auth.passwordLogin(dto.username, dto.password, ip);
    }
    wxMiniLogin(dto, ip) {
        return this.auth.wxMiniLogin(dto.code, ip, { nickname: dto.nickname, avatar: dto.avatar });
    }
    refresh(dto, ip) {
        return this.auth.refresh(dto.refreshToken, ip);
    }
    me(user) {
        return this.auth.toCurrentUser(user);
    }
    changePassword(userId, dto) {
        return this.auth.changePassword(userId, dto.oldPassword, dto.newPassword);
    }
    logout(_req) {
        // JWT 无状态，服务端不维护会话；前端清掉本地 token 即可。
        // 需要"服务端强制下线"时再引入 token 黑名单（Redis + jti）。
        return { success: true };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Post)('sms-code'),
    (0, swagger_1.ApiOperation)({ summary: '发送短信验证码' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.SendSmsCodeDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "sendSmsCode", null);
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Post)('login/sms'),
    (0, swagger_1.ApiOperation)({ summary: '手机号验证码登录（号码不存在则自动注册）' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.SmsLoginDto, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "smsLogin", null);
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Post)('login/password'),
    (0, swagger_1.ApiOperation)({ summary: '账号密码登录（后台）' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.PasswordLoginDto, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "passwordLogin", null);
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Post)('login/wx-mini'),
    (0, swagger_1.ApiOperation)({ summary: '微信小程序登录' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.WxMiniLoginDto, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "wxMiniLogin", null);
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Post)('refresh'),
    (0, swagger_1.ApiOperation)({ summary: '刷新 token' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.RefreshTokenDto, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, swagger_1.ApiOperation)({ summary: '获取当前登录用户' }),
    __param(0, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "me", null);
__decorate([
    (0, common_1.Post)('change-password'),
    (0, decorators_1.LogAction)('认证', '修改密码'),
    (0, swagger_1.ApiOperation)({ summary: '修改密码' }),
    __param(0, (0, decorators_1.CurrentUser)('userId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, auth_dto_1.ChangePasswordDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "changePassword", null);
__decorate([
    (0, common_1.Post)('logout'),
    (0, swagger_1.ApiOperation)({ summary: '退出登录' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "logout", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)('认证'),
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map