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
var OperationLogInterceptor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperationLogInterceptor = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const rxjs_1 = require("rxjs");
const decorators_1 = require("../decorators");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
/** 请求体里这些字段永远不进日志 */
const SENSITIVE_KEYS = new Set([
    'password',
    'passwordHash',
    'oldPassword',
    'newPassword',
    'code',
    'smsCode',
    'token',
    'accessToken',
    'refreshToken',
    'apiKey',
    'secret',
    'privateKey',
]);
/**
 * 操作日志。只记被 @LogAction 标记的接口——
 * 全量记录会让日志表比业务表还大，而且真出事时根本翻不动。
 */
let OperationLogInterceptor = OperationLogInterceptor_1 = class OperationLogInterceptor {
    reflector;
    prisma;
    logger = new common_1.Logger(OperationLogInterceptor_1.name);
    constructor(reflector, prisma) {
        this.reflector = reflector;
        this.prisma = prisma;
    }
    intercept(context, next) {
        const meta = this.reflector.get(decorators_1.LOG_ACTION_KEY, context.getHandler());
        if (!meta)
            return next.handle();
        const req = context.switchToHttp().getRequest();
        const started = Date.now();
        const write = (success, error) => {
            // 日志写失败绝不能影响主流程，所以 catch 掉并且不 await
            void this.prisma.operationLog
                .create({
                data: {
                    userId: req.user?.userId ?? null,
                    username: req.user?.nickname ?? req.user?.phone ?? null,
                    module: meta.module,
                    action: meta.action,
                    method: req.method,
                    path: req.originalUrl.slice(0, 200),
                    params: this.sanitize({
                        body: req.body,
                        query: req.query,
                        params: req.params,
                    }),
                    ip: this.clientIp(req),
                    userAgent: (req.headers['user-agent'] ?? '').slice(0, 300),
                    duration: Date.now() - started,
                    success,
                    error: error?.slice(0, 2000) ?? null,
                },
            })
                .catch((e) => this.logger.warn(`写操作日志失败：${e.message}`));
        };
        return next.handle().pipe((0, rxjs_1.tap)(() => write(true)), (0, rxjs_1.catchError)((err) => {
            write(false, err.message);
            return (0, rxjs_1.throwError)(() => err);
        }));
    }
    clientIp(req) {
        const xff = req.headers['x-forwarded-for'];
        if (typeof xff === 'string' && xff)
            return xff.split(',')[0].trim().slice(0, 64);
        return (req.ip ?? '').slice(0, 64);
    }
    /** 递归打码敏感字段，并限制深度防止超大 body 撑爆日志表 */
    sanitize(obj, depth = 0) {
        if (depth > 4)
            return '[深度截断]';
        if (obj === null || typeof obj !== 'object')
            return obj;
        if (Array.isArray(obj)) {
            return obj.slice(0, 20).map((v) => this.sanitize(v, depth + 1));
        }
        const out = {};
        for (const [k, v] of Object.entries(obj)) {
            if (SENSITIVE_KEYS.has(k)) {
                out[k] = '***';
            }
            else if (typeof v === 'string' && v.length > 500) {
                out[k] = `${v.slice(0, 500)}…[截断]`;
            }
            else {
                out[k] = this.sanitize(v, depth + 1);
            }
        }
        return out;
    }
};
exports.OperationLogInterceptor = OperationLogInterceptor;
exports.OperationLogInterceptor = OperationLogInterceptor = OperationLogInterceptor_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        prisma_service_1.PrismaService])
], OperationLogInterceptor);
//# sourceMappingURL=operation-log.interceptor.js.map