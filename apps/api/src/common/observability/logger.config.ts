import type { Params } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';

/**
 * Config del logger Pino que reemplaza el default Logger de Nest.
 *
 * - JSON estructurado en producción (parseable por cualquier log aggregator).
 * - Pretty en desarrollo para que sea leíble en la terminal.
 * - Genera un `req.id` por request, accesible vía middleware.
 * - Filtra el endpoint de healthcheck para no llenar los logs.
 * - Nivel ajustable con LOG_LEVEL (default `info` en prod, `debug` en dev).
 */
export function buildLoggerConfig(): Params {
  const isProd = process.env.NODE_ENV === 'production';
  const level = process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug');

  return {
    pinoHttp: {
      level,
      autoLogging: {
        ignore: (req) => {
          const url = req.url ?? '';
          // Healthcheck dispara cada 30s y rara vez es interesante.
          return url.startsWith('/api/health');
        },
      },
      genReqId: (req, res) => {
        const id = (req.headers['x-request-id'] as string) ?? randomUUID();
        // Lo devolvemos en la respuesta para correlacionar con frontends/curl.
        res.setHeader('x-request-id', id);
        return id;
      },
      // Sin pretty en prod (overhead + logs binarios menos parseables).
      transport: isProd
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
              singleLine: true,
              translateTime: 'SYS:HH:MM:ss.l',
              ignore: 'pid,hostname,req.headers,res.headers',
            },
          },
      // No volcamos passwords ni cookies a los logs.
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.password',
          'req.body.ownerPassword',
          'res.headers["set-cookie"]',
        ],
        censor: '[REDACTED]',
      },
      customLogLevel: (_req, res, err) => {
        if (err) return 'error';
        if (res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    },
  };
}
