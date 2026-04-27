# Postgres 16 con PostGIS 3.4 + pgvector.
# Base: imagen oficial de PostGIS (Debian, no Alpine — para tener apt y poder
# instalar pgvector como paquete del repo PGDG sin compilar).
# La extensión `vector` queda disponible; las migraciones la habilitan con
# `CREATE EXTENSION vector` en cada DB.

FROM postgis/postgis:16-3.4

RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-16-pgvector \
    && rm -rf /var/lib/apt/lists/*
