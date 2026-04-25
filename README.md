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
- **Fase 5:** Portal público + búsqueda
  - **5.0** Fundaciones del web (shadcn, cliente API, middleware multi-tenant) — completado
  - **5.1** Marketplace público + captura de leads — completado
  - **5.2** Admin: autenticación — completado
  - **5.3** Admin: gestión de propiedades + upload imágenes — completado
  - **5.4** Admin: CRM leads + timeline — completado
- **Fase 6:** CRM de leads (API + captura pública completos; UI en Fase 5.4)
- **Fase 7:** Deploy productivo
  - **7.0** Dockerfiles + migrations + `docker-compose.prod.yml` (guía Easypanel) — completado
  - **7.1** Observabilidad (Sentry, structured logs) — pendiente
  - **7.2** CI (typecheck/lint/build en PR) — pendiente

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
| GET  | `/api/tenants/users` | TENANT | Lista usuarios ACTIVE del tenant (selector de asignación) |

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

## Frontend (Fase 5.0)

### Multi-tenancy por subdominio

El web resuelve el contexto a partir del host (`apps/web/src/middleware.ts`):

| Host | Contexto | Tenant resuelto |
|---|---|---|
| `lvh.me:3000` | `marketplace` | ninguno (catálogo global) |
| `acme.lvh.me:3000` | `tenant` | `acme` (sitio de la inmobiliaria) |
| `admin.lvh.me:3000` | `admin` | derivado del usuario logueado |

En dev usamos `lvh.me` que resuelve a `127.0.0.1` sin tocar `/etc/hosts`. Configurable vía `NEXT_PUBLIC_ROOT_DOMAIN` en `apps/web/.env.local`.

El middleware inyecta los headers `x-app-context` y `x-tenant-slug` para que los Server Components y route handlers no parseen el host.

### Stack UI

- **shadcn/ui** (componentes accesibles copiados localmente en `src/components/ui/`)
- **react-hook-form + Zod** para formularios; los schemas viven en `@inmobiliaria/shared/dto/*` y se reutilizan entre frontend y backend.
- **sonner** para toasts (`Toaster` en el root layout).
- **lucide-react** para iconos.

### Cliente API

`apps/web/src/lib/api/` expone:

- `createApiClient({ baseUrl, accessToken, tenantSlug, cookieHeader })` — wrapper sobre `fetch` con manejo automático de `Authorization`, `X-Tenant-Slug`, JSON, `cache` y `tags` de Next.
- `getServerApi()` — builder para Server Components y route handlers que toma access token de la cookie httpOnly `web_session` y forwardea las cookies de refresh al backend.
- `ApiError` — error tipado con `status`, `body` y `displayMessage` para presentar al usuario.

## Marketplace público (Fase 5.1)

Páginas públicas (sin auth) consumidas desde el web:

| Ruta | Contexto | Descripción |
|---|---|---|
| `/` | cualquiera | Landing tenant-aware (CTA cambia si estamos en `lvh.me` vs `acme.lvh.me`) |
| `/properties` | cualquiera | Listado con filtros (operación, tipo, ubicación, precio, dorm./baños). En marketplace global lista todos los tenants; en sitio de tenant filtra por ese tenant |
| `/properties/[slug]` | tenant | Detalle con galería de fotos, datos de contacto y form de captura de lead |

Implementación:

- Server Components con `getPublicApi()` (`apps/web/src/lib/api/public.ts`) — toma el `tenantSlug` del contexto resuelto por el middleware.
- En el marketplace global (`lvh.me`), las cards linkean al sitio del tenant (`acme.lvh.me/properties/[slug]`) usando `buildTenantUrl()`.
- El form de leads (`apps/web/src/components/leads/lead-form.tsx`) usa `react-hook-form` + Zod (`publicLeadSchema` de `@inmobiliaria/shared`) y postea a `/api/leads`, un route handler que proxea a `POST /api/public/leads` en el backend, forwardeando `User-Agent` y `Referer` para auditoría.
- Filtros sincronizan con la URL — Server Component re-renderiza al cambiar `searchParams`.

## Admin (Fase 5.2)

Panel de gestión protegido detrás de auth de tenant.

| Ruta | Tipo | Descripción |
|---|---|---|
| `/login` | público | Form RHF + Zod (`tenantLoginSchema`). Si entrás desde un subdominio (`acme.lvh.me`) el slug viene precargado y oculto |
| `/admin` | protegida | Dashboard con stats (propiedades totales/publicadas, leads totales/nuevos) + accesos directos |
| `POST /api/auth/login` | route handler | Proxy a `POST /api/auth/login` del API. Captura el `Set-Cookie: refresh_token` y lo re-emite en el dominio del web; setea `web_session` (httpOnly) con el access token |
| `POST /api/auth/refresh` | route handler | Rota tokens; si falla, limpia cookies (cliente debe redirigir a `/login`) |
| `POST /api/auth/logout` | route handler | Revoca el refresh en el API y borra cookies del web |

