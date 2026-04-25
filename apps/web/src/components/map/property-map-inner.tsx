'use client';

import { useEffect, useMemo, useState } from 'react';
import { LatLngBounds, LatLng } from 'leaflet';
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
  Circle,
} from 'react-leaflet';
import type { PropertyDto, TenantSummary } from '@inmobiliaria/shared';
import { applyLeafletIconFix } from './leaflet-icon-fix';
import { buildTenantUrl } from '@/lib/tenant-shared';
import { formatPrice, propertyOperationLabel, propertyTypeLabel } from '@/lib/format';

applyLeafletIconFix();

// Centro por defecto: Bolivia (entre La Paz y Santa Cruz, vista país completa).
const DEFAULT_CENTER: [number, number] = [-17.5, -65.0];
const DEFAULT_ZOOM = 5;
const NEAR_ZOOM = 13;

export interface PropertyMapInnerProps {
  properties: (PropertyDto & { tenant?: TenantSummary })[];
  /** Cross-tenant: usa subdominio del tenant para el link del popup. */
  crossTenant: boolean;
  /** Punto de interés actual (centro de búsqueda). */
  poi: { lat: number; lng: number; radiusKm: number } | null;
  /** Disparado cuando el usuario clickea el mapa para fijar un POI. */
  onPickPoi: (lat: number, lng: number) => void;
  /** Cambio de radio (slider) — opcional. */
  radiusKm: number;
}

export function PropertyMapInner({
  properties,
  crossTenant,
  poi,
  onPickPoi,
  radiusKm,
}: PropertyMapInnerProps) {
  // Centro/zoom inicial: si hay POI usamos eso; sino bounding box de las props;
  // sino default Bolivia.
  const initial = useMemo(() => {
    if (poi) return { center: [poi.lat, poi.lng] as [number, number], zoom: NEAR_ZOOM };
    const withCoords = properties.filter(
      (p) => p.latitude != null && p.longitude != null,
    );
    if (withCoords.length === 0) {
      return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
    }
    if (withCoords.length === 1) {
      const p = withCoords[0]!;
      return {
        center: [Number(p.latitude), Number(p.longitude)] as [number, number],
        zoom: NEAR_ZOOM,
      };
    }
    return null; // se calcula con FitBounds más abajo
  }, [poi, properties]);

  const center = initial?.center ?? DEFAULT_CENTER;
  const zoom = initial?.zoom ?? DEFAULT_ZOOM;

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom
      style={{ height: '100%', width: '100%' }}
      className="rounded-lg z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <ClickToPickPoi onPick={onPickPoi} />

      {!initial ? <FitToProperties properties={properties} /> : null}

      {poi ? (
        <>
          <Marker position={[poi.lat, poi.lng]}>
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">Punto de interés</p>
                <p className="text-muted-foreground">
                  Mostrando propiedades dentro de {radiusKm} km.
                </p>
              </div>
            </Popup>
          </Marker>
          <Circle
            center={[poi.lat, poi.lng]}
            radius={radiusKm * 1000}
            pathOptions={{ color: '#0ea5e9', fillOpacity: 0.08 }}
          />
        </>
      ) : null}

      {properties.map((p) => {
        if (p.latitude == null || p.longitude == null) return null;
        const lat = Number(p.latitude);
        const lng = Number(p.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const detailPath = `/properties/${p.slug}`;
        const href =
          crossTenant && p.tenant?.slug
            ? buildTenantUrl(p.tenant.slug, detailPath)
            : `${detailPath}?tenantSlug=${p.tenant?.slug ?? ''}`;
        const cover = p.images?.[0];
        return (
          <Marker key={p.id} position={[lat, lng]}>
            <Popup minWidth={220}>
              <a href={href} className="block space-y-1.5 no-underline">
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cover.publicUrl}
                    alt={p.title}
                    className="h-28 w-full rounded object-cover"
                  />
                ) : null}
                <p className="text-sm font-semibold leading-tight">
                  {p.title}
                </p>
                <p className="text-base font-bold">
                  {formatPrice(p.price, p.currency, p.operation)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {propertyOperationLabel[p.operation]} ·{' '}
                  {propertyTypeLabel[p.type]}
                </p>
                {p.tenant?.name ? (
                  <p className="text-xs text-muted-foreground">{p.tenant.name}</p>
                ) : null}
              </a>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

/** Hook helper que ajusta el viewport para encajar todas las propiedades. */
function FitToProperties({
  properties,
}: {
  properties: PropertyMapInnerProps['properties'];
}) {
  const map = useMap();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    const points = properties
      .filter((p) => p.latitude != null && p.longitude != null)
      .map((p) => new LatLng(Number(p.latitude), Number(p.longitude)));
    if (points.length < 2) return;
    const bounds = new LatLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: NEAR_ZOOM });
    setDone(true);
  }, [done, map, properties]);

  return null;
}

/** Captura clicks sobre el mapa y los convierte en pick de POI. */
function ClickToPickPoi({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}
