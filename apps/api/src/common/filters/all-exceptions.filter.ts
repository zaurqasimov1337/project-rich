import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

interface ErrorBody {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

const STATUS_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  402: 'PLAN_LIMIT_REACHED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL';
    let message = 'Internal server error';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        message = payload;
      } else if (typeof payload === 'object' && payload !== null) {
        const p = payload as Record<string, unknown>;
        // Custom exceptions may pass {code, message, details}
        code = typeof p.code === 'string' ? p.code : (STATUS_CODES[status] ?? 'ERROR');
        message = Array.isArray(p.message)
          ? 'Validation failed'
          : typeof p.message === 'string'
            ? p.message
            : message;
        details = Array.isArray(p.message) ? p.message : p.details;
      }
      if (code === 'INTERNAL') code = STATUS_CODES[status] ?? 'ERROR';
    } else {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorBody = { success: false, error: { code, message, details } };
    res.status(status).json(body);
  }
}
