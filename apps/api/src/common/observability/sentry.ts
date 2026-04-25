import * as Sentry from '@sentry/node';

/**
 * Inicializa Sentry si SENTRY_DSN está seteada. No-op si no.
 *
 * Mantenemos la integración mínima:
 *   - sin tracing/profiling por defecto (samples=0) para no inflar la cuota
 *   - environment desde NODE_ENV
 *   - release desde GIT_SHA si está disponible (lo inyecta el Dockerfile en el futuro)
 *
 * Captura automática:
 *   - excepciones no manejadas en Node
 *   - errores que tira el global exception filter de Nest (vía requestHandler/errorHandler)
 */
export function initSentry(): boolean {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.GIT_SHA ?? undefined,
    // Tracing/perf desactivado por defecto. Subí estos valores cuando quieras
    // sampling de transacciones (CPU-intensive en alto throughput).
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0'),
    profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? '0'),
  });
  return true;
}

export { Sentry };
