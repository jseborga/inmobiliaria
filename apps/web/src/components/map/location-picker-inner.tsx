'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { applyLeafletIconFix } from './leaflet-icon-fix';

applyLeafletIconFix();

const DEFAULT_CENTER: [number, number] = [-17.5, -65.0];
const DEFAULT_ZOOM = 6;
const FOCUSED_ZOOM = 14;

export interface LocationPickerInnerProps {
  /** Coords actuales del form (controladas desde fuera). */
  value: { lat: number; lng: number } | null;
  onChange: (lat: number, lng: number) => void;
}

export function LocationPickerInner({ value, onChange }: LocationPickerInnerProps) {
  const center: [number, number] = value
    ? [value.lat, value.lng]
    : DEFAULT_CENTER;
  const zoom = value ? FOCUSED_ZOOM : DEFAULT_ZOOM;

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom
      style={{ height: '100%', width: '100%' }}
      className="rounded-md z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CenterOnValue value={value} />
      <ClickToSet onSet={onChange} />
      {value ? <DraggableMarker lat={value.lat} lng={value.lng} onMove={onChange} /> : null}
    </MapContainer>
  );
}

/** Recentra el mapa cuando cambian las coords desde fuera (input de texto). */
function CenterOnValue({
  value,
}: {
  value: LocationPickerInnerProps['value'];
}) {
  const map = useMap();
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!value) return;
    const key = `${value.lat},${value.lng}`;
    if (last.current === key) return;
    last.current = key;
    map.setView([value.lat, value.lng], Math.max(map.getZoom(), FOCUSED_ZOOM));
  }, [value, map]);
  return null;
}

function ClickToSet({ onSet }: { onSet: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onSet(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * Marker que se puede arrastrar. Usamos `eventHandlers.dragend` para leer
 * la posición final y propagarla al form.
 */
function DraggableMarker({
  lat,
  lng,
  onMove,
}: {
  lat: number;
  lng: number;
  onMove: (lat: number, lng: number) => void;
}) {
  return (
    <Marker
      position={[lat, lng]}
      draggable
      eventHandlers={{
        dragend(e) {
          const m = e.target as L.Marker;
          const pos = m.getLatLng();
          onMove(pos.lat, pos.lng);
        },
      }}
    />
  );
}