### Cookies

- `web_session` (`httpOnly`, `path=/`, `sameSite=lax`): contiene el access token JWT. Server Components y route handlers lo leen para inyectar `Authorization: Bearer` cuando llaman al API.
- `refresh_token` (`httpOnly`, `path=/api/auth`, `sameSite=strict`): re-emitido por el web tras login (no se comparte cross-domain con el API). Solo se envía a `/api/auth/*` del web.

> En `NODE_ENV=production` ambas cookies se emiten con `Secure`, por lo que **requieren HTTPS**. Para probar la build de producción localmente sobre HTTP, usá `next dev` (o un reverse proxy con TLS).

### Server-side guards

- `getCurrentUser()` (`apps/web/src/lib/auth/session.ts`): devuelve el `MeResponse` o `null`. Llama a `GET /auth/me`, trata 401/403 como "no logueado".
- `requireUser(nextPath)`: redirige a `/login?next=...` si no hay sesión. El layout `app/admin/layout.tsx` lo invoca.

## Admin: propiedades + imágenes (Fase 5.3)

CRUD de propiedades con upload de imágenes vía presigned PUT.

| Ruta | Tipo | Descripción |
|---|---|---|
| `/admin/properties` | protegida | Tabla con filtros (q, status, operación, tipo) + paginación |
| `/admin/properties/new` | protegida | Form de creación. Status default `DRAFT` |
| `/admin/properties/[id]/edit` | protegida | Form de edición + galería de imágenes + acciones de status (Publicar/Despublicar/Archivar/Eliminar) |

### Server actions

Todas las mutaciones usan **server actions** en `apps/web/src/lib/actions/`:

- `createProperty(input)`, `updateProperty(id, input)`: validan con `propertyCreateSchema`/`propertyUpdateSchema` de `@inmobiliaria/shared`. Devuelven `ActionResult<T>` con `fieldErrors` mapeados desde Zod issues.
- `setPropertyStatus(id, status)`: transiciona DRAFT/PUBLISHED/ARCHIVED. La API setea automáticamente `publishedAt`/`archivedAt`.
- `deleteProperty(id)` y `deletePropertyAndRedirect(id)`.
- `presignPropertyImage(propertyId, contentType, size)`, `confirmPropertyImage(propertyId, payload)`, `deletePropertyImage(propertyId, imageId)`.

Cada mutación llama `revalidatePath('/admin/properties')`, `revalidatePath('/admin')` y `revalidateTag('public-properties')` para refrescar tanto la UI admin como el marketplace público.

### Upload de imágenes (3 pasos)

```
1. Cliente: presignPropertyImage(propertyId, file.type, file.size)
   → server action llama POST /api/properties/:id/images/presign
   ← { uploadUrl, headers, r2Key, publicUrl, expiresIn }

2. Cliente: fetch(uploadUrl, { method:'PUT', headers, body: file })
   → va directo al storage (R2 o mock); el access token NO viaja al storage,
     la firma presigned ya autoriza la subida (TTL 5 min)

3. Cliente: confirmPropertyImage(propertyId, { r2Key, publicUrl, width, height })
   → server action llama POST /api/properties/:id/images
   ← persistido en DB, revalidatePath del edit
```

Tipos aceptados: `image/jpeg`, `image/png`, `image/webp`, `image/avif`. Tamaño máximo 10 MB por imagen.

## Admin: CRM leads (Fase 5.4)

Gestión completa de leads del marketplace + entrada manual del equipo.

| Ruta | Tipo | Descripción |
|---|---|---|
| `/admin/leads` | protegida | Tabla con filtros (q, status, source, mine=1) + paginación |
| `/admin/leads/new` | protegida | Form de alta manual (llamada, walk-in, referido) |
| `/admin/leads/[id]` | protegida | Detalle con timeline, status/asignación inline, form de nueva actividad, eliminar |

### Server actions

`apps/web/src/lib/actions/leads.ts`:

- `createLead(input)`: alta manual; valida con `adminLeadCreateSchema`.
- `updateLead(id, patch)`: cambio de status, asignación, contacto. La API emite automáticamente actividades `STATUS_CHANGE` y `ASSIGNMENT` cuando aplica.
- `addLeadActivity(leadId, { kind, body })`: solo kinds manuales (NOTE/CALL/EMAIL/WHATSAPP/MEETING). El API rechaza con 403 los kinds reservados (CREATED/STATUS_CHANGE/ASSIGNMENT).
- `deleteLead(id)` / `deleteLeadAndRedirect(id)`: cascada a actividades.

