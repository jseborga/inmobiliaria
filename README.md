# Inmobiliaria

Sistema inmobiliario multi-tenant. Portal público (marketplace global + sitio por inmobiliaria) y panel admin para gestión de propiedades, usuarios y leads.

## Stack

- **Backend:** NestJS + Prisma + PostgreSQL + Redis
- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind
- **Monorepo:** pnpm workspaces + Turborepo
- **Multi-tenancy:** row-level filtering por `tenant_id` (shared DB, shared schema)

## Estructura

```
inmobiliaria/
├── apps/
│   ├── api/            # NestJS + Prisma
│   └── web/            # Next.js (portal público + admin)
├── packages/
│   ├── shared/         # Tipos, enums y validadores Zod compartidos
│   └── config/         # tsconfig, ESLint base
├── docker-compose.yml  # Postgres + Redis para dev local
└── turbo.json
```

## Requisitos

- Node.js >= 20
- pnpm >= 9
- Docker + docker-compose

## Setup inicial

```bash
# 1. Instalar dependencias
pnpm install

# 2. Copiar variables de entorno
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# 3. Levantar Postgres + Redis
pnpm db:up

# 4. Generar cliente Prisma y correr migración inicial
pnpm --filter @inmobiliaria/api prisma:generate
pnpm --filter @inmobiliaria/api exec prisma migrate dev --name init

# 4b. Aplicar triggers PostGIS (idempotente). Requiere extensión `postgis` habilitada.
pnpm --filter @inmobiliaria/api db:postgis-triggers

# 5. Sembrar el primer super-admin (lee SUPER_ADMIN_* de apps/api/.env)
pnpm --filter @inmobiliaria/api prisma:seed

# 6. Levantar todo en modo dev
pnpm dev

# 7. (opcional) Smoke test end-to-end contra la API
bash scripts/smoke-test.sh
```

- API: http://localhost:3001/api/health
- Web: http://localhost:3000

## Scripts raíz

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Levanta api + web en paralelo |
| `pnpm build` | Build de todos los apps/packages |
| `pnpm lint` | Lint en todo el monorepo |
| `pnpm typecheck` | Typecheck completo |
| `pnpm format` | Prettier sobre todo |
| `pnpm db:up` | Postgres + Redis en Docker |
| `pnpm db:down` | Apagar Postgres + Redis |

## Roadmap

- **Fase 1:** Diseño (completado)
- **Fase 2:** Setup monorepo e infra base (completado)
- **Fase 3:** Auth + multi-tenancy core (completado)
- **Fase 4:** Gestión de propiedades + upload de imágenes (completado)
- **Fase 5:** Portal público + búsqueda (API completa; UI pendiente)
- **Fase 6:** CRM de leads (API + captura pública completos)
- **Fase 7:** Observabilidad + deploy producción

## Convenciones

- Multi-tenancy: todas las tablas de negocio llevan `tenant_id`. El filtrado se hace automáticamente vía extensión Prisma scope-aware (AsyncLocalStorage).
- Moneda: BOB y USD soportadas desde el inicio. Operación ANTICRETICO disponible.
- Tenants se identifican por subdominio en producción (`empresa.miapp.com`) y por header `X-Tenant-Slug` en dev.

## Auth (Fase 3)

Hay **dos tipos de sujetos autenticados**, distinguidos por el claim `kind` en el JWT:

- **`TENANT`** — usuarios de una inmobiliaria (OWNER / ADMIN / AGENT).
- **`PLATFORM`** — super-admins de la plataforma (global, sin tenant). Solo ellos pueden crear nuevos tenants.

**No existe registro público.** El onboarding de inmobiliarias es siempre por invitación: un super-admin crea el tenant y su usuario OWNER inicial.

### Flujo de onboarding

```
1. (una sola vez) pnpm --filter @inmobiliaria/api prisma:seed
   → crea el primer PlatformAdmin a partir de SUPER_ADMIN_* en .env

2. POST /api/platform-admin/auth/login
   { "email": "...", "password": "..." }
   → setea cookie httpOnly `platform_refresh_token`
   → devuelve { admin, tokens: { accessToken, accessTokenExpiresIn } }

3. POST /api/platform-admin/tenants        (Bearer accessToken del paso 2)
   { slug, name, ownerEmail, ownerPassword, ownerFirstName, ownerLastName, ... }
   → crea Tenant + User OWNER en una transacción

4. El OWNER ya puede loguearse:
   POST /api/auth/login
   { "tenantSlug": "...", "email": "...", "password": "..." }
   → setea cookie httpOnly `refresh_token`
   → devuelve { user, tenant, tokens }
```

