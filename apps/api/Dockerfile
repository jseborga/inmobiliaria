# syntax=docker/dockerfile:1.7
#
# Dockerfile multi-stage para apps/api.
# Build context: raíz del repo (necesita pnpm-workspace + packages/shared).
#
# Estrategia:
#   - `deps`     : instala TODAS las deps (build + runtime) — necesario para tsc
#   - `build`    : prisma generate + tsc (usa `deps`)
#   - `prod-deps`: instala SOLO deps de producción (paralelo a `build`)
#   - `runner`   : runtime mínimo. Copia node_modules de `prod-deps` (~250MB
#                  en lugar de ~1GB) + dist de `build`. Imagen final ~350MB.
#
# Esto reduce drasticamente el tiempo de COPY al runner y el tamaño final
# de la imagen. BuildKit corre `build` y `prod-deps` en paralelo, así que
# el wall-clock del primer build no se duplica.

ARG NODE_VERSION=20-alpine

# ----------------------------------------------------------------------------
# Stage: deps — instala TODO (build + dev deps)
# ----------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS deps
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable

WORKDIR /repo
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/config/package.json packages/config/

RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ----------------------------------------------------------------------------
# Stage: build — prisma generate + tsc
# ----------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS build
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable

WORKDIR /repo
COPY --from=deps /repo /repo

COPY packages/config ./packages/config
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

WORKDIR /repo/apps/api
RUN pnpm exec prisma generate
RUN pnpm exec tsc -p tsconfig.json --noEmit false

# ----------------------------------------------------------------------------
# Stage: prod-deps — solo deps de producción (sin tsc, eslint, ts-node, etc.)
# Corre en paralelo con `build` gracias a BuildKit.
# ----------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS prod-deps
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable

WORKDIR /repo
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/config/package.json packages/config/

# Necesitamos el sourcecode de @inmobiliaria/shared (workspace dep)
# para que el symlink en apps/api/node_modules apunte a algo real.
COPY packages/shared ./packages/shared

# pnpm install --prod skipea devDependencies → ~250MB en vez de ~1GB.
# `--filter @inmobiliaria/api...` instala solo lo que el API necesita
# (con sus deps transitivas) — no instala las deps específicas del web.
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --prod --frozen-lockfile --filter "@inmobiliaria/api..."

# ----------------------------------------------------------------------------
# Stage: runner — imagen final mínima
# ----------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
RUN apk add --no-cache libc6-compat openssl tini
RUN corepack enable

ENV NODE_ENV=production
WORKDIR /repo

# node_modules sin devDeps (~250MB vs ~1GB).
COPY --from=prod-deps --chown=node:node /repo/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /repo/packages/shared ./packages/shared
COPY --from=prod-deps --chown=node:node /repo/apps/api/node_modules ./apps/api/node_modules

# Build artifacts (dist + prisma + workspace files)
COPY --from=build --chown=node:node /repo/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=node:node /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /repo/pnpm-workspace.yaml /repo/package.json /repo/pnpm-lock.yaml ./

# Directorio para el mock storage (en prod montar volumen o usar R2).
RUN mkdir -p /repo/apps/api/storage/uploads \
    && chown node:node /repo/apps/api/storage /repo/apps/api/storage/uploads

WORKDIR /repo/apps/api
USER node

EXPOSE 3001

# Entrypoint: aplica migraciones pendientes (idempotente) y arranca node.
# `prisma migrate deploy` solo aplica las nuevas y no requiere shadow DB.
#
# La ruta `./node_modules/prisma/build/index.js` es relativa al WORKDIR
# (/repo/apps/api). pnpm con workspaces no hoistea automáticamente
# `prisma` al node_modules raíz — el symlink vive solo en apps/api/node_modules.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "node ./node_modules/prisma/build/index.js migrate deploy --schema=./prisma/schema.prisma && node dist/main.js"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3001/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
