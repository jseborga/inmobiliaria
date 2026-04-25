import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { MeResponse } from '@inmobiliaria/shared';
import { ApiError } from '@/lib/api';
import { getServerApi } from '@/lib/api/server';
import { ADMIN_REFRESH_COOKIE, SESSION_COOKIE } from './cookies';

/**
 * Estado de auth desde el server.
 *
 * `getCurrentUser()` devuelve el `MeResponse` o `null` si no hay sesión válida.
 * `requireUser()` redirige a `/login?next=...` si no hay sesión.
 *
 * Nota: si el access token expiró (401 desde `/auth/me`) tratamos al usuario
 * como no logueado. La rotación silenciosa la dispara el cliente vía
 * `POST /api/auth/refresh` (las cookies se setean ahí, los Server Components
 * no pueden hacerlo).
 */

export async function getCurrentUser(): Promise<MeResponse | null> {
  const store = cookies();
  if (!store.get(SESSION_COOKIE)) return null;
  try {
    const api = getServerApi({ cache: 'no-store' });
    return await api.get<MeResponse>('/auth/me');
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      return null;
    }
    throw err;
  }
}

/**
 * Garantiza que el caller esté autenticado. Si no, redirige a /login.
 *
 * @param nextPath ruta a la que volver tras login (querystring `next`)
 */
export async function requireUser(nextPath?: string): Promise<MeResponse> {
  const user = await getCurrentUser();
  if (!user) {
    const target = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login';
    redirect(target);
  }
  return user;
}

/** True si tenemos cookie de sesión (no garantiza que sea válida). */
export function hasSessionCookie(): boolean {
  return !!cookies().get(SESSION_COOKIE) || !!cookies().get(ADMIN_REFRESH_COOKIE);
}
