"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcryptjs"));
const shared_1 = require("@yuanqiao/shared");
const all_exceptions_filter_1 = require("../../common/filters/all-exceptions.filter");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
const redis_service_1 = require("../../infra/redis/redis.service");
const user_context_service_1 = require("./user-context.service");
let AuthService = AuthService_1 = class AuthService {
    prisma;
    redis;
    jwt;
    config;
    userContext;
    logger = new common_1.Logger(AuthService_1.name);
    constructor(prisma, redis, jwt, config, userContext) {
        this.prisma = prisma;
        this.redis = redis;
        this.jwt = jwt;
        this.config = config;
        this.userContext = userContext;
    }
    // ───────── 短信验证码 ─────────
    smsKey(phone, scene) {
        return `sms:${scene}:${phone}`;
    }
    async sendSmsCode(phone, scene) {
        const key = this.smsKey(phone, scene);
        // 频率限制：同一手机号 60 秒内只能发一次
        const ttl = await this.redis.ttl(key);
        if (ttl > shared_1.SMS_CODE_TTL_SECONDS - shared_1.SMS_CODE_INTERVAL_SECONDS) {
            const wait = ttl - (shared_1.SMS_CODE_TTL_SECONDS - shared_1.SMS_CODE_INTERVAL_SECONDS);
            throw new all_exceptions_filter_1.BizException(`发送太频繁，请 ${wait} 秒后再试`, 42901);
        }
        // 同一手机号每天上限，防刷短信费
        const dayCount = await this.redis.incr(`sms:count:${phone}`, 24 * 3600);
        if (dayCount > 10) {
            throw new all_exceptions_filter_1.BizException('今日验证码发送次数已达上限', 42902);
        }
        const smsCfg = this.config.get('sms', { infer: true });
        const code = smsCfg.provider === 'mock'
            ? smsCfg.mockCode
            : String(Math.floor(100000 + Math.random() * 900000));
        await this.redis.set(key, code, shared_1.SMS_CODE_TTL_SECONDS);
        if (smsCfg.provider === 'mock') {
            this.logger.warn(`【模拟短信】${phone} 验证码：${code}（SMS_PROVIDER=mock）`);
            // 开发环境把验证码直接回给前端，省去翻日志
            return { sent: true, devCode: this.config.get('isProd', { infer: true }) ? undefined : code };
        }
        // TODO 接入真实短信通道（阿里云/腾讯云）：此处调 SDK
        this.logger.error(`短信通道 ${smsCfg.provider} 尚未接入，验证码未实际发送`);
        throw new all_exceptions_filter_1.BizException('短信服务未配置，请联系管理员', 50002);
    }
    async verifySmsCode(phone, scene, code) {
        const key = this.smsKey(phone, scene);
        const expected = await this.redis.get(key);
        if (!expected)
            throw new all_exceptions_filter_1.BizException('验证码已过期，请重新获取', 40010);
        if (expected !== code) {
            // 错误次数限制，防爆破
            const fails = await this.redis.incr(`sms:fail:${phone}`, shared_1.SMS_CODE_TTL_SECONDS);
            if (fails >= 5)
                await this.redis.del(key);
            throw new all_exceptions_filter_1.BizException('验证码不正确', 40011);
        }
        // 用过即焚，防重放
        await this.redis.del(key, `sms:fail:${phone}`);
    }
    // ───────── 登录 ─────────
    /** 手机号验证码登录；号码不存在则自动注册为普通会员 */
    async smsLogin(phone, code, ip, inviteMatchmakerId) {
        await this.verifySmsCode(phone, 'login', code);
        let user = await this.prisma.user.findUnique({ where: { phone } });
        if (!user) {
            user = await this.registerMember(phone, inviteMatchmakerId);
        }
        else if (user.deletedAt) {
            throw new all_exceptions_filter_1.BizException('该账号已注销', 40312);
        }
        else if (user.status === 'BANNED') {
            throw new all_exceptions_filter_1.BizException('该账号已被封禁，如有疑问请联系客服', 40313);
        }
        return this.issueTokens(user.id, phone, ip);
    }
    /** 密码登录，主要给后台用（管理员/审核员/红娘） */
    async passwordLogin(username, password, ip) {
        const user = await this.prisma.user.findFirst({
            where: { phone: username, deletedAt: null },
        });
        // 用户不存在和密码错误返回同样的提示，不给撞库的人区分信号
        const invalid = new common_1.UnauthorizedException('账号或密码不正确');
        if (!user?.passwordHash)
            throw invalid;
        // 登录失败次数限制
        const failKey = `login:fail:${username}`;
        const fails = Number((await this.redis.get(failKey)) ?? 0);
        if (fails >= 8) {
            throw new all_exceptions_filter_1.BizException('密码错误次数过多，请 15 分钟后再试', 42903);
        }
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
            await this.redis.incr(failKey, 15 * 60);
            throw invalid;
        }
        if (user.status !== 'ACTIVE')
            throw new all_exceptions_filter_1.BizException('账号已被停用', 40313);
        await this.redis.del(failKey);
        return this.issueTokens(user.id, user.phone, ip);
    }
    /** 微信小程序登录 */
    async wxMiniLogin(code, ip, extra) {
        const cfg = this.config.get('wxMini', { infer: true });
        if (!cfg.appId || !cfg.appSecret) {
            throw new all_exceptions_filter_1.BizException('微信小程序登录未配置（缺 WX_MINI_APP_ID / WX_MINI_APP_SECRET）', 50003);
        }
        const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${cfg.appId}` +
            `&secret=${cfg.appSecret}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
        const res = await fetch(url).then((r) => r.json());
        const openid = res.openid;
        if (!openid) {
            throw new all_exceptions_filter_1.BizException(`微信登录失败：${res.errmsg ?? '未知错误'}`, 40014);
        }
        let user = await this.prisma.user.findUnique({ where: { wxOpenid: openid } });
        if (!user) {
            // 没绑手机号的用户先建号，手机号用 openid 占位，后续用 getPhoneNumber 补
            user = await this.prisma.user.create({
                data: {
                    phone: `wx_${openid.slice(0, 16)}`,
                    wxOpenid: openid,
                    wxUnionid: res.unionid ?? null,
                    nickname: extra?.nickname ?? '微信用户',
                    avatar: extra?.avatar ?? null,
                    roles: { create: { role: { connect: { code: shared_1.RoleCode.MEMBER } } } },
                },
            });
        }
        return this.issueTokens(user.id, user.phone, ip);
    }
    async registerMember(phone, inviteMatchmakerId) {
        const memberRole = await this.prisma.role.findUnique({ where: { code: shared_1.RoleCode.MEMBER } });
        if (!memberRole) {
            throw new all_exceptions_filter_1.BizException('系统未初始化（缺少 MEMBER 角色），请先执行 db:seed', 50004);
        }
        // 邀请人必须是启用中的红娘，否则忽略这个参数
        let matchmakerId = null;
        if (inviteMatchmakerId) {
            const mm = await this.prisma.matchmaker.findFirst({
                where: { id: inviteMatchmakerId, status: 'ACTIVE', deletedAt: null },
                select: { id: true },
            });
            matchmakerId = mm?.id ?? null;
        }
        return this.prisma.user.create({
            data: {
                phone,
                nickname: `缘友${phone.slice(-4)}`,
                roles: { create: { roleId: memberRole.id } },
                // 此刻还没有档案，先把归属红娘挂在用户上，建档案时转写过去
                inviteMatchmakerId: matchmakerId,
            },
        });
    }
    async issueTokens(userId, phone, ip) {
        const jwtCfg = this.config.get('jwt', { infer: true });
        const accessToken = await this.jwt.signAsync({ sub: userId, phone, typ: 'access' }, { expiresIn: jwtCfg.expiresIn });
        const refreshToken = await this.jwt.signAsync({ sub: userId, phone, typ: 'refresh' }, { expiresIn: jwtCfg.refreshExpiresIn });
        await this.prisma.user.update({
            where: { id: userId },
            data: { lastLoginAt: new Date(), lastLoginIp: ip.slice(0, 64) },
        });
        await this.userContext.invalidate(userId);
        const ctx = await this.userContext.load(userId);
        if (!ctx)
            throw new common_1.UnauthorizedException('账号状态异常');
        return {
            accessToken,
            refreshToken,
            expiresIn: this.parseExpiry(jwtCfg.expiresIn),
            user: await this.toCurrentUser(ctx),
        };
    }
    async refresh(refreshToken, ip) {
        let payload;
        try {
            payload = await this.jwt.verifyAsync(refreshToken);
        }
        catch {
            throw new common_1.UnauthorizedException('登录已过期，请重新登录');
        }
        if (payload.typ !== 'refresh')
            throw new common_1.UnauthorizedException('token 类型不正确');
        return this.issueTokens(payload.sub, payload.phone, ip);
    }
    async toCurrentUser(ctx) {
        const profile = ctx.profileId
            ? await this.prisma.profile.findUnique({
                where: { id: ctx.profileId },
                select: { status: true },
            })
            : null;
        const user = await this.prisma.user.findUnique({
            where: { id: ctx.userId },
            select: { avatar: true },
        });
        return {
            id: ctx.userId,
            phone: ctx.phone,
            nickname: ctx.nickname,
            avatar: user?.avatar ?? null,
            roles: ctx.roles,
            permissions: ctx.permissions,
            profileId: ctx.profileId,
            profileStatus: profile?.status ?? null,
            isVip: ctx.isVip,
            vipExpireAt: ctx.vipExpireAt?.toISOString() ?? null,
            matchmakerId: ctx.matchmakerId,
        };
    }
    async changePassword(userId, oldPassword, newPassword) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new all_exceptions_filter_1.BizException('用户不存在', 40401);
        if (user.passwordHash) {
            if (!oldPassword)
                throw new common_1.BadRequestException('请输入原密码');
            const ok = await bcrypt.compare(oldPassword, user.passwordHash);
            if (!ok)
                throw new all_exceptions_filter_1.BizException('原密码不正确', 40015);
        }
        const hash = await bcrypt.hash(newPassword, 10);
        await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
        await this.userContext.invalidate(userId);
        return { success: true };
    }
    /** "7d" / "30m" / 3600 → 秒 */
    parseExpiry(v) {
        if (typeof v === 'number')
            return v;
        const m = /^(\d+)([smhd])?$/.exec(v.trim());
        if (!m)
            return 7 * 24 * 3600;
        const n = Number(m[1]);
        switch (m[2]) {
            case 's':
                return n;
            case 'm':
                return n * 60;
            case 'h':
                return n * 3600;
            case 'd':
                return n * 86400;
            default:
                return n;
        }
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        jwt_1.JwtService,
        config_1.ConfigService,
        user_context_service_1.UserContextService])
], AuthService);
//# sourceMappingURL=auth.service.js.map