'use client';

import L from 'leaflet';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadowUrl from 'leaflet/dist/images/marker-shadow.png';

/**
 * Fix conocido: Leaflet busca los assets del marker default con un path
 * relativo al document que no funciona dentro del bundle de Next.
 * Importamos las imágenes y le pasamos las URLs procesadas por webpack.
 *
 * Llamar `applyLeafletIconFix()` UNA vez antes de renderizar cualquier
 * componente de leaflet. Es idempotente.
 */
let applied = false;

export function applyLeafletIconFix(): void {
  if (applied) return;

  // Borramos `_getIconUrl` para que `mergeOptions` con URLs explícitas tome efecto.
  // (Sin esto, Leaflet construye URLs como `marker-icon.png` relativas al document.)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;

  L.Icon.Default.mergeOptions({
    iconUrl: typeof iconUrl === 'string' ? iconUrl : iconUrl.src,
    iconRetinaUrl: typeof iconRetinaUrl === 'string' ? iconRetinaUrl : iconRetinaUrl.src,
    shadowUrl: typeof iconShadowUrl === 'string' ? iconShadowUrl : iconShadowUrl.src,
  });

  applied = true;
}
