import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Sentry } from './sentry';

/**
 * Global exception filter que:
 *   - reporta a Sentry sólo errores 5xx / no-HTTP (los 4xx son ruido)
 *   - mantiene el contrato HTTP estándar de Nest para 4xx
 *   - loguea con el Logger de Nest (que en runtime es el de Pino)
 */
@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SentryExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Solo reportamos a Sentry los errores realmente inesperados.
    if (status >= 500) {
      Sentry.withScope((scope) => {
        scope.setTag('path', req.path);
        scope.setTag('method', req.method);
        if (req.tenant?.id) scope.setTag('tenant_id', req.tenant.id);
        if (req.user?.sub) scope.setUser({ id: req.user.sub });
        Sentry.captureException(exception);
      });
    }

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      res.status(status).json(typeof body === 'string' ? { message: body } : body);
      return;
    }

    // Error no-HTTP → 500 genérico, no exponemos el stack al cliente.
    this.logger.error(
      `Unhandled exception en ${req.method} ${req.path}`,
      exception instanceof Error ? exception.stack : String(exception),
    );
    res.status(status).json({
      statusCode: status,
      message: 'Internal server error',
    });
  }
}
