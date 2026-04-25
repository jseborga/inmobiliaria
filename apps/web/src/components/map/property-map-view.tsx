'use client';

import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { LocateFixed, X } from 'lucide-react';
import { toast } from 'sonner';
import { Currency, type PropertyDto, type TenantSummary } from '@inmobiliaria/shared';
import { Button } from '@/components/ui/button';

/**
 * Wrapper SSR-safe del PropertyMapInner. Leaflet toca `window` en el import,
 * así que dynamic + ssr:false. Mientras carga, mostramos un placeholder.
 */
const PropertyMapInner = dynamic(
  () => import('./property-map-inner').then((m) => m.PropertyMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-lg border bg-muted/40 text-sm text-muted-foreground">
        Cargando mapa…
      </div>
    ),
  },
);

interface PropertyMapViewProps {
  properties: (PropertyDto & { tenant?: TenantSummary })[];
  crossTenant: boolean;
  /** Activado por ?fit=1&budget=... en URL — pinta markers según ajuste. */
  budget?: { amount: number; currency: Currency } | null;
}

export function PropertyMapView({ properties, crossTenant, budget }: PropertyMapViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  // POI / radio actual desde la URL.
  const poi = useMemo(() => {
    const lat = Number(searchParams.get('nearLat'));
    const lng = Number(searchParams.get('nearLng'));
    const r = Number(searchParams.get('radiusKm'));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, radiusKm: Number.isFinite(r) && r > 0 ? r : 5 };
  }, [searchParams]);

  const [pickedPoi, setPickedPoi] = useState<{ lat: number; lng: number } | null>(null);
  const [pendingRadius, setPendingRadius] = useState<number>(poi?.radiusKm ?? 5);

  const activePoi = poi ?? (pickedPoi ? { ...pickedPoi, radiusKm: pendingRadius } : null);

  function buildHref(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams);
    next.delete('skip'); // reset paginación
    for (const [k, v] of Object.entries(updates)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    return `?${next.toString()}`;
  }

  function applyPoi(lat: number, lng: number, radius: number) {
    startTransition(() => {
      router.push(
        buildHref({
          nearLat: String(lat),
          nearLng: String(lng),
          radiusKm: String(radius),
        }) as never,
      );
      setPickedPoi(null);
    });
  }

  function clearPoi() {
    startTransition(() => {
      router.push(
        buildHref({
          nearLat: null,
          nearLng: null,
          radiusKm: null,
        }) as never,
      );
      setPickedPoi(null);
    });
  }

  function locateMe() {
    if (!navigator.geolocation) {
      toast.error('Tu navegador no soporta geolocalización');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => applyPoi(pos.coords.latitude, pos.coords.longitude, pendingRadius),
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? 'Permiso de ubicación denegado'
            : 'No pudimos obtener tu ubicación';
        toast.error(msg);
      },
      { timeout: 8000, enableHighAccuracy: false },
    );
  }

  const propsWithCoords = properties.filter(
    (p) => p.latitude != null && p.longitude != null,
  );
  const missingCoords = properties.length - propsWithCoords.length;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
        <Button type="button" variant="outline" size="sm" onClick={locateMe} disabled={pending}>
          <LocateFixed className="mr-2 h-4 w-4" />
          Cerca de mí
        </Button>

        {pickedPoi && !poi ? (
          <Button
            type="button"
            size="sm"
            onClick={() => applyPoi(pickedPoi.lat, pickedPoi.lng, pendingRadius)}
            disabled={pending}
          >
            Buscar en esta área ({pendingRadius} km)
          </Button>
        ) : null}

        {poi ? (
          <Button type="button" variant="ghost" size="sm" onClick={clearPoi} disabled={pending}>
            <X className="mr-2 h-4 w-4" />
            Quitar área de búsqueda
          </Button>
        ) : null}

        <div className="flex flex-1 items-center gap-2 text-sm">
          <label htmlFor="radius" className="text-muted-foreground">
            Radio:
          </label>
          <input
            id="radius"
            type="range"
            min={1}
            max={50}
            step={1}
            value={pendingRadius}
            onChange={(e) => setPendingRadius(Number(e.target.value))}
            className="flex-1 max-w-[200px]"
          />
          <span className="w-12 text-right tabular-nums">{pendingRadius} km</span>
        </div>

        {missingCoords > 0 ? (
          <span className="text-xs text-muted-foreground">
            {missingCoords} propiedad{missingCoords === 1 ? '' : 'es'} sin coordenadas (no aparecen en el mapa)
          </span>
        ) : null}
      </div>

      {/* Mapa */}
      <div className="h-[600px] overflow-hidden rounded-lg border">
        <PropertyMapInner
          properties={propsWithCoords}
          crossTenant={crossTenant}
          poi={activePoi}
          onPickPoi={(lat, lng) => setPickedPoi({ lat, lng })}
          radiusKm={pendingRadius}
          budget={budget ?? null}
        />
      </div>

      {pickedPoi && !poi ? (
        <p className="rounded-md border border-dashed bg-card px-3 py-2 text-sm text-muted-foreground">
          Punto seleccionado: {pickedPoi.lat.toFixed(5)}, {pickedPoi.lng.toFixed(5)}.
          Tocá <strong>Buscar en esta área</strong> para ver propiedades dentro del radio.
        </p>
      ) : null}
    </div>
  );
}
