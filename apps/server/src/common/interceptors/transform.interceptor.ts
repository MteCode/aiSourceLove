import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { Observable, map } from 'rxjs';
import type { ApiResponse } from '@yuanqiao/shared';

/**
 * 统一响应信封：{ code, message, data, traceId }
 *
 * 控制器只 return 业务数据，不用每个方法手写外壳。
 * 已经是信封形状的（比如支付回调要按渠道格式返回）原样放行。
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | T> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T> | T> {
    const req = context.switchToHttp().getRequest<Request & { traceId?: string }>();
    req.traceId ??= randomUUID();

    return next.handle().pipe(
      map((data) => {
        // 支付回调等需要返回渠道约定格式的接口，用 __raw 标记跳过包装
        if (data && typeof data === 'object' && '__raw' in (data as object)) {
          return (data as unknown as { __raw: T }).__raw;
        }
        return {
          code: 0,
          message: 'ok',
          data,
          traceId: req.traceId,
        } satisfies ApiResponse<T>;
      }),
    );
  }
}
