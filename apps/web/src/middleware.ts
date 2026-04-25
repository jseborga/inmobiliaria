import { NextResponse, type NextRequest } from 'next/server';
import { resolveHost } from '@/lib/tenant';

/**
 * Resolución de tenant por subdominio + protección del admin.
 *
 * Convención (ver `lib/tenant.ts`):
 * - `{ROOT_DOMAIN}` → marketplace global.
 * - `{slug}.{ROOT_DOMAIN}` → sitio público del tenant `slug`.
 * - `admin.{ROOT_DOMAIN}` → panel admin (rutas /admin protegidas por sesión).
 *
 * Inyecta los headers `x-tenant-slug` y `x-app-context` para que los Server
 * Components y route handlers no tengan que parsear el host de nuevo.
 *
 * Para dev recomendamos `*.lvh.me` (resuelve a 127.0.0.1 sin tocar /etc/hosts).
 */
export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const host = req.headers.get('host');
  const { context, tenantSlug } = resolveHost(host);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-app-context', context);
  if (tenantSlug) requestHeaders.set('x-tenant-slug', tenantSlug);

  // Protección del admin: rutas /admin solo accesibles desde admin.* o sin
  // subdominio (en dev). Si entran al admin sin sesión, el layout admin
  // redirige a /login. Aquí solo enriquecemos headers y rewrites de UX.
  if (context === 'admin' && url.pathname === '/') {
    url.pathname = '/admin';
    return NextResponse.redirect(url);
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  // Excluir assets estáticos y API interna de Next.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
