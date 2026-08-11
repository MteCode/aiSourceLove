"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllExceptionsFilter = exports.BenefitExhaustedException = exports.BizException = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
/** 业务异常：HTTP 状态仍是 200/400，但 code 是业务错误码 */
class BizException extends common_1.HttpException {
    bizCode;
    constructor(message, bizCode = 40000, status = common_1.HttpStatus.BAD_REQUEST) {
        super(message, status);
        this.bizCode = bizCode;
    }
}
exports.BizException = BizException;
/** 权益不足——前端要据此弹"开通 VIP"引导，所以给独立错误码 */
class BenefitExhaustedException extends BizException {
    benefitCode;
    constructor(message, benefitCode) {
        super(message, 40301, common_1.HttpStatus.FORBIDDEN);
        this.benefitCode = benefitCode;
    }
}
exports.BenefitExhaustedException = BenefitExhaustedException;
/**
 * 全局异常兜底。
 *
 * 目标：任何异常都返回统一信封，且**绝不把内部细节泄露到线上**。
 * Prisma 的报错文本里会带表名、字段名甚至 SQL，生产环境必须换成人话。
 */
let AllExceptionsFilter = class AllExceptionsFilter {
    logger = new common_1.Logger('Exception');
    isProd = process.env.NODE_ENV === 'production';
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const res = ctx.getResponse();
        const req = ctx.getRequest();
        let status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        let code = 50000;
        let message = '服务器开小差了，请稍后再试';
        if (exception instanceof BizException) {
            status = exception.getStatus();
            code = exception.bizCode;
            message = exception.message;
        }
        else if (exception instanceof common_1.HttpException) {
            status = exception.getStatus();
            code = status * 100;
            const body = exception.getResponse();
            if (typeof body === 'string') {
                message = body;
            }
            else if (typeof body === 'object' && body !== null) {
                const m = body.message;
                // class-validator 会给一个数组，取第一条给用户看就够了
                message = Array.isArray(m) ? m[0] : (m ?? exception.message);
            }
        }
        else if (exception instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            status = common_1.HttpStatus.BAD_REQUEST;
            ({ code, message } = this.mapPrismaError(exception));
        }
        else if (exception instanceof client_1.Prisma.PrismaClientValidationError) {
            status = common_1.HttpStatus.BAD_REQUEST;
            code = 40000;
            message = this.isProd ? '请求参数不正确' : exception.message.slice(0, 500);
        }
        else if (exception instanceof Error) {
            // 状态机抛出的普通 Error 也走这里，它们的 message 是给人看的中文
            message = this.isProd ? message : exception.message;
        }
        const isServerError = status >= 500;
        const logMsg = `${req.method} ${req.originalUrl} -> ${status} ${code} ${exception instanceof Error ? exception.message : String(exception)}`;
        if (isServerError) {
            this.logger.error(logMsg, exception instanceof Error ? exception.stack : undefined);
        }
        else {
            this.logger.warn(logMsg);
        }
        const body = {
            code,
            message,
            data: null,
            traceId: req.traceId,
        };
        res.status(status).json(body);
    }
    mapPrismaError(e) {
        const target = e.meta?.target ?? '';
        const targetStr = Array.isArray(target) ? target.join(', ') : String(target);
        switch (e.code) {
            case 'P2002':
                return { code: 40901, message: `数据已存在（重复字段：${targetStr || '唯一键'}）` };
            case 'P2003':
                return { code: 40902, message: '存在关联数据，无法执行该操作' };
            case 'P2025':
                return { code: 40401, message: '记录不存在或已被删除' };
            default:
                return {
                    code: 50001,
                    message: this.isProd ? '数据操作失败' : `数据库错误 ${e.code}: ${e.message.slice(0, 200)}`,
                };
        }
    }
};
exports.AllExceptionsFilter = AllExceptionsFilter;
exports.AllExceptionsFilter = AllExceptionsFilter = __decorate([
    (0, common_1.Catch)()
], AllExceptionsFilter);
//# sourceMappingURL=all-exceptions.filter.js.map