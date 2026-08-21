import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

const PG_ERROR_CODES: Record<string, string> = {
  '23505': 'Duplicate record already exists',
  '23503': 'Referenced record does not exist',
  '23502': 'Required field is missing',
  '23514': 'Validation constraint failed',

  '22P02': 'Invalid input format',
  '22001': 'Value exceeds maximum length',
  '22003': 'Numeric value out of range',
  '22007': 'Invalid date/time format',

  '42703': 'Column does not exist',
  '42701': 'Duplicate column specified in query',
  '42P01': 'Table does not exist',
  '42601': 'SQL syntax error',

  '40001': 'Transaction serialization failure',
  '40P01': 'Deadlock detected',
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof QueryFailedError) {
      const dbError = (exception as any).driverError || exception;
      const code = dbError?.code;

      const status = code === '23505' ? HttpStatus.CONFLICT : HttpStatus.BAD_REQUEST;

      return void response.status(status).json({
        success: false,
        statusCode: status,
        path: request.url,
        timestamp: new Date().toISOString(),
        error: {
          message: PG_ERROR_CODES[code] || dbError?.message || 'Database error',
          code,
          detail: dbError?.detail,
          constraint: dbError?.constraint,
          table: dbError?.table,
          column: dbError?.column,
          schema: dbError?.schema,
          hint: dbError?.hint,
          severity: dbError?.severity,
          routine: dbError?.routine,
          originalMessage: dbError?.message,
        },
      });
    }

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const error =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    if (status >= 500) {
      this.logger.error(exception);
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      error,
    });
  }
}
