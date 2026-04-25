import { headers } from 'next/headers';
import { env, rootHostname } from './env';

/**
 * Resolución de tenant a partir del host.
 *
 * Convención:
 * - `acme.{ROOT_DOMAIN}` → tenant `acme`.
 * - `admin.{ROOT_DOMAIN}` → admin global (sin tenant resuelto por host;
 *   el tenant viene del usuario logueado).
 * - `{ROOT_DOMAIN}` (sin subdominio) → marketplace global.
 *
 * El middleware de Next.js inyecta los headers `x-tenant-slug` y
 * `x-app-context` (`marketplace` | `admin` | `tenant`) para que los
 * Server Components no tengan que parsear el host de nuevo.
 */

export const RESERVED_SUBDOMAINS = new Set(['admin', 'www', 'app', 'api']);

export type AppContext = 'marketplace' | 'tenant' | 'admin';

export interface ResolvedHost {
  context: AppContext;
  tenantSlug: string | null;
}

export function resolveHost(host: string | null | undefined): ResolvedHost {
  if (!host) return { context: 'marketplace', tenantSlug: null };
  const hostname = (host.split(':')[0] ?? host).toLowerCase();
  const root = rootHostname().toLowerCase();

  // Mismo host raíz → marketplace global.
  if (hostname === root) return { context: 'marketplace', tenantSlug: null };

  if (hostname.endsWith(`.${root}`)) {
    const sub = hostname.slice(0, hostname.length - root.length - 1);
    // Soporta solo un nivel de subdominio (ej: acme.lvh.me).
    const first = sub.split('.')[0] ?? sub;
    if (!first) return { context: 'marketplace', tenantSlug: null };
    if (RESERVED_SUBDOMAINS.has(first)) {
      return { context: 'admin', tenantSlug: null };
    }
    return { context: 'tenant', tenantSlug: first };
  }

  // Hostname desconocido: lo tratamos como marketplace global (ej: 127.0.0.1).
  return { context: 'marketplace', tenantSlug: null };
}

/** Lee el contexto resuelto por el middleware desde headers (Server Components). */
export function getRequestContext(): ResolvedHost {
  const h = headers();
  const ctx = h.get('x-app-context') as AppContext | null;
  const tenantSlug = h.get('x-tenant-slug');
  if (ctx) return { context: ctx, tenantSlug: tenantSlug || null };
  // Fallback: parsear host directamente.
  return resolveHost(h.get('host'));
}

export function buildTenantUrl(slug: string, path: string = '/'): string {
  return `http://${slug}.${env.rootDomain}${path}`;
}
