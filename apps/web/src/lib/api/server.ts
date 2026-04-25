import 'server-only';

import { cookies, headers } from 'next/headers';
import { createApiClient, type ApiClient } from './client';
import { env } from '../env';
import { getRequestContext } from '../tenant';

/**
 * Builder de cliente API para Server Components / route handlers.
 * - Toma el access token de la cookie httpOnly del web (set por route handler de login).
 * - Forwardea la cookie de refresh hacia la API (path `/api/auth`).
 * - Toma tenantSlug del contexto resuelto por middleware.
 */

export const SESSION_COOKIE = 'web_session';
export const ADMIN_REFRESH_COOKIE = 'refresh_token';
export const PLATFORM_REFRESH_COOKIE = 'platform_refresh_token';

export interface ServerApiOptions {
  /** Forzar tenant slug (ej: para llamadas públicas con tenant explícito). */
  tenantSlug?: string | null;
  /** Forzar access token (ej: tras refresh manual). */
  accessToken?: string | null;
  cache?: RequestCache;
  tags?: string[];
}

export function getServerApi(opts: ServerApiOptions = {}): ApiClient {
  const cookieStore = cookies();
  const ctx = getRequestContext();

  const accessToken =
    opts.accessToken !== undefined
      ? opts.accessToken
      : cookieStore.get(SESSION_COOKIE)?.value ?? null;

  const tenantSlug = opts.tenantSlug ?? ctx.tenantSlug ?? null;

  // Forwardear cookies relevantes al backend (refresh tokens).
  const refresh =
    cookieStore.get(ADMIN_REFRESH_COOKIE)?.value ??
    cookieStore.get(PLATFORM_REFRESH_COOKIE)?.value;
  const cookieHeader = refresh
    ? `${cookieStore.get(ADMIN_REFRESH_COOKIE) ? `${ADMIN_REFRESH_COOKIE}=${refresh}` : `${PLATFORM_REFRESH_COOKIE}=${refresh}`}`
    : null;

  return createApiClient({
    baseUrl: env.apiUrl,
    accessToken,
    tenantSlug,
    cookieHeader,
    cache: opts.cache,
    tags: opts.tags,
  });
}

/** Headers reales del request (no del provider, sino del request entrante). */
export function getRequestHeaders() {
  return headers();
}
