import { Module } from '@nestjs/common';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { AISettingsService } from './ai-settings.service';
import { AIUsageService } from './ai-usage.service';
import { EmbeddingsService } from './embeddings.service';
import { PlatformAIController } from './platform-ai.controller';
import { PropertyDescriptionService } from './property-description.service';
import { PropertyIndexerService } from './property-indexer.service';
import { TenantAIController } from './tenant-ai.controller';

/**
 * Módulo de IA. Exporta los services públicos para que otros módulos
 * (properties para indexar, futuro chatbot, etc.) puedan consumirlos.
 */
@Module({
  controllers: [AIController, PlatformAIController, TenantAIController],
  providers: [
    AIService,
    AISettingsService,
    AIUsageService,
    EmbeddingsService,
    PropertyDescriptionService,
    PropertyIndexerService,
  ],
  exports: [AIService, AISettingsService, AIUsageService, EmbeddingsService, PropertyIndexerService],
})
export class AIModule {}
