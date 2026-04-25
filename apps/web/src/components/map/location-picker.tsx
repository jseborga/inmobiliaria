'use client';

import dynamic from 'next/dynamic';
import { LocateFixed, MapPin, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

const LocationPickerInner = dynamic(
  () => import('./location-picker-inner').then((m) => m.LocationPickerInner),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-md border bg-muted/40 text-sm text-muted-foreground">
        Cargando mapa…
      </div>
    ),
  },
);

export interface LocationPickerProps {
  /** Coords actuales (las del form). */
  value: { lat: number | null; lng: number | null };
  /** Disparado al click sobre el mapa, drag del pin, o "Cerca de mí". */
  onChange: (lat: number | null, lng: number | null) => void;
  /** Alto del mapa en CSS units. */
  height?: string;
}

/**
 * Picker de ubicación para el form admin.
 *
 * UX:
 *   - Si hay value: muestra el pin centrado, draggable. Click en otro punto
 *     mueve el pin.
 *   - Si no hay value: mapa centrado en Bolivia, click coloca el pin inicial.
 *   - Botón "Cerca de mí" usa geolocation del browser.
 *   - Botón "Limpiar" deja el campo en null (la propiedad queda sin coords —
 *     no aparece en el mapa público).
 *
 * El componente NO es la fuente de verdad: lee/escribe en el form via props.
 * Se queda en sync con cambios manuales en los inputs de lat/lng.
 */
export function LocationPicker({ value, onChange, height = '320px' }: LocationPickerProps) {
  const hasValue =
    value.lat !== null &&
    value.lng !== null &&
    Number.isFinite(value.lat) &&
    Number.isFinite(value.lng);

  function locateMe() {
    if (!navigator.geolocation) {
      toast.error('Tu navegador no soporta geolocalización');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => onChange(pos.coords.latitude, pos.coords.longitude),
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? 'Permiso de ubicación denegado'
            : 'No pudimos obtener tu ubicación';
        toast.error(msg);
      },
      { timeout: 8000, enableHighAccuracy: true },
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={locateMe}>
          <LocateFixed className="mr-2 h-4 w-4" />
          Cerca de mí
        </Button>
        {hasValue ? (
          <>
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-mono">
              <MapPin className="h-3 w-3" />
              {value.lat!.toFixed(5)}, {value.lng!.toFixed(5)}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null, null)}>
              <X className="mr-1 h-4 w-4" />
              Quitar
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Tocá un punto en el mapa para fijar la ubicación, o usá &quot;Cerca de mí&quot;.
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-md border" style={{ height }}>
        <LocationPickerInner
          value={hasValue ? { lat: value.lat!, lng: value.lng! } : null}
          onChange={(lat, lng) => onChange(lat, lng)}
        />
      </div>
    </div>
  );
}
