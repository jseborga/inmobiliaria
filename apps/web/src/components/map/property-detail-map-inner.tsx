'use client';

import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import { applyLeafletIconFix } from './leaflet-icon-fix';

applyLeafletIconFix();

const DETAIL_ZOOM = 15;

export interface PropertyDetailMapInnerProps {
  lat: number;
  lng: number;
  title: string;
}

/**
 * Mapa estático del detalle público de una propiedad.
 * Un solo marker, sin interacción de pick (no es para editar). Permite zoom y
 * pan libre por si el visitante quiere explorar la zona.
 */
export function PropertyDetailMapInner({ lat, lng, title }: PropertyDetailMapInnerProps) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={DETAIL_ZOOM}
      scrollWheelZoom={false}
      style={{ height: '100%', width: '100%' }}
      className="rounded-lg z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[lat, lng]} title={title} />
    </MapContainer>
  );
}