Cada mutación revalida `/admin/leads` y `/admin/leads/[id]` para que la UI quede consistente sin reload del browser.

### Timeline

Ordenado descendente (más reciente arriba). Distingue visualmente:

- **Manuales** (NOTE/CALL/EMAIL/WHATSAPP/MEETING): icono coloreado, body con whitespace preservado, autor visible.
- **Automáticas** (CREATED/STATUS_CHANGE/ASSIGNMENT): borde punteado, fondo sobrio, metadata estructurada (`from → to` para status, `from/to` para asignación).

### Filtro `mine=1`

El UI checkbox "Solo míos" se traduce a `?assignedUserId=me` en la API, que resuelve `me` al usuario autenticado en el controller.

## Deploy productivo (Fase 7.0)

Stack containerizada lista para Easypanel u otro orquestador con Docker.

### Estructura

| Archivo | Para qué |
|---|---|
| `apps/api/Dockerfile` | Imagen multi-stage del API (Nest + Prisma). Aplica `migrate deploy` al arrancar |
| `apps/web/Dockerfile` | Imagen multi-stage del web (Next.js standalone). `NEXT_PUBLIC_*` se inlinean en build |
| `docker-compose.prod.yml` | Postgres + PostGIS, Redis, API, web. Volúmenes persistentes |
| `.env.prod.example` | Plantilla de variables (copiar a `.env.prod` y editar) |
| `apps/api/prisma/migrations/0_init/` | Migración inicial (incluye triggers PostGIS) |

### Local prod-like

```bash
cp .env.prod.example .env.prod
# editar secretos: POSTGRES_PASSWORD, JWT_*, SUPER_ADMIN_*, WEB_SESSION_SECRET
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# Crear el primer super-admin (lee SUPER_ADMIN_* del entorno):
docker compose -f docker-compose.prod.yml exec api \
  node ../../node_modules/prisma/build/index.js db seed --schema=./prisma/schema.prisma
```

API queda en `:3001/api/health`, web en `:3000/`.

### Easypanel

1. **Postgres + Redis**: usar los templates de Easypanel. Postgres debe tener PostGIS — la imagen sugerida es `postgis/postgis:16-3.4-alpine` (template "App" con esa imagen, o reemplazá la imagen del template Postgres por esta).
2. **API**: app tipo "Dockerfile" apuntando a `apps/api/Dockerfile`, build context = raíz del repo.
3. **Web**: app tipo "Dockerfile" apuntando a `apps/web/Dockerfile`, mismo build context. **Importante:** los `NEXT_PUBLIC_API_URL` y `NEXT_PUBLIC_ROOT_DOMAIN` van como **build args**, no como env runtime — Easypanel tiene un campo separado para eso. Si los cambiás, hay que rebuildear.
4. **Dominios**: Easypanel + Caddy ruteán por subdominio. Sugerido:
   - `api.tu-dominio.com` → service `api` puerto 3001.
   - `app.tu-dominio.com` y wildcard `*.tu-dominio.com` → service `web` puerto 3000 (el wildcard se necesita para los sitios por inmobiliaria, p.ej. `acme.tu-dominio.com`).
5. **TLS wildcard**: para que `*.tu-dominio.com` reciba certificado, configurá DNS challenge en Caddy (Easypanel lo soporta vía env del proxy).
6. **Volúmenes**: si no usás R2, montá un volumen sobre `/repo/apps/api/storage/uploads` para persistir las imágenes del mock.

### Variables críticas

- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `WEB_SESSION_SECRET`: generar con `openssl rand -base64 48`. **Nunca reusar entre envs**.
- `CORS_ORIGINS`: lista coma-separada (incluí HTTPS y todos los subdominios desde donde el web haga fetch).
- `R2_*`: si están las 5, el storage usa Cloudflare R2; si alguna falta, cae al mock en disco.

### Migraciones

El entrypoint del API ejecuta `prisma migrate deploy` antes de arrancar — idempotente. Para nuevas migraciones en dev:

```bash
pnpm --filter @inmobiliaria/api exec prisma migrate dev --name descripcion_corta
git add apps/api/prisma/migrations
```

### Tests

Playwright vive en `apps/web/tests/e2e/`. Levanta el dev server automáticamente:

```bash
pnpm --filter @inmobiliaria/web test:e2e
# o con UI interactiva:
pnpm --filter @inmobiliaria/web test:e2e:ui
```

La API debe estar corriendo aparte (`pnpm --filter @inmobiliaria/api dev`). El smoke-test de la API (`scripts/smoke-test.sh`) sigue siendo la suite e2e de referencia para el backend.
