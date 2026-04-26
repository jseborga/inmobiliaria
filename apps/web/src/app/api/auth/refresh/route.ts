import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  ADMIN_REFRESH_COOKIE,
  SESSION_COOKIE,
  extractSetCookieValue,
  refreshCookieOptions,
  sessionCookieOptions,
} from '@/lib/auth/cookies';
import { env } from '@/lib/env';

/**
 * Rotación del access + refresh token.
 *
 * Lee el `refresh_token` del web, lo manda al API (`POST /auth/refresh` lo
 * espera como cookie), captura el nuevo refresh del Set-Cookie, y reescribe
 * ambas cookies del web.
 *
 * Sobre fallo (401, expirado), limpia las cookies y devuelve 401 — el cliente
 * debe redirigir a /login.
 */
export async function POST() {
  const store = cookies();
  const refreshToken = store.get(ADMIN_REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ message: 'No hay sesión' }, { status: 401 });
  }

  const apiRes = await fetch(`${env.internalApiUrl}/auth/refresh`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Cookie: `${ADMIN_REFRESH_COOKIE}=${refreshToken}`,
    },
  });

  if (!apiRes.ok) {
    const res = NextResponse.json({ message: 'Sesión expirada' }, { status: 401 });
    res.cookies.delete(SESSION_COOKIE);
    res.cookies.delete({ name: ADMIN_REFRESH_COOKIE, path: '/api/auth' });
    return res;
  }

  const payload = (await apiRes.json().catch(() => null)) as
    | { user?: unknown; tenant?: unknown; tokens?: { accessToken: string; accessTokenExpiresIn: number } }
    | null;
  if (!payload?.tokens?.accessToken) {
    return NextResponse.json({ message: 'Respuesta inválida' }, { status: 502 });
  }

  const setCookies = apiRes.headers.getSetCookie?.() ?? [];
  const newRefresh = extractSetCookieValue(setCookies, ADMIN_REFRESH_COOKIE);

  const res = NextResponse.json(
    { user: payload.user, tenant: payload.tenant },
    { status: 200 },
  );
  res.cookies.set({
    name: SESSION_COOKIE,
    value: payload.tokens.accessToken,
    ...sessionCookieOptions(payload.tokens.accessTokenExpiresIn),
  });
  if (newRefresh) {
    res.cookies.set({
      name: ADMIN_REFRESH_COOKIE,
      value: newRefresh,
      ...refreshCookieOptions(60 * 60 * 24 * 7),
    });
  }
  return res;
}
