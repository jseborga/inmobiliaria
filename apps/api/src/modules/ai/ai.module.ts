import { Module } from '@nestjs/common';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { AISettingsService } from './ai-settings.service';
import { AIUsageService } from './ai-usage.service';
import { PlatformAIController } from './platform-ai.controller';
import { PropertyDescriptionService } from './property-description.service';
import { TenantAIController } from './tenant-ai.controller';

/**
 * Módulo de IA. Exporta `AIService` para que otros módulos (chatbot, RAG)
 * puedan consumirlo.
 *
 * Ojo: AIService ahora requiere tenantId + feature en cada llamada para
 * resolver keys/modo. Usarlo desde otros módulos requiere pasar esos datos.
 */
@Module({
  controllers: [AIController, PlatformAIController, TenantAIController],
  providers: [AIService, AISettingsService, AIUsageService, PropertyDescriptionService],
  exports: [AIService, AISettingsService, AIUsageService],
})
export class AIModule {}
