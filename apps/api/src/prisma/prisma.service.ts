import { Injectable, type OnModuleInit, type OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { tenantScopedExtension } from './tenant-scoped.extension';

export type ExtendedPrismaClient = ReturnType<typeof buildExtended>;

function buildExtended(raw: PrismaClient) {
  return raw.$extends(tenantScopedExtension());
}

/**
 * Cliente Prisma con multi-tenancy aplicada v\u00eda extensi\u00f3n.
 *
 * Uso recomendado:
 *   - `prisma.client` \u2192 cliente con filtrado autom\u00e1tico por tenant_id.
 *   - `prisma.raw`    \u2192 cliente sin extensi\u00f3n; solo para operaciones de
 *                        bootstrap (crear un Tenant, login por email, etc.).
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  public readonly raw: PrismaClient;
  public readonly client: ExtendedPrismaClient;

  constructor() {
    this.raw = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
    this.client = buildExtended(this.raw);
  }

  async onModuleInit(): Promise<void> {
    await this.raw.$connect();
    this.logger.log('Prisma conectado');
  }

  async onModuleDestroy(): Promise<void> {
    await this.raw.$disconnect();
  }
}
