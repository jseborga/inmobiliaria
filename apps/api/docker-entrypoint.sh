#!/bin/sh
# Entrypoint del contenedor API.
# Orquesta: migraciones → trigger PostGIS → seeds opcionales → arrancar API.
#
# Cada paso es idempotente: corre seguro en cada boot, sin duplicar datos.
set -e

APP_DIR=/repo/apps/api
PRISMA_BIN="$APP_DIR/node_modules/prisma/build/index.js"
SCHEMA="$APP_DIR/prisma/schema.prisma"

cd "$APP_DIR"

echo "[entrypoint] Aplicando migraciones..."
node "$PRISMA_BIN" migrate deploy --schema="$SCHEMA"

# El trigger sincroniza properties.location (PostGIS) con latitude/longitude.
# `prisma db execute` es idempotente porque el SQL usa CREATE OR REPLACE /
# DROP TRIGGER IF EXISTS / CREATE INDEX IF NOT EXISTS.
echo "[entrypoint] Aplicando trigger PostGIS (idempotente)..."
node "$PRISMA_BIN" db execute \
  --file "$APP_DIR/prisma/sql/postgis-triggers.sql" \
  --schema "$SCHEMA" || echo "[entrypoint] trigger PostGIS falló (sigo)"

# Super-admin de plataforma. Idempotente (skip si el email ya existe).
if [ "${RUN_SEED_ON_BOOT:-0}" = "1" ]; then
  echo "[entrypoint] Seed: super-admin de plataforma..."
  node "$APP_DIR/prisma/dist/seed.js" || echo "[entrypoint] seed super-admin falló (sigo)"
fi

# Datos de demo (1 tenant + OWNER + 8 propiedades). Idempotente (skip si tenant existe).
if [ "${RUN_DEMO_SEED_ON_BOOT:-0}" = "1" ]; then
  echo "[entrypoint] Seed: datos de demo..."
  node "$APP_DIR/prisma/dist/seed-demo.js" || echo "[entrypoint] seed demo falló (sigo)"
fi

echo "[entrypoint] Iniciando API..."
exec node "$APP_DIR/dist/main.js"
