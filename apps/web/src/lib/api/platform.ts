import 'server-only';

import { cookies } from 'next/headers';
import { createApiClient, type ApiClient } from './client';
import { env } from '../env';
import { PLATFORM_REFRESH_COOKIE, PLATFORM_SESSION_COOKIE } from '../auth/cookies';

/**
 * Cliente API server-side para super-admin.
 *
 * - Toma el access token de la cookie `platform_session` (paralela a
 *   `web_session` de tenants).
 * - Forwardea el refresh cookie hacia `/api/platform-admin/auth`.
 * - Usa `internalApiUrl` (red interna del docker) como el resto del
 *   server-side fetch.
 */

export interface PlatformApiOptions {
  cache?: RequestCache;
  tags?: string[];
}

export function getPlatformApi(opts: PlatformApiOptions = {}): ApiClient {
  const cookieStore = cookies();
  const accessToken = cookieStore.get(PLATFORM_SESSION_COOKIE)?.value ?? null;
  const refresh = cookieStore.get(PLATFORM_REFRESH_COOKIE)?.value;
  const cookieHeader = refresh ? `${PLATFORM_REFRESH_COOKIE}=${refresh}` : null;

  return createApiClient({
    baseUrl: env.internalApiUrl,
    accessToken,
    cookieHeader,
    cache: opts.cache,
    tags: opts.tags,
  });
}
