import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';

/**
 * Cliente de Evolution API por tenant. Exporta `WhatsappService` para que
 * otros módulos (visits, futuro chatbot) puedan mandar mensajes.
 */
@Module({
  controllers: [WhatsappController],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
