import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantOnlyGuard } from '../../common/guards/tenant-only.guard';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedTenantUser } from '../auth/types';

@Controller('tenants')
@UseGuards(TenantOnlyGuard)
export class TenantsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Devuelve el tenant al que pertenece el usuario autenticado. */
  @Get('current')
  async current(@CurrentUser() user: AuthenticatedTenantUser) {
    return this.prisma.raw.tenant.findUniqueOrThrow({
      where: { id: user.tenantId },
      select: {
        id: true,
        slug: true,
        name: true,
        logoUrl: true,
        phone: true,
        email: true,
        address: true,
        city: true,
        plan: true,
        status: true,
        createdAt: true,
      },
    });
  }

  /**
   * Lista los usuarios ACTIVE del tenant. Pensado para selectores de
   * asignación (ej. asignar lead a un agente). Devuelve solo lo necesario
   * para mostrar y elegir; no expone passwordHash, lastLoginAt, etc.
   */
  @Get('users')
  async listUsers(@CurrentUser() user: AuthenticatedTenantUser) {
    return this.prisma.raw.user.findMany({
      where: { tenantId: user.tenantId, status: 'ACTIVE' },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }, { email: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
    });
  }
}
