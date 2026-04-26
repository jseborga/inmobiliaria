import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ApiError } from '@/lib/api';
import { getPlatformApi } from '@/lib/api/platform';
import { PLATFORM_REFRESH_COOKIE, PLATFORM_SESSION_COOKIE } from './cookies';

/**
 * Auth state del super-admin (PlatformAdmin).
 *
 * Convención de cookies (paralela a la del tenant):
 *   - `platform_session`: access token JWT del super-admin (httpOnly).
 *   - `platform_refresh_token`: refresh opaco re-emitido por el web tras
 *     capturar el `Set-Cookie` del API (path `/api/platform-admin/auth`).
 *
 * `getCurrentPlatformAdmin()` devuelve el admin o null si no hay sesión.
 * `requirePlatformAdmin()` redirige a `/platform-admin/login?next=...` si no.
 */

export interface PlatformAdminMe {
  id: string;
  email: string;
  firstName: string;
  lastName?: string | null;
  status: string;
}

export async function getCurrentPlatformAdmin(): Promise<PlatformAdminMe | null> {
  const store = cookies();
  if (!store.get(PLATFORM_SESSION_COOKIE)) return null;
  try {
    const api = getPlatformApi({ cache: 'no-store' });
    return await api.get<PlatformAdminMe>('/platform-admin/auth/me');
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      return null;
    }
    throw err;
  }
}

export async function requirePlatformAdmin(nextPath?: string): Promise<PlatformAdminMe> {
  const admin = await getCurrentPlatformAdmin();
  if (!admin) {
    const target = nextPath
      ? `/platform-admin/login?next=${encodeURIComponent(nextPath)}`
      : '/platform-admin/login';
    redirect(target);
  }
  return admin;
}

export function hasPlatformSessionCookie(): boolean {
  return (
    !!cookies().get(PLATFORM_SESSION_COOKIE) || !!cookies().get(PLATFORM_REFRESH_COOKIE)
  );
}
