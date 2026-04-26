import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { PlatformOnlyGuard } from '../../common/guards/platform-only.guard';
import { AISettingsService } from './ai-settings.service';
import { AIUsageService } from './ai-usage.service';
import { UpdatePlatformAISettingsDto } from './dto/update-platform-ai-settings.dto';
import { UpdateTenantAISettingsDto } from './dto/update-tenant-ai-settings.dto';

/**
 * Endpoints del super-admin para configurar IA a nivel global y por tenant.
 *
 * Rutas (todas con prefijo /platform-admin):
 *   GET    /ai-settings                       singleton config
 *   PATCH  /ai-settings                       update keys/provider default
 *   PATCH  /tenants/:id/ai-settings           cambia mode + límites por tenant
 *   GET    /tenants/:id/ai-settings           ver config (con keys enmascaradas)
 *   GET    /tenants/:id/ai-usage              resumen mensual
 */
@Controller('platform-admin')
@UseGuards(PlatformOnlyGuard)
export class PlatformAIController {
  constructor(
    private readonly settings: AISettingsService,
    private readonly usage: AIUsageService,
  ) {}

  @Get('ai-settings')
  async getSettings() {
    return this.settings.getPlatformSettings();
  }

  @Patch('ai-settings')
  @HttpCode(HttpStatus.OK)
  async updateSettings(@Body() dto: UpdatePlatformAISettingsDto) {
    return this.settings.updatePlatformSettings(dto);
  }

  @Get('tenants/:id/ai-settings')
  async getTenantSettings(@Param('id') id: string) {
    return this.settings.getTenantSettings(id);
  }

  @Patch('tenants/:id/ai-settings')
  @HttpCode(HttpStatus.OK)
  async updateTenantSettings(
    @Param('id') id: string,
    @Body() dto: UpdateTenantAISettingsDto,
  ) {
    return this.settings.updateTenantSettings(id, dto);
  }

  @Get('tenants/:id/ai-usage')
  async getTenantUsage(@Param('id') id: string) {
    return this.usage.monthlySummary(id);
  }
}
