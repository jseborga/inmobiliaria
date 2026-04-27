import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatService } from './chat.service';

/**
 * Webhook entrante de Evolution API. Configurar en Evolution apuntando a:
 *
 *   POST {API_PUBLIC_URL}/webhooks/whatsapp/{tenantSlug}?secret={webhookSecret}
 *
 * Evolution manda eventos tipo `messages.upsert`. Nos interesan los mensajes
 * con `key.fromMe=false` (entrantes del visitante) y `messageType` text.
 *
 * Validación: el secret se compara con el configurado en
 * WhatsappIntegration.webhookSecret. Sin secret válido → 403.
 *
 * Devolvemos 200 lo más rápido posible (Evolution timeout ~10s) — el bot
 * procesa async después.
 */
@Controller('webhooks/whatsapp')
@Public()
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
  ) {}

  @Post(':tenantSlug')
  @HttpCode(HttpStatus.OK)
  async receive(
    @Param('tenantSlug') tenantSlug: string,
    @Query('secret') querySecret: string | undefined,
    @Headers('x-webhook-secret') headerSecret: string | undefined,
    @Body() payload: unknown,
  ) {
    const tenant = await this.prisma.raw.tenant.findUnique({
      where: { slug: tenantSlug.toLowerCase() },
      include: { whatsapp: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant no encontrado');
    }
    const expected = tenant.whatsapp?.webhookSecret;
    if (!expected) {
      throw new ForbiddenException('Webhook no configurado');
    }
    const provided = headerSecret ?? querySecret;
    if (!provided || provided !== expected) {
      throw new ForbiddenException('Secret inválido');
    }

    // Parsear payload de Evolution. Estructura típica del evento messages.upsert:
    //   { event: 'messages.upsert', data: { key: { fromMe, remoteJid, id }, message: { conversation: 'texto' }, messageType: 'conversation' } }
    // Pero Evolution tiene varios formatos según versión. Manejamos 2-3 variantes.
    try {
      const parsed = this.parseInbound(payload);
      if (parsed) {
        // Procesamos en background — no bloqueamos a Evolution.
        void this.chat
          .handleInbound({
            tenantId: tenant.id,
            channel: 'WHATSAPP',
            externalId: parsed.phone,
            body: parsed.text,
            externalMessageId: parsed.messageId,
          })
          .catch((err) =>
            this.logger.error(`handleInbound falló: ${(err as Error).message}`),
          );
      }
    } catch (err) {
      this.logger.warn(`Webhook ignorado: ${(err as Error).message}`);
    }
    return { ok: true };
  }

  private parseInbound(payload: unknown): { phone: string; text: string; messageId?: string } | null {
    const p = payload as Record<string, unknown> | null;
    if (!p) return null;

    // Evolution payload structure (v1 / v2):
    //   { event: 'messages.upsert', data: { key, message, messageType, ... } }
    //   { event: 'messages.upsert', data: [ { key, message }, ... ] }
    const event = p.event as string | undefined;
    if (event && event !== 'messages.upsert' && event !== 'MESSAGES_UPSERT') {
      return null; // ignoramos otros eventos
    }

    const dataField: unknown = p.data ?? p;
    const item: unknown = Array.isArray(dataField) ? dataField[0] : dataField;
    if (!item || typeof item !== 'object') return null;

    const obj = item as {
      key?: { fromMe?: boolean; remoteJid?: string; id?: string };
      message?: { conversation?: string; extendedTextMessage?: { text?: string } };
      messageType?: string;
    };

    if (obj.key?.fromMe) return null; // ignoramos mensajes salientes que ecoan
    const remoteJid = obj.key?.remoteJid;
    if (!remoteJid) return null;

    // remoteJid suele ser "59177xxxxx@s.whatsapp.net" — quedamos solo el número.
    const phoneDigits = remoteJid.split('@')[0];
    if (!phoneDigits || !/^\d+$/.test(phoneDigits)) return null;
    const phone = `+${phoneDigits}`;

    const text =
      obj.message?.conversation ?? obj.message?.extendedTextMessage?.text ?? '';
    if (!text || text.trim().length === 0) return null;

    return { phone, text: text.trim(), messageId: obj.key?.id };
  }
}
