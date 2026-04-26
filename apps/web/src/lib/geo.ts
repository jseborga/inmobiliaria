import 'server-only';

import { headers } from 'next/headers';

/**
 * Resolución de geolocalización por IP del request (sin permiso del browser).
 *
 * Usa `ipwho.is` — gratis, sin API key, sin rate limit razonable. Si falla
 * o el IP es privado (LAN/localhost), devuelve null y el caller usa fallback.
 *
 * Cacheado por 24h por IP via Next.js fetch cache para no pegarle al
 * servicio en cada page load.
 */

export interface RequestGeo {
  lat: number;
  lng: number;
  city?: string;
  country?: string;
}

const PRIVATE_IP_RE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fc|fd)/i;

function pickClientIp(): string | null {
  const h = headers();
  // x-forwarded-for puede venir con múltiples IPs separadas por coma; el primero es el cliente.
  const xff = h.get('x-forwarded-for');
  if (xff) {
    const ip = xff.split(',')[0]?.trim();
    if (ip) return ip;
  }
  return h.get('x-real-ip') ?? null;
}

export async function getRequestGeo(): Promise<RequestGeo | null> {
  const ip = pickClientIp();
  if (!ip || PRIVATE_IP_RE.test(ip)) return null;

  try {
    // Next.js cachea esto por IP gracias a la URL única + revalidate 24h.
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      next: { revalidate: 86400, tags: [`geo:${ip}`] },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      success?: boolean;
      latitude?: number;
      longitude?: number;
      city?: string;
      country?: string;
    };
    if (!data.success || typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
      return null;
    }
    return {
      lat: data.latitude,
      lng: data.longitude,
      city: data.city,
      country: data.country,
    };
  } catch {
    return null;
  }
}
