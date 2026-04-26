import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  ADMIN_REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
  SESSION_COOKIE,
} from '@/lib/auth/cookies';
import { env } from '@/lib/env';

/**
 * Logout: revoca el refresh token en el API (best-effort) y limpia
 * cookies del web.
 */
export async function POST() {
  const store = cookies();
  const refreshToken = store.get(ADMIN_REFRESH_COOKIE)?.value;

  if (refreshToken) {
    // Best-effort: si el API falla, igual limpiamos cookies del web.
    await fetch(`${env.internalApiUrl}/auth/logout`, {
      method: 'POST',
      headers: { Cookie: `${ADMIN_REFRESH_COOKIE}=${refreshToken}` },
    }).catch(() => undefined);
  }

  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.cookies.delete(SESSION_COOKIE);
  res.cookies.delete({ name: ADMIN_REFRESH_COOKIE, path: REFRESH_COOKIE_PATH });
  return res;
}
