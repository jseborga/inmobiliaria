import { Module } from '@nestjs/common';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { PropertyDescriptionService } from './property-description.service';

/**
 * Módulo de IA. Exporta `AIService` para que otros módulos (chatbot, RAG)
 * puedan consumirlo sin redeclararlo.
 */
@Module({
  controllers: [AIController],
  providers: [AIService, PropertyDescriptionService],
  exports: [AIService],
})
export class AIModule {}
