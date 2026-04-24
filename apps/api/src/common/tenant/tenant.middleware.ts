import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Resuelve el tenant a partir del request y lo adjunta a `req.tenant`.
 * Fuentes en orden de prioridad:
 *   1. Header `X-Tenant-Slug` (dev / API clients externos).
 *   2. Subdominio del Host (producci\u00f3n: `empresa.miapp.com`).
 *
 * No autentica; solo resuelve. Si no se encuentra tenant, contin\u00faa sin
 * setearlo (rutas p\u00fablicas/marketplace no lo requieren). Los guards de
 * rutas privadas deben exigirlo expl\u00edcitamente.
 *
 * La declaraci\u00f3n de tipos de `req.tenant` vive en modules/auth/types.ts.
 */

@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantResolverMiddleware.name);
  private readonly rootDomain: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.rootDomain = this.config.get<string>('ROOT_DOMAIN', 'localhost:3000');
  }

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const slug = this.extractSlug(req);
    if (!slug) {
      return next();
    }

    try {
      const tenant = await this.prisma.raw.tenant.findUnique({
        where: { slug },
        select: { id: true, slug: true, name: true, status: true },
      });
      if (tenant && tenant.status === 'ACTIVE') {
        req.tenant = { id: tenant.id, slug: tenant.slug, name: tenant.name };
      }
    } catch (err) {
      this.logger.warn(`No se pudo resolver tenant slug="${slug}": ${(err as Error).message}`);
    }

    next();
  }

  private extractSlug(req: Request): string | null {
    const headerSlug = req.header('x-tenant-slug');
    if (headerSlug) return headerSlug.toLowerCase();

    const host = (req.header('x-forwarded-host') ?? req.header('host') ?? '').toLowerCase();
    if (!host) return null;

    // En dev podemos recibir `empresa.localhost:3001`
    const hostNoPort = host.split(':')[0] ?? '';
    const rootNoPort = this.rootDomain.split(':')[0] ?? '';

    if (!rootNoPort || hostNoPort === rootNoPort) return null;
    if (!hostNoPort.endsWith(`.${rootNoPort}`)) return null;

    const sub = hostNoPort.slice(0, -1 * (rootNoPort.length + 1));
    if (!sub || sub === 'www' || sub === 'api') return null;
    return sub;
  }
}
