import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { ListPropertiesDto } from './dto/list-properties.dto';
import { PropertiesService } from './properties.service';

/**
 * Endpoints públicos del marketplace.
 *
 *   GET /public/properties            → listado global (todos los tenants)
 *   GET /public/properties/:slug      → detalle dentro del tenant actual
 *                                       (requiere X-Tenant-Slug o subdominio)
 *
 * El tenant se resuelve por middleware (req.tenant). Si no hay tenant, el
 * listado es cross-tenant; el detalle por slug sí requiere tenant (un mismo
 * slug puede existir en tenants distintos, por eso no hay resolución global).
 */
@Controller('public/properties')
export class PublicPropertiesController {
  constructor(
    private readonly properties: PropertiesService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get()
  async list(@Req() req: Request, @Query() q: ListPropertiesDto) {
    return this.properties.publicList(q, req.tenant?.id);
  }

  @Public()
  @Get(':slugOrTenantSlug')
  async detail(
    @Req() req: Request,
    @Param('slugOrTenantSlug') slug: string,
    @Query('tenantSlug') tenantSlug?: string,
  ) {
    // Estrategia:
    //   - si el middleware resolvió un tenant (subdominio / header), se usa.
    //   - si no, se requiere `?tenantSlug=...` explícito para desambiguar.
    let tenantId = req.tenant?.id;
    if (!tenantId && tenantSlug) {
      const t = await this.prisma.raw.tenant.findUnique({
        where: { slug: tenantSlug.toLowerCase() },
        select: { id: true, status: true },
      });
      if (t && t.status === 'ACTIVE') tenantId = t.id;
    }
    if (!tenantId) {
      throw new NotFoundException(
        'Tenant no resuelto. Usá subdominio, X-Tenant-Slug o ?tenantSlug=',
      );
    }
    return this.properties.publicDetailBySlug(tenantId, slug);
  }
}
