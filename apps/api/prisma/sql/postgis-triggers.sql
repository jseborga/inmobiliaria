-- Post-migración: trigger que mantiene `properties.location` sincronizado con
-- `latitude` / `longitude`. Se ejecuta una sola vez tras `prisma migrate dev`
-- (ver `pnpm --filter @inmobiliaria/api run db:postgis-triggers`).
--
-- Idempotente: si el trigger ya existe, se reemplaza.

CREATE OR REPLACE FUNCTION properties_sync_location()
RETURNS trigger AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(
      ST_MakePoint(NEW.longitude::double precision, NEW.latitude::double precision),
      4326
    )::geography;
  ELSE
    NEW.location := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS properties_sync_location_trg ON properties;

CREATE TRIGGER properties_sync_location_trg
BEFORE INSERT OR UPDATE OF latitude, longitude
ON properties
FOR EACH ROW
EXECUTE FUNCTION properties_sync_location();

-- Índice GiST para búsquedas espaciales rápidas (ST_DWithin, ST_Intersects, etc).
CREATE INDEX IF NOT EXISTS properties_location_gix ON properties USING GIST (location);
