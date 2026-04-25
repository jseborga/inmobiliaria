/**
 * Instrumentation hook de Next.js. Se ejecuta una vez al iniciar el server.
 *
 * Cargamos los config de Sentry según el runtime para que solo cada uno
 * traiga las dependencias que necesita (el bundle del edge no tiene Node
 * built-ins, etc.).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

/**
 * Captura errores no manejados en Server Components y Route Handlers.
 * (Next 15+: requiere export. En 14 también es safe tener la función.)
 */
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string> },
) {
  if (process.env.SENTRY_DSN) {
    const Sentry = await import('@sentry/nextjs');
    Sentry.captureException(err, {
      tags: { path: request.path, method: request.method },
    });
  }
}
