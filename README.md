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

# 4. Generar cliente Prisma y correr migración inicial (se crea en Fase 3)
cd apps/api && pnpm prisma:generate && cd -

# 5. Levantar todo en modo dev
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
- **Fase 2:** Setup monorepo e infra base (actual)
- **Fase 3:** Auth + multi-tenancy core
- **Fase 4:** Gestión de propiedades (admin)
- **Fase 5:** Portal público + búsqueda
- **Fase 6:** CRM de leads
- **Fase 7:** Observabilidad + deploy producción

## Convenciones

- Multi-tenancy: todas las tablas de negocio llevan `tenant_id`. El filtrado se hace automáticamente vía extensión Prisma (Fase 3).
- Moneda: BOB y USD soportadas desde el inicio. Operación ANTICRETICO disponible.
- Tenants se identifican por subdominio en producción (`empresa.miapp.com`) y por header `X-Tenant-Slug` en dev.
