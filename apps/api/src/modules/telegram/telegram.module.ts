import { Module } from '@nestjs/common';
import { TelegramAdminController, TelegramWebhookController } from './telegram.controller';
import { TelegramService } from './telegram.service';

/**
 * Bot Telegram por tenant para notificaciones internas a agentes.
 * Exporta `TelegramService` para que otros módulos (leads, visits) puedan
 * mandar mensajes vía `sendToUser`.
 */
@Module({
  controllers: [TelegramAdminController, TelegramWebhookController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
