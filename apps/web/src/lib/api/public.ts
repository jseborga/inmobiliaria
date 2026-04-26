import 'server-only';

import { createApiClient, type ApiClient } from './client';
import { env } from '../env';
import { getRequestContext } from '../tenant';

/**
 * Cliente para los endpoints públicos del marketplace (sin auth).
 *
 * - Si el host actual resolvió un tenant (subdominio / header), se forwardea
 *   `X-Tenant-Slug` para que la API filtre por ese tenant.
 * - Si no, las llamadas son cross-tenant (catálogo global).
 *
 * Uso (Server Component):
 *   const api = getPublicApi({ tags: ['public-properties'] });
 *   const list = await api.get('/public/properties', { query: { take: 12 } });
 */
export interface PublicApiOptions {
  /** Forzar tenant slug (sobrescribe el resuelto por middleware). */
  tenantSlug?: string | null;
  cache?: RequestCache;
  tags?: string[];
}

export function getPublicApi(opts: PublicApiOptions = {}): ApiClient {
  const ctx = getRequestContext();
  const tenantSlug = opts.tenantSlug ?? ctx.tenantSlug ?? null;

  return createApiClient({
    baseUrl: env.internalApiUrl,
    tenantSlug,
    cache: opts.cache ?? 'no-store',
    tags: opts.tags,
  });
}
