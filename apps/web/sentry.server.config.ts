import * as Sentry from '@sentry/nextjs';

/**
 * Sentry server-side (Server Components, route handlers, server actions).
 * No-op si SENTRY_DSN no está seteado.
 *
 * Este archivo se carga vía `instrumentation.ts` (Next 14+).
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
