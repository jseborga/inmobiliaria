import { NextResponse, type NextRequest } from 'next/server';
import { tenantLoginSchema } from '@inmobiliaria/shared';
import {
  ADMIN_REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
  SESSION_COOKIE,
  extractSetCookieValue,
  refreshCookieOptions,
  sessionCookieOptions,
} from '@/lib/auth/cookies';
import { env } from '@/lib/env';

/**
 * Login del web (proxy a `POST /api/auth/login`).
 *
 * Responsabilidades:
 *   - validar el body con `tenantLoginSchema` antes de tocar el API
 *   - capturar el `Set-Cookie: refresh_token=...` que el API setea para
 *     `localhost:3001` y re-emitirlo en el dominio del web
 *   - guardar el access token en `web_session` (httpOnly) — Server
 *     Components y route handlers lo leen para llamar al API
 *   - devolver al cliente solo `user` + `tenant` (no tokens)
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'JSON inválido' }, { status: 400 });
  }

  const parsed = tenantLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues.map((i) => i.message).join(', ') },
      { status: 400 },
    );
  }

  const apiRes = await fetch(`${env.apiUrl}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(req.headers.get('user-agent')
        ? { 'User-Agent': req.headers.get('user-agent') as string }
        : {}),
    },
    body: JSON.stringify(parsed.data),
  });

  const payload = (await apiRes.json().catch(() => null)) as
    | {
        user?: unknown;
        tenant?: unknown;
        tokens?: { accessToken: string; accessTokenExpiresIn: number };
        message?: string | string[];
      }
    | null;

  if (!apiRes.ok || !payload?.tokens?.accessToken) {
    const msg = Array.isArray(payload?.message)
      ? payload?.message.join(', ')
      : payload?.message ?? 'Credenciales inválidas';
    return NextResponse.json({ message: msg }, { status: apiRes.status || 401 });
  }

  // El API setea Set-Cookie: refresh_token=...; Path=/api/auth; HttpOnly
  // pero para `localhost:3001`. Lo capturamos y re-emitimos para el dominio
  // del web (mismo path para que el browser solo lo mande a /api/auth/*).
  const setCookies = apiRes.headers.getSetCookie?.() ?? [];
  const refreshToken = extractSetCookieValue(setCookies, ADMIN_REFRESH_COOKIE);

  const res = NextResponse.json(
    { user: payload.user, tenant: payload.tenant },
    { status: 200 },
  );

  res.cookies.set({
    name: SESSION_COOKIE,
    value: payload.tokens.accessToken,
    ...sessionCookieOptions(payload.tokens.accessTokenExpiresIn),
  });

  if (refreshToken) {
    // El API ya define el TTL en el Set-Cookie original; copiamos un default
    // generoso (7d). El servidor del API es quien revoca tokens vencidos.
    res.cookies.set({
      name: ADMIN_REFRESH_COOKIE,
      value: refreshToken,
      ...refreshCookieOptions(60 * 60 * 24 * 7),
    });
  }

  return res;
}

/** Marcadores no usados pero exportados para clarity de path. */
export const REFRESH_PATH = REFRESH_COOKIE_PATH;
