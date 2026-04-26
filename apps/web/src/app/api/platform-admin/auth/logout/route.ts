import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  PLATFORM_REFRESH_COOKIE,
  PLATFORM_SESSION_COOKIE,
} from '@/lib/auth/cookies';
import { env } from '@/lib/env';

/**
 * Logout del super-admin: limpia las cookies del web y best-effort
 * notifica al API para revocar el refresh token.
 */
export async function POST() {
  const store = cookies();
  const refreshToken = store.get(PLATFORM_REFRESH_COOKIE)?.value;

  if (refreshToken) {
    await fetch(`${env.internalApiUrl}/platform-admin/auth/logout`, {
      method: 'POST',
      headers: { Cookie: `${PLATFORM_REFRESH_COOKIE}=${refreshToken}` },
    }).catch(() => undefined);
  }

  const res = NextResponse.json({ ok: true });
  // Borrar cookies en el dominio del web. Path debe matchear el del set.
  res.cookies.set({ name: PLATFORM_SESSION_COOKIE, value: '', maxAge: 0, path: '/' });
  res.cookies.set({
    name: PLATFORM_REFRESH_COOKIE,
    value: '',
    maxAge: 0,
    path: '/api/platform-admin/auth',
  });
  return res;
}