### Endpoints principales

| Método | Ruta | Sujeto | Descripción |
|---|---|---|---|
| POST | `/api/auth/login` | público | Login de usuario de tenant |
| POST | `/api/auth/refresh` | cookie | Rota refresh token y emite nuevo access |
| POST | `/api/auth/logout` | cookie | Revoca refresh token |
| GET  | `/api/auth/me` | TENANT | Datos del usuario autenticado |
| POST | `/api/platform-admin/auth/login` | público | Login de super-admin |
| POST | `/api/platform-admin/auth/refresh` | cookie | Refresh de super-admin |
| POST | `/api/platform-admin/auth/logout` | cookie | Logout de super-admin |
| GET  | `/api/platform-admin/auth/me` | PLATFORM | Datos del super-admin |
| POST | `/api/platform-admin/tenants` | PLATFORM | Crea Tenant + OWNER |
| GET  | `/api/platform-admin/tenants` | PLATFORM | Lista tenants (paginado) |
| GET  | `/api/tenants/current` | TENANT | Tenant del usuario actual |

### Tokens


- **Access token:** JWT firmado con `JWT_ACCESS_SECRET`, TTL corto (`JWT_ACCESS_TTL`, default `15m`). Se envía en `Authorization: Bearer <token>`.
- **Refresh token:** string opaco de alta entropía, guardado hasheado (SHA-256) en DB. Vive en cookie `httpOnly` + `sameSite=strict`. TTL por `JWT_REFRESH_TTL` (default `7d`). Rotado en cada `/refresh` (el anterior se marca `revokedAt`).
- Cookies separadas para cada tipo de sujeto (`refresh_token` vs `platform_refresh_token`), con `path` aislado.

## Propiedades y marketplace (Fase 4 + 5 API)

### CRUD admin (tenant-scoped)

Todas las rutas debajo requieren `Authorization: Bearer <accessToken>` de un usuario del tenant.

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET    | `/api/properties` | cualquier tenant user | Lista paginada con filtros |
| GET    | `/api/properties/:id` | cualquier tenant user | Detalle con imágenes |
| POST   | `/api/properties` | OWNER/ADMIN/AGENT | Crea (status default `DRAFT`) |
| PUT    | `/api/properties/:id` | OWNER/ADMIN/AGENT | Update parcial (transiciona status) |
| DELETE | `/api/properties/:id` | OWNER/ADMIN | Borra propiedad + imágenes |
| POST   | `/api/properties/:id/images/presign` | OWNER/ADMIN/AGENT | Pide URL presigned para subir imagen |
| POST   | `/api/properties/:id/images` | OWNER/ADMIN/AGENT | Confirma imagen subida (persiste en DB) |
| DELETE | `/api/properties/:id/images/:imageId` | OWNER/ADMIN/AGENT | Borra imagen |

Filtros del listado (`GET /api/properties?...`): `status`, `operation`, `type`, `currency`, `city`, `zone`, `q` (texto libre), `minPrice`, `maxPrice`, `bedrooms`, `bathrooms`, `nearLat`/`nearLng`/`radiusKm` (búsqueda geoespacial vía PostGIS), `take`, `skip`.

### Marketplace público (Fase 5 API)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/public/properties` | Listado global (todos los tenants) con `status=PUBLISHED`. Acepta los mismos filtros del admin. Si el request trae `X-Tenant-Slug` o subdominio, se filtra por ese tenant (sitio por inmobiliaria). |
| GET | `/api/public/properties/:slug?tenantSlug=...` | Detalle por slug. Requiere saber el tenant (subdominio, header `X-Tenant-Slug` o query `tenantSlug`). |

### Upload de imágenes

Flujo en 3 pasos (presigned PUT, sin que el archivo pase por la API):

```
1. POST /api/properties/:id/images/presign
   body: { contentType: "image/jpeg", contentLength: <bytes> }
   → { uploadUrl, method: "PUT", headers, r2Key, publicUrl, expiresIn }

2. PUT <uploadUrl>  con los headers indicados y el body del archivo
   → 200 OK  (ida directa a R2 o al mock local)

3. POST /api/properties/:id/images
   body: { r2Key, publicUrl, order?, width?, height? }
   → { id, r2Key, publicUrl, ... }
```

