import { env, rootHostname } from './env';

/**
 * Helpers de tenant SIN dependencias server-only (no importa `next/headers`).
 * Esto permite que Client Components (mapa, links cross-tenant) usen
 * `buildTenantUrl` y `resolveHost` sin romper el bundle del browser.
 *
 * `getRequestContext` (que sí toca `next/headers`) vive en `./tenant`.
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

/**
 * Construye URL absoluta hacia el sitio de un tenant. Usa el rootDomain de
 * env (NEXT_PUBLIC_ROOT_DOMAIN). El protocolo arranca http en dev (lvh.me)
 * y se asume http; en producción detrás de TLS se reemplaza con https en
 * el browser via la cookie/header del request inicial.
 */
export function buildTenantUrl(slug: string, path: string = '/'): string {
  return `http://${slug}.${env.rootDomain}${path}`;
}
