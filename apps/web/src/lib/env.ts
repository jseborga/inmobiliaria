/**
 * Variables de entorno del frontend.
 *
 * Las que empiezan con NEXT_PUBLIC_ están expuestas al bundle del browser.
 * El resto solo se accede en server (route handlers, Server Components).
 */

export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api',
  rootDomain: process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000',
  /** Secreto para firmar cookies del web (opcional, si vacío se usa fallback dev). */
  sessionSecret: process.env.WEB_SESSION_SECRET ?? 'dev-insecure-session-secret-change-me',
};

/** Hostname raíz sin puerto (para comparar subdominios). */
export function rootHostname(): string {
  return env.rootDomain.split(':')[0] ?? env.rootDomain;
}
