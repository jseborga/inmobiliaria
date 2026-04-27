import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantOnlyGuard } from '../../common/guards/tenant-only.guard';
import type { AuthenticatedTenantUser } from '../auth/types';
import { GeneratePropertyDescriptionDto } from './dto/generate-description.dto';
import { PropertyDescriptionService } from './property-description.service';

/**
 * Endpoints de IA para tenant users. Toda mutación que usa LLM debería pasar
 * por acá para centralizar logging, rate limiting (futuro) y selección de
 * provider/modelo.
 *
 * Nota: el diagnóstico de providers (qué provider/modelo está disponible)
 * vive ahora en el panel super-admin (/platform-admin/ai-settings) — desde
 * el Sprint 1.5 los providers se resuelven por tenant en cada llamada.
 */
@Controller('ai')
@UseGuards(TenantOnlyGuard)
export class AIController {
  constructor(private readonly descriptions: PropertyDescriptionService) {}

  /**
   * Genera una descripción comercial para una propiedad existente.
   * El cliente decide si reemplaza el campo description o solo lo sugiere al agente.
   */
  @Post('properties/:id/description')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.AGENT)
  async describeProperty(
    @CurrentUser() user: AuthenticatedTenantUser,
    @Param('id') id: string,
    @Body() dto: GeneratePropertyDescriptionDto,
  ) {
    return this.descriptions.generateForProperty(user.tenantId, id, dto);
  }
}
