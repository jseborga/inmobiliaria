import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { TenantAIMode, UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantOnlyGuard } from '../../common/guards/tenant-only.guard';
import type { AuthenticatedTenantUser } from '../auth/types';
import { AISettingsService } from './ai-settings.service';
import { AIUsageService } from './ai-usage.service';
import { UpdateTenantAISettingsDto } from './dto/update-tenant-ai-settings.dto';

/**
 * Endpoints para que el tenant (OWNER/ADMIN) gestione su propia config de IA.
 *
 * Restricciones vs el endpoint del super-admin:
 *   - El tenant NO puede subirse de DISABLED → PLATFORM (eso solo lo hace el
 *     super-admin al cambiar el plan).
 *   - El tenant SÍ puede pasar a OWN cargando sus propias keys.
 *   - El tenant SÍ puede volver a PLATFORM si su plan lo permite (default
 *     según TenantPlan).
 *   - El tenant NO puede tocar `monthlyTokenLimit` (lo define el super-admin).
 */
@Controller('tenants/current/ai')
@UseGuards(TenantOnlyGuard)
export class TenantAIController {
  constructor(
    private readonly settings: AISettingsService,
    private readonly usage: AIUsageService,
  ) {}

  @Get('settings')
  async getSettings(@CurrentUser() user: AuthenticatedTenantUser) {
    return this.settings.getTenantSettings(user.tenantId);
  }

  @Patch('settings')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async updateSettings(
    @CurrentUser() user: AuthenticatedTenantUser,
    @Body() dto: UpdateTenantAISettingsDto,
  ) {
    // Filtrar campos que el tenant no puede modificar.
    if (dto.monthlyTokenLimit !== undefined) {
      throw new BadRequestException('El límite mensual lo define el super-admin');
    }
    if (dto.mode !== undefined) {
      // Tenant solo puede pasar a OWN o volver a PLATFORM/DISABLED según plan.
      // No puede saltarse de DISABLED → PLATFORM por sí mismo.
      const current = await this.settings.getTenantSettings(user.tenantId);
      if (current.mode === TenantAIMode.DISABLED && dto.mode === TenantAIMode.PLATFORM) {
        throw new BadRequestException(
          'Tu plan actual no incluye IA. Contactá a soporte para upgrade.',
        );
      }
    }
    return this.settings.updateTenantSettings(user.tenantId, dto);
  }

  @Get('usage')
  async getUsage(@CurrentUser() user: AuthenticatedTenantUser) {
    return this.usage.monthlySummary(user.tenantId);
  }
}