**Storage driver**: si las 5 vars `R2_*` están configuradas, firma contra Cloudflare R2. Si no, cae a un mock local que guarda bajo `storage/uploads/` y sirve en `/api/_mock-storage/:key`. Esto permite probar el flow completo en dev sin R2.

Content types aceptados: `image/jpeg`, `image/png`, `image/webp`, `image/avif`. Tamaño máximo: 10 MB.

### Búsqueda geoespacial

Se implementa con PostGIS (`ST_DWithin` + `ST_Distance`). Un trigger (`apps/api/prisma/sql/postgis-triggers.sql`) mantiene la columna `properties.location` sincronizada con `latitude/longitude`. Aplicar una sola vez post-migración con:

```bash
pnpm --filter @inmobiliaria/api db:postgis-triggers
```

## CRM de leads (Fase 6)

Gestión de contactos comerciales capturados desde el marketplace o ingresados manualmente, con timeline de actividades por lead.

### Modelo

- **Lead**: contacto (nombre, email, phone, mensaje), opcionalmente ligado a una `Property`. Campos de auditoría `source_ip`, `source_user_agent`, `source_referrer` para leads públicos. Enums:
  - `LeadStatus`: `NEW`, `CONTACTED`, `QUALIFIED`, `CONVERTED`, `LOST`
  - `LeadSource`: `WEB`, `WHATSAPP`, `PHONE`, `REFERRAL`, `OTHER`
- **LeadActivity**: entrada del timeline (`NOTE`, `CALL`, `EMAIL`, `WHATSAPP`, `MEETING` — manuales; `CREATED`, `STATUS_CHANGE`, `ASSIGNMENT` — automáticas emitidas por el service).

### Captura pública (sin auth)

```
POST /api/public/leads
{
  "tenantSlug": "demo",          // opcional si hay subdominio/X-Tenant-Slug
  "propertyId": "cktid...",      // opcional (resuelve tenant si no lo hay)
  "firstName": "Juan",
  "lastName":  "Pérez",
  "email":     "juan@example.com",
  "phone":     "+59170000000",
  "message":   "Me interesa, ¿está disponible?",
  "source":    "WEB"
}
→ 201 { id, createdAt }
```

Resolución del tenant, en orden: middleware (subdominio/header) → `tenantSlug` → `tenantId` de la `propertyId`. Debe venir al menos uno de `email` o `phone`. Se crea automáticamente una actividad `CREATED` con metadata del origen.

### CRUD admin (tenant-scoped)

Todas las rutas requieren `Authorization: Bearer <accessToken>` de un usuario del tenant.

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET    | `/api/leads` | cualquier tenant user | Lista paginada con filtros |
| GET    | `/api/leads/:id` | cualquier tenant user | Detalle con timeline de actividades |
| POST   | `/api/leads` | OWNER/ADMIN/AGENT | Crea lead manual (ej. walk-in, llamada) |
| PATCH  | `/api/leads/:id` | OWNER/ADMIN/AGENT | Actualiza status, asignación, contacto |
| DELETE | `/api/leads/:id` | OWNER/ADMIN | Borra lead (cascada a actividades) |
| POST   | `/api/leads/:id/activities` | OWNER/ADMIN/AGENT | Registra actividad manual (NOTE/CALL/EMAIL/WHATSAPP/MEETING) |

Filtros del listado: `status`, `source`, `propertyId`, `assignedUserId` (acepta `me` para filtrar por el usuario actual), `q` (búsqueda libre en nombre/email/teléfono/mensaje), `take`, `skip`.

Eventos automáticos emitidos por el service:

- Cambio de `status` → crea actividad `STATUS_CHANGE` con `{from, to}` en metadata.
- Cambio de `assignedUserId` (incluye desasignar con `null`) → crea actividad `ASSIGNMENT`.
- Actividades de contacto real (`CALL`/`EMAIL`/`WHATSAPP`/`MEETING`) actualizan `lead.lastContactedAt`.

Los kinds `CREATED`, `STATUS_CHANGE` y `ASSIGNMENT` están reservados al sistema: intentar emitirlos manualmente por `/activities` devuelve `403`.
