import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { decryptKey, encryptKey, maskKey } from '../../common/crypto/key-cipher';
import { PrismaService } from '../../prisma/prisma.service';

export interface TelegramIntegrationView {
  tenantId: string;
  botUsername: string | null;
  botTokenMasked: string | null;
  hasToken: boolean;
  testMode: boolean;
  enabled: boolean;
  updatedAt: string | null;
}

export interface UpdateTelegramIntegration {
  botToken?: string | null;
  botUsername?: string | null;
  testMode?: boolean;
  enabled?: boolean;
}

interface SendOpts {
  tenantId: string;
  chatId: string;
  text: string;
}

interface SendResult {
  sent: boolean;
  reason?: 'TEST_MODE' | 'NOT_CONFIGURED' | 'DISABLED';
}

/**
 * Cliente Telegram Bot API. Una integración por tenant — cada inmobiliaria
 * crea su bot con @BotFather y configura el token acá.
 *
 * El bot:
 *   - Recibe /start <userId> de cada agente y vincula su chat.
 *   - Manda notificaciones internas (lead nuevo, visita agendada).
 *
 * Modo prueba: si testMode=true, los mensajes se loggean en stdout sin
 * llamar a Telegram. Útil para QA sin spam.
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------

  async getIntegration(tenantId: string): Promise<TelegramIntegrationView> {
    const row = await this.prisma.raw.telegramIntegration.findUnique({
      where: { tenantId },
    });
    return this.toView(tenantId, row);
  }

  async updateIntegration(
    tenantId: string,
    input: UpdateTelegramIntegration,
  ): Promise<TelegramIntegrationView> {
    const tenant = await this.prisma.raw.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');

    const data: Record<string, unknown> = { tenantId };
    if (input.botUsername !== undefined) data.botUsername = input.botUsername?.replace(/^@/, '').trim() || null;
    if (input.testMode !== undefined) data.testMode = input.testMode;
    if (input.enabled !== undefined) data.enabled = input.enabled;
    if (input.botToken !== undefined) data.botTokenEnc = encryptKey(input.botToken);

    await this.prisma.raw.telegramIntegration.upsert({
      where: { tenantId },
      create: data as never,
      update: data as never,
    });
    return this.getIntegration(tenantId);
  }

  // -------------------------------------------------------------------------
  // Send
  // -------------------------------------------------------------------------

  async send(opts: SendOpts): Promise<SendResult> {
    const integration = await this.prisma.raw.telegramIntegration.findUnique({
      where: { tenantId: opts.tenantId },
    });
    if (!integration || !integration.enabled) {
      this.logger.log(
        `[telegram:not-configured tenant=${opts.tenantId}] → chat=${opts.chatId}: ${opts.text}`,
      );
      return { sent: false, reason: integration ? 'DISABLED' : 'NOT_CONFIGURED' };
    }
    if (integration.testMode) {
      this.logger.log(
        `[telegram:test-mode tenant=${opts.tenantId}] → chat=${opts.chatId}: ${opts.text}`,
      );
      return { sent: false, reason: 'TEST_MODE' };
    }
    if (!integration.botTokenEnc) {
      return { sent: false, reason: 'NOT_CONFIGURED' };
    }

    let token: string | null;
    try {
      token = decryptKey(integration.botTokenEnc);
    } catch {
      return { sent: false, reason: 'NOT_CONFIGURED' };
    }
    if (!token) return { sent: false, reason: 'NOT_CONFIGURED' };

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: opts.chatId,
          text: opts.text,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.warn(
          `[telegram:send-failed tenant=${opts.tenantId} status=${res.status}] ${body.slice(0, 200)}`,
        );
        return { sent: false, reason: 'NOT_CONFIGURED' };
      }
      return { sent: true };
    } catch (err) {
      this.logger.error(
        `[telegram:network-error tenant=${opts.tenantId}] ${(err as Error).message}`,
      );
      return { sent: false, reason: 'NOT_CONFIGURED' };
    }
  }

  /** Manda mensaje a un user específico (mira su telegramChatId). */
  async sendToUser(opts: { tenantId: string; userId: string; text: string }): Promise<SendResult> {
    const user = await this.prisma.raw.user.findFirst({
      where: { id: opts.userId, tenantId: opts.tenantId },
      select: { telegramChatId: true },
    });
    if (!user?.telegramChatId) {
      return { sent: false, reason: 'NOT_CONFIGURED' };
    }
    return this.send({
      tenantId: opts.tenantId,
      chatId: user.telegramChatId,
      text: opts.text,
    });
  }

  // -------------------------------------------------------------------------
  // Admin (gestión de vinculaciones)
  // -------------------------------------------------------------------------

  /** Lista los usuarios del tenant con su estado de vinculación a Telegram. */
  async listUsersForTenant(tenantId: string) {
    const users = await this.prisma.raw.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true,
        telegramChatId: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    return users.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.role,
      status: u.status,
      linked: !!u.telegramChatId,
    }));
  }

  /** Desvincula el chat de Telegram de un usuario del tenant. */
  async unlinkUser(tenantId: string, userId: string): Promise<{ ok: true }> {
    const user = await this.prisma.raw.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    await this.prisma.raw.user.update({
      where: { id: user.id },
      data: { telegramChatId: null },
    });
    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // Webhook (vincula agentes con su chat al recibir /start <userId>)
  // -------------------------------------------------------------------------

  async handleWebhook(tenantId: string, payload: unknown): Promise<{ ok: boolean }> {
    // Telegram update typical:
    //   { update_id, message: { chat: { id }, text, from: { id, first_name } } }
    const p = payload as {
      message?: {
        chat?: { id?: number | string };
        text?: string;
      };
    } | null;
    const chatId = p?.message?.chat?.id?.toString();
    const text = p?.message?.text?.trim() ?? '';
    if (!chatId || !text.startsWith('/start')) {
      return { ok: true };
    }
    const userId = text.replace(/^\/start\s*/, '').trim();
    if (!userId) return { ok: true };

    const user = await this.prisma.raw.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true, firstName: true },
    });
    if (!user) {
      // Igual respondemos OK al bot para que no reintente.
      this.logger.warn(`[telegram:bind-failed tenant=${tenantId}] user no encontrado: ${userId}`);
      void this.send({
        tenantId,
        chatId,
        text:
          'Hola! El código de vinculación no es válido. Contactá al administrador de tu inmobiliaria.',
      });
      return { ok: true };
    }
    await this.prisma.raw.user.update({
      where: { id: user.id },
      data: { telegramChatId: chatId },
    });
    void this.send({
      tenantId,
      chatId,
      text: `Hola ${user.firstName}! 🎉 Tu Telegram quedó vinculado. Vas a recibir notificaciones de nuevos leads y visitas acá.`,
    });
    return { ok: true };
  }

  // -------------------------------------------------------------------------

  private toView(
    tenantId: string,
    row:
      | {
          botTokenEnc: string | null;
          botUsername: string | null;
          testMode: boolean;
          enabled: boolean;
          updatedAt: Date;
        }
      | null,
  ): TelegramIntegrationView {
    let masked: string | null = null;
    if (row?.botTokenEnc) {
      try {
        masked = maskKey(decryptKey(row.botTokenEnc));
      } catch {
        masked = '•••• (cipher inválido)';
      }
    }
    return {
      tenantId,
      botUsername: row?.botUsername ?? null,
      botTokenMasked: masked,
      hasToken: !!row?.botTokenEnc,
      testMode: row?.testMode ?? true,
      enabled: row?.enabled ?? false,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  }
}
