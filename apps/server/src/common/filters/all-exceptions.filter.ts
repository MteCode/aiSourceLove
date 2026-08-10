import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import type { ApiResponse } from '@yuanqiao/shared';

/** 业务异常：HTTP 状态仍是 200/400，但 code 是业务错误码 */
export class BizException extends HttpException {
  constructor(
    message: string,
    readonly bizCode = 40000,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(message, status);
  }
}

/** 权益不足——前端要据此弹"开通 VIP"引导，所以给独立错误码 */
export class BenefitExhaustedException extends BizException {
  constructor(message: string, readonly benefitCode: string) {
    super(message, 40301, HttpStatus.FORBIDDEN);
  }
}

/**
 * 全局异常兜底。
 *
 * 目标：任何异常都返回统一信封，且**绝不把内部细节泄露到线上**。
 * Prisma 的报错文本里会带表名、字段名甚至 SQL，生产环境必须换成人话。
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');
  private readonly isProd = process.env.NODE_ENV === 'production';

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { traceId?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 50000;
    let message = '服务器开小差了，请稍后再试';

    if (exception instanceof BizException) {
      status = exception.getStatus();
      code = exception.bizCode;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = status * 100;
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const m = (body as { message?: string | string[] }).message;
        // class-validator 会给一个数组，取第一条给用户看就够了
        message = Array.isArray(m) ? m[0] : (m ?? exception.message);
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      status = HttpStatus.BAD_REQUEST;
      ({ code, message } = this.mapPrismaError(exception));
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      code = 40000;
      message = this.isProd ? '请求参数不正确' : exception.message.slice(0, 500);
    } else if (exception instanceof Error) {
      // 状态机抛出的普通 Error 也走这里，它们的 message 是给人看的中文
      message = this.isProd ? message : exception.message;
    }

    const isServerError = status >= 500;
    const logMsg = `${req.method} ${req.originalUrl} -> ${status} ${code} ${
      exception instanceof Error ? exception.message : String(exception)
    }`;
    if (isServerError) {
      this.logger.error(logMsg, exception instanceof Error ? exception.stack : undefined);
    } else {
      this.logger.warn(logMsg);
    }

    const body: ApiResponse<null> = {
      code,
      message,
      data: null,
      traceId: req.traceId,
    };
    res.status(status).json(body);
  }

  private mapPrismaError(e: Prisma.PrismaClientKnownRequestError): {
    code: number;
    message: string;
  } {
    const target = (e.meta?.target as string[] | string | undefined) ?? '';
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
}
