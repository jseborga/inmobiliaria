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
pnpm --filter @inmobiliaria/api exec prisma migrate dev --name init_auth

# 5. Sembrar el primer super-admin (lee SUPER_ADMIN_* de apps/api/.env)
pnpm --filter @inmobiliaria/api prisma:seed

# 6. Levantar todo en modo dev
pnpm dev
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
- **Fase 3:** Auth + multi-tenancy core (actual)
- **Fase 4:** Gestión de propiedades (admin)
- **Fase 5:** Portal público + búsqueda
- **Fase 6:** CRM de leads
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
