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
exports.JwtAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const passport_1 = require("@nestjs/passport");
const decorators_1 = require("../decorators");
/**
 * 全局 JWT 守卫。默认所有接口都要登录，
 * 用 @Public() 放行，用 @OptionalAuth() 表示"登录可选"。
 *
 * 默认拒绝而不是默认放行——漏加装饰器时的后果是"接口 401"，
 * 而不是"接口裸奔"。
 */
let JwtAuthGuard = class JwtAuthGuard extends (0, passport_1.AuthGuard)('jwt') {
    reflector;
    constructor(reflector) {
        super();
        this.reflector = reflector;
    }
    canActivate(context) {
        const targets = [context.getHandler(), context.getClass()];
        if (this.reflector.getAllAndOverride(decorators_1.IS_PUBLIC_KEY, targets))
            return true;
        return super.canActivate(context);
    }
    handleRequest(err, user, _info, context) {
        const targets = [context.getHandler(), context.getClass()];
        const optional = this.reflector.getAllAndOverride(decorators_1.IS_OPTIONAL_AUTH_KEY, targets);
        // 登录可选：没带 token 或 token 失效都放行，只是 req.user 为空
        if (optional && (err || !user))
            return null;
        return super.handleRequest(err, user, _info, context);
    }
};
exports.JwtAuthGuard = JwtAuthGuard;
exports.JwtAuthGuard = JwtAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], JwtAuthGuard);
//# sourceMappingURL=jwt-auth.guard.js.map