# syntax=docker/dockerfile:1.7
#
# Dockerfile multi-stage para apps/api.
# Build context: raíz del repo (necesita pnpm-workspace + packages/shared).
#
#   docker build -f apps/api/Dockerfile -t inmobiliaria-api .
#
# El runtime preserva la estructura del monorepo (`/repo/apps/api`,
# `/repo/packages/shared`, `/repo/node_modules`) para que los symlinks
# de pnpm hacia el workspace sigan resolviendo.

ARG NODE_VERSION=20-alpine

# ----------------------------------------------------------------------------
# Stage: deps — instala TODO el monorepo (cacheable mientras no cambien
# pnpm-lock.yaml ni los package.json)
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

# Reusa node_modules del stage anterior.
COPY --from=deps /repo /repo

COPY packages/config ./packages/config
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# prisma generate emite el cliente bajo node_modules/.pnpm/@prisma+client@.../node_modules/.prisma
WORKDIR /repo/apps/api
RUN pnpm exec prisma generate
RUN pnpm exec tsc -p tsconfig.json --noEmit false

# ----------------------------------------------------------------------------
# Stage: runner — imagen final, conserva la estructura del monorepo
# ----------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
RUN apk add --no-cache libc6-compat openssl tini
RUN corepack enable

ENV NODE_ENV=production
WORKDIR /repo

# pnpm hoistea casi todo a /repo/node_modules y deja symlinks relativos en
# apps/api/node_modules → ../../packages/shared, etc. Para que resuelvan,
# copiamos los tres a las mismas rutas.
#
# Importante: usamos `--chown=node:node` en cada COPY para que el ownership
# se asigne durante la transferencia. Un `RUN chown -R node:node /repo`
# posterior procesaba ~100k archivos en serie (de node_modules) y se colgaba
# 10+ min en disks lentos. `--chown=` lo hace incremental por capa.
COPY --from=build --chown=node:node /repo/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/packages/shared ./packages/shared
COPY --from=build --chown=node:node /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=node:node /repo/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=node:node /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /repo/pnpm-workspace.yaml /repo/package.json /repo/pnpm-lock.yaml ./

# Directorio para el mock storage (en prod montar volumen o usar R2).
# Solo chown de esta carpeta — el resto ya viene con ownership correcto.
RUN mkdir -p /repo/apps/api/storage/uploads && chown node:node /repo/apps/api/storage /repo/apps/api/storage/uploads

WORKDIR /repo/apps/api
USER node

EXPOSE 3001

# Entrypoint: aplica migraciones pendientes (idempotente) y arranca node.
# `prisma migrate deploy` solo aplica las nuevas y no requiere shadow DB.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "node ../../node_modules/prisma/build/index.js migrate deploy --schema=./prisma/schema.prisma && node dist/main.js"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3001/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
