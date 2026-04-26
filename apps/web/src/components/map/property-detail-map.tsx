'use client';

import dynamic from 'next/dynamic';
import { MapPin } from 'lucide-react';

const PropertyDetailMapInner = dynamic(
  () => import('./property-detail-map-inner').then((m) => m.PropertyDetailMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-lg border bg-muted/40 text-sm text-muted-foreground">
        Cargando mapa…
      </div>
    ),
  },
);

interface PropertyDetailMapProps {
  /** Coords de la propiedad. Si null, no se renderiza el mapa. */
  lat: number | null;
  lng: number | null;
  title: string;
  /** Texto de dirección que aparece arriba del mapa. */
  addressLine?: string | null;
  /** Alto del mapa en CSS units. */
  height?: string;
}

/**
 * Mapa de ubicación para el detalle público de una propiedad.
 * Si la propiedad no tiene coordenadas, no se renderiza nada (la página llamadora
 * ya muestra la dirección textual aparte si la tiene).
 */
export function PropertyDetailMap({
  lat,
  lng,
  title,
  addressLine,
  height = '320px',
}: PropertyDetailMapProps) {
  if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Ubicación</h2>
      {addressLine ? (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          {addressLine}
        </p>
      ) : null}
      <div className="overflow-hidden rounded-lg border" style={{ height }}>
        <PropertyDetailMapInner lat={lat} lng={lng} title={title} />
      </div>
    </section>
  );
}
