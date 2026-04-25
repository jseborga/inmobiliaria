import * as Sentry from '@sentry/nextjs';

/**
 * Sentry edge runtime (middleware.ts y rutas con `runtime: 'edge'`).
 * No-op si SENTRY_DSN no está seteado.
 */
const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.GIT_SHA ?? undefined,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0'),
  });
}
