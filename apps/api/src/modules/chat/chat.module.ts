import { Module } from '@nestjs/common';
import { AIModule } from '../ai/ai.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { AdminChatController } from './admin-chat.controller';
import { ChatService } from './chat.service';
import { PublicChatController } from './public-chat.controller';
import { WhatsappWebhookController } from './webhook.controller';

/**
 * Bot conversacional + canal de chat. Comparte la misma lógica para
 * WhatsApp (webhook entrante de Evolution) y web chat (widget público).
 */
@Module({
  imports: [AIModule, WhatsappModule],
  controllers: [WhatsappWebhookController, PublicChatController, AdminChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
