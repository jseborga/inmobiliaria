import { NextResponse, type NextRequest } from 'next/server';
import { platformLoginSchema } from '@inmobiliaria/shared';
import {
  PLATFORM_REFRESH_COOKIE,
  PLATFORM_SESSION_COOKIE,
  extractSetCookieValue,
  platformRefreshCookieOptions,
  sessionCookieOptions,
} from '@/lib/auth/cookies';
import { env } from '@/lib/env';

/**
 * Login de super-admin (proxy a `POST /api/platform-admin/auth/login`).
 *
 * - Valida con `platformLoginSchema`.
 * - Captura el `Set-Cookie: platform_refresh_token=...` del API
 *   (path `/api/platform-admin/auth`) y lo re-emite en el dominio del web.
 * - Guarda el access token en `platform_session` (httpOnly).
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'JSON inválido' }, { status: 400 });
  }

  const parsed = platformLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues.map((i) => i.message).join(', ') },
      { status: 400 },
    );
  }

  const apiRes = await fetch(`${env.internalApiUrl}/platform-admin/auth/login`, {
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
        admin?: unknown;
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

  const setCookies = apiRes.headers.getSetCookie?.() ?? [];
  const refreshToken = extractSetCookieValue(setCookies, PLATFORM_REFRESH_COOKIE);

  const res = NextResponse.json({ admin: payload.admin }, { status: 200 });

  res.cookies.set({
    name: PLATFORM_SESSION_COOKIE,
    value: payload.tokens.accessToken,
    ...sessionCookieOptions(payload.tokens.accessTokenExpiresIn),
  });

  if (refreshToken) {
    res.cookies.set({
      name: PLATFORM_REFRESH_COOKIE,
      value: refreshToken,
      ...platformRefreshCookieOptions(60 * 60 * 24 * 7),
    });
  }

  return res;
}
