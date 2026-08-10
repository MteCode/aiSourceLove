import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { LOG_ACTION_KEY } from '../decorators';
import type { AuthUser } from '../types/auth-user';
import { PrismaService } from '@/infra/prisma/prisma.service';

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
@Injectable()
export class OperationLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(OperationLogInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<{ module: string; action: string } | undefined>(
      LOG_ACTION_KEY,
      context.getHandler(),
    );
    if (!meta) return next.handle();

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const started = Date.now();

    const write = (success: boolean, error?: string): void => {
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
            }) as Prisma.InputJsonValue,
            ip: this.clientIp(req),
            userAgent: (req.headers['user-agent'] ?? '').slice(0, 300),
            duration: Date.now() - started,
            success,
            error: error?.slice(0, 2000) ?? null,
          },
        })
        .catch((e: Error) => this.logger.warn(`写操作日志失败：${e.message}`));
    };

    return next.handle().pipe(
      tap(() => write(true)),
      catchError((err: Error) => {
        write(false, err.message);
        return throwError(() => err);
      }),
    );
  }

  private clientIp(req: Request): string {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff) return xff.split(',')[0].trim().slice(0, 64);
    return (req.ip ?? '').slice(0, 64);
  }

  /** 递归打码敏感字段，并限制深度防止超大 body 撑爆日志表 */
  private sanitize(obj: unknown, depth = 0): unknown {
    if (depth > 4) return '[深度截断]';
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      return obj.slice(0, 20).map((v) => this.sanitize(v, depth + 1));
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k)) {
        out[k] = '***';
      } else if (typeof v === 'string' && v.length > 500) {
        out[k] = `${v.slice(0, 500)}…[截断]`;
      } else {
        out[k] = this.sanitize(v, depth + 1);
      }
    }
    return out;
  }
}
