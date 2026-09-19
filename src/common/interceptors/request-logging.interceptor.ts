import { randomUUID } from 'node:crypto';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

type SafeHeaders = Record<string, string>;
type SafeBody = Record<string, unknown> | string | null | undefined;

function maskSensitive(headers: SafeHeaders): SafeHeaders {
  const masked = { ...headers };
  for (const key of ['authorization', 'cookie', 'x-api-key', 'token']) {
    if (masked[key]) masked[key] = '[REDACTED]';
  }
  return masked;
}

function truncate(value: string, max = 2000): string {
  return value.length > max ? value.slice(0, max) + '... (truncated)' : value;
}

function safeJson(value: unknown): string {
  try {
    return truncate(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const { method, originalUrl, query, headers, body } = request;
    const requestId = randomUUID();
    const startedAt = Date.now();

    const safeHeaders = maskSensitive({ ...headers });
    const safeBody: SafeBody =
      body && typeof body === 'object' && Object.keys(body).length
        ? body
        : undefined;

    this.logger.log(
      `--> ${requestId} ${method} ${originalUrl}` +
        (safeBody ? `\n    body: ${safeJson(safeBody)}` : ''),
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const duration = Date.now() - startedAt;
          this.logger.log(
            `<-- ${requestId} ${method} ${originalUrl} ${response.statusCode} ${duration}ms`,
          );
        },
        error: (error: Error) => {
          const duration = Date.now() - startedAt;
          const status = (error as any).status ?? 500;
          this.logger.error(
            `<-- ${requestId} ${method} ${originalUrl} ${status} ${duration}ms - ${error.message}`,
            error.stack,
          );
        },
      }),
    );
  }
}
