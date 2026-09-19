import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AuditLogService } from '../audit/services/audit-log.service';
import { AUDIT_ACTION_METADATA_KEY } from '../decorators/audit-action.decorator';
import type { RequestUser } from '../decorators/current-user.decorator';

type HttpRequest = {
  method: string;
  originalUrl?: string;
  path?: string;
  route?: { path?: string };
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  user?: RequestUser;
};

type HttpResponse = {
  statusCode: number;
};

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<HttpRequest>();
    const method = request.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return next.handle();
    }

    const response = context.switchToHttp().getResponse<HttpResponse>();
    const startedAt = Date.now();
    const action =
      this.reflector.get<string>(
        AUDIT_ACTION_METADATA_KEY,
        context.getHandler(),
      ) ??
      `${method} ${request.route?.path ?? request.path ?? request.originalUrl ?? 'unknown'}`;
    const userAgentHeader = request.headers?.['user-agent'];

    const buildEntry = (
      statusCode: number,
      metadata: Record<string, unknown> | null,
    ) => ({
      organizationId: request.user?.organizationId ?? null,
      actorUserId: request.user?.sub ?? null,
      actorUsername: request.user?.username ?? null,
      action,
      httpMethod: method,
      httpPath:
        request.originalUrl ?? request.path ?? request.route?.path ?? 'unknown',
      statusCode,
      durationMs: Date.now() - startedAt,
      ipAddress: request.ip ?? null,
      userAgent: Array.isArray(userAgentHeader)
        ? (userAgentHeader[0] ?? null)
        : (userAgentHeader ?? null),
      metadata,
    });

    return next.handle().pipe(
      tap(() => {
        void this.auditLogService.record(buildEntry(response.statusCode, null));
      }),
      catchError((error: unknown) => {
        const statusCode =
          typeof error === 'object' &&
          error !== null &&
          'status' in error &&
          typeof error.status === 'number'
            ? error.status
            : 500;
        const message =
          typeof error === 'object' && error !== null && 'message' in error
            ? String(error.message)
            : 'unknown error';
        void this.auditLogService.record(
          buildEntry(statusCode, { errorMessage: message }),
        );
        return throwError(() => error);
      }),
    );
  }
}
