import 'server-only';

import { headers } from 'next/headers';
import {
  type AppContext,
  type ResolvedHost,
  RESERVED_SUBDOMAINS,
  buildTenantUrl,
  resolveHost,
} from './tenant-shared';

/**
 * Helpers de tenant para Server Components / route handlers (toca `next/headers`).
 *
 * Re-exporta los helpers puros de `./tenant-shared` para que los callers
 * existentes (`@/lib/tenant`) sigan funcionando sin tocarlos. Los Client
 * Components deben importar directamente de `./tenant-shared`.
 */

export { RESERVED_SUBDOMAINS, buildTenantUrl, resolveHost };
export type { AppContext, ResolvedHost };

/** Lee el contexto resuelto por el middleware desde headers (Server Components). */
export function getRequestContext(): ResolvedHost {
  const h = headers();
  const ctx = h.get('x-app-context') as AppContext | null;
  const tenantSlug = h.get('x-tenant-slug');
  if (ctx) return { context: ctx, tenantSlug: tenantSlug || null };
  // Fallback: parsear host directamente.
  return resolveHost(h.get('host'));
}
