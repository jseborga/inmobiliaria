import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PlatformOnlyGuard } from '../../common/guards/platform-only.guard';
import { AISettingsService } from './ai-settings.service';
import { AIUsageService } from './ai-usage.service';
import { EmbeddingsService } from './embeddings.service';
import { PropertyIndexerService } from './property-indexer.service';
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
    private readonly embeddings: EmbeddingsService,
    private readonly indexer: PropertyIndexerService,
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

  /**
   * Reindex masivo de propiedades para búsqueda semántica.
   *  · ?onlyMissing=1  → solo las que no tienen embedding (incremental, default).
   *  · sin query string → todas, incluyendo las ya indexadas (full reindex,
   *    útil si cambiás el modelo de embeddings).
   */
  @Post('ai/reindex')
  @HttpCode(HttpStatus.OK)
  async reindex(@Body() body?: { onlyMissing?: boolean }) {
    const onlyMissing = body?.onlyMissing !== false; // default true
    return this.indexer.reindexAll({ onlyMissing });
  }

  /** Diagnóstico rápido de embeddings (true si la plataforma puede embeber). */
  @Get('ai/embeddings/status')
  async embeddingsStatus() {
    return { ready: await this.embeddings.isReady() };
  }

  /**
   * Estado del índice semántico: cuántas propiedades hay en total, cuántas
   * tienen embedding, cuántas faltan indexar y cuántas quedaron con un modelo
   * distinto al configurado actualmente (necesitan reindex).
   */
  @Get('ai/embeddings/stats')
  async embeddingsStats() {
    return this.indexer.stats();
  }
}
