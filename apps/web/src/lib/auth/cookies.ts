import 'server-only';

/**
 * Manejo de cookies del web para auth.
 *
 * Convención:
 *   - `web_session`: access token JWT firmado por el API. httpOnly, samesite=lax,
 *     se envía a las route handlers del web (no al API directamente). El
 *     servidor lo lee para inyectar `Authorization: Bearer` cuando llama al
 *     API desde Server Components.
 *   - `refresh_token`: refresh opaco emitido por el API. httpOnly, path=/api/auth/.
 *     El web lo re-setea en su propio dominio (capturado desde el `Set-Cookie`
 *     de la respuesta del API en login/refresh) para proxearlo de vuelta.
 *   - `platform_refresh_token`: equivalente para super-admins.
 *
 * Solo se exportan los nombres y opciones; la escritura/lectura usa los APIs
 * de Next.js (`cookies()` desde `next/headers`, `NextResponse.cookies`).
 */

export const SESSION_COOKIE = 'web_session';
export const ADMIN_REFRESH_COOKIE = 'refresh_token';
export const PLATFORM_REFRESH_COOKIE = 'platform_refresh_token';

/** Path con el que el API setea el refresh token (debe matchear acá). */
export const REFRESH_COOKIE_PATH = '/api/auth';

const isProd = process.env.NODE_ENV === 'production';

export interface CookieAttrs {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
  /** Segundos. Si se omite, cookie de sesión. */
  maxAge?: number;
}

/** Cookie del access token del web. Se lee desde Server Components / route handlers. */
export function sessionCookieOptions(maxAgeSeconds?: number): CookieAttrs {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    ...(maxAgeSeconds ? { maxAge: maxAgeSeconds } : {}),
  };
}

/** Cookie del refresh token (re-emitida en el dominio del web tras login API). */
export function refreshCookieOptions(maxAgeSeconds?: number): CookieAttrs {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
    ...(maxAgeSeconds ? { maxAge: maxAgeSeconds } : {}),
  };
}

/**
 * Extrae el valor de una cookie con un nombre dado desde uno o más
 * headers `Set-Cookie` recibidos del API. Devuelve null si no la encuentra.
 *
 * Ej: extractSetCookieValue(["refresh_token=abc; Path=/; HttpOnly"], "refresh_token")
 *     → "abc"
 */
export function extractSetCookieValue(
  setCookieHeaders: string[],
  name: string,
): string | null {
  const prefix = `${name}=`;
  for (const line of setCookieHeaders) {
    // El primer atributo (antes del primer `;`) es siempre `name=value`.
    const first = line.split(';', 1)[0]?.trim();
    if (first?.startsWith(prefix)) {
      return decodeURIComponent(first.slice(prefix.length));
    }
  }
  return null;
}
