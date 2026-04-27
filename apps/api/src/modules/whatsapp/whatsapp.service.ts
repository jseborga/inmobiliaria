import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { decryptKey, encryptKey, maskKey } from '../../common/crypto/key-cipher';
import { PrismaService } from '../../prisma/prisma.service';

export interface SendWhatsappOpts {
  /** Número en formato internacional con `+`. Ej: +59177123456 */
  phone: string;
  /** Cuerpo del mensaje. Texto plano o markdown soportado por WhatsApp. */
  text: string;
  /** Tenant que dispara el envío. Define qué integración usar. */
  tenantId: string;
}

export interface SendWhatsappResult {
  /** True si se mandó por WhatsApp real. False si quedó en log (testMode/no config). */
  sent: boolean;
  /** Razón cuando sent=false. */
  reason?: 'TEST_MODE' | 'NOT_CONFIGURED' | 'DISABLED';
  /** Respuesta del provider cuando sent=true. */
  providerResponse?: unknown;
}

export interface WhatsappIntegrationView {
  tenantId: string;
  baseUrl: string | null;
  instance: string | null;
  apiKeyMasked: string | null;
  hasApiKey: boolean;
  testMode: boolean;
  enabled: boolean;
  botEnabled: boolean;
  /** URL pública del webhook que la inmobiliaria configura en Evolution. */
  webhookUrl: string | null;
  /** Secret aleatorio del webhook (visible al admin para configurarlo). */
  webhookSecret: string | null;
  cipherReady: boolean;
  updatedAt: string | null;
}

export interface UpdateWhatsappIntegration {
  baseUrl?: string | null;
  instance?: string | null;
  /** API key en claro; el service la encripta. null/'' borra la key existente. */
  apiKey?: string | null;
  testMode?: boolean;
  enabled?: boolean;
  botEnabled?: boolean;
  /** Si true, regenera el webhookSecret. Útil cuando se sospecha leak. */
  rotateWebhookSecret?: boolean;
}

/**
 * Cliente de Evolution API por tenant.
 *
 * Evolution expone un POST a `{baseUrl}/message/sendText/{instance}` con
 * `{ number, text }` y header `apikey: <key>`. Esta es la única operación
 * que necesitamos para Sprint 3 (OTPs). En Sprint 4 agregaremos webhooks
 * entrantes y otros tipos de mensaje.
 *
 * Modo prueba (testMode=true):
 *   - No llama Evolution.
 *   - Loggea el mensaje al stdout del API → el dev/QA lo ve sin gastar
 *     mensajes reales.
 *   - Devuelve `sent: false, reason: 'TEST_MODE'`.
 *
 * No-config (sin baseUrl/instance/apiKey o enabled=false):
 *   - Mismo comportamiento que testMode pero con reason distinta.
 */
@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Settings (tenant-scoped)
  // -------------------------------------------------------------------------

  async getIntegration(tenantId: string): Promise<WhatsappIntegrationView> {
    const row = await this.prisma.raw.whatsappIntegration.findUnique({
      where: { tenantId },
    });
    return this.toView(tenantId, row);
  }

  async updateIntegration(
    tenantId: string,
    input: UpdateWhatsappIntegration,
  ): Promise<WhatsappIntegrationView> {
    const tenant = await this.prisma.raw.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');

    const existing = await this.prisma.raw.whatsappIntegration.findUnique({
      where: { tenantId },
    });

    const data: Record<string, unknown> = { tenantId };
    if (input.baseUrl !== undefined) data.baseUrl = input.baseUrl?.trim() || null;
    if (input.instance !== undefined) data.instance = input.instance?.trim() || null;
    if (input.testMode !== undefined) data.testMode = input.testMode;
    if (input.enabled !== undefined) data.enabled = input.enabled;
    if (input.botEnabled !== undefined) data.botEnabled = input.botEnabled;
    if (input.apiKey !== undefined) data.apiKeyEnc = encryptKey(input.apiKey);

    // Generar webhookSecret si no existe o si pidieron rotarlo.
    if (!existing?.webhookSecret || input.rotateWebhookSecret) {
      data.webhookSecret = randomBytes(24).toString('base64url');
    }

    await this.prisma.raw.whatsappIntegration.upsert({
      where: { tenantId },
      create: data as never,
      update: data as never,
    });
    return this.getIntegration(tenantId);
  }

  // -------------------------------------------------------------------------
  // Send
  // -------------------------------------------------------------------------

  async send(opts: SendWhatsappOpts): Promise<SendWhatsappResult> {
    const integration = await this.prisma.raw.whatsappIntegration.findUnique({
      where: { tenantId: opts.tenantId },
    });

    if (!integration || !integration.enabled) {
      this.logger.log(
        `[whatsapp:not-configured tenant=${opts.tenantId}] → ${opts.phone}: ${opts.text}`,
      );
      return { sent: false, reason: integration ? 'DISABLED' : 'NOT_CONFIGURED' };
    }

    if (integration.testMode) {
      this.logger.log(
        `[whatsapp:test-mode tenant=${opts.tenantId}] → ${opts.phone}: ${opts.text}`,
      );
      return { sent: false, reason: 'TEST_MODE' };
    }

    if (!integration.baseUrl || !integration.instance || !integration.apiKeyEnc) {
      this.logger.warn(
        `[whatsapp:incomplete-config tenant=${opts.tenantId}] falta baseUrl/instance/apiKey`,
      );
      return { sent: false, reason: 'NOT_CONFIGURED' };
    }

    let apiKey: string | null;
    try {
      apiKey = decryptKey(integration.apiKeyEnc);
    } catch (err) {
      this.logger.error(
        `[whatsapp:cipher-error tenant=${opts.tenantId}] no se pudo desencriptar key: ${(err as Error).message}`,
      );
      return { sent: false, reason: 'NOT_CONFIGURED' };
    }
    if (!apiKey) {
      return { sent: false, reason: 'NOT_CONFIGURED' };
    }

    const url = `${integration.baseUrl.replace(/\/$/, '')}/message/sendText/${integration.instance}`;
    // Evolution acepta el número con o sin `+`; preferimos sin para max compat.
    const number = opts.phone.replace(/^\+/, '');

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          apikey: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ number, text: opts.text }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.warn(
          `[whatsapp:send-failed tenant=${opts.tenantId} status=${res.status}] ${body.slice(0, 200)}`,
        );
        return { sent: false, reason: 'NOT_CONFIGURED' };
      }
      const json = await res.json().catch(() => null);
      this.logger.log(`[whatsapp:sent tenant=${opts.tenantId} → ${opts.phone}]`);
      return { sent: true, providerResponse: json };
    } catch (err) {
      this.logger.error(
        `[whatsapp:network-error tenant=${opts.tenantId}] ${(err as Error).message}`,
      );
      return { sent: false, reason: 'NOT_CONFIGURED' };
    }
  }

  // -------------------------------------------------------------------------

  private toView(
    tenantId: string,
    row:
      | {
          baseUrl: string | null;
          instance: string | null;
          apiKeyEnc: string | null;
          testMode: boolean;
          enabled: boolean;
          botEnabled: boolean;
          webhookSecret: string | null;
          updatedAt: Date;
        }
      | null,
  ): WhatsappIntegrationView {
    let masked: string | null = null;
    if (row?.apiKeyEnc) {
      try {
        masked = maskKey(decryptKey(row.apiKeyEnc));
      } catch {
        masked = '•••• (cipher inválido)';
      }
    }
    // Construye la URL pública del webhook leyendo el slug del tenant.
    // No la persistimos para que cambios de dominio no obliguen a re-guardar.
    const apiPublicUrl = process.env.API_PUBLIC_URL?.replace(/\/$/, '') ?? '';
    const webhookUrl = row?.webhookSecret && apiPublicUrl
      ? `${apiPublicUrl}/webhooks/whatsapp/{tenantSlug}?secret=${row.webhookSecret}`
      : null;
    return {
      tenantId,
      baseUrl: row?.baseUrl ?? null,
      instance: row?.instance ?? null,
      apiKeyMasked: masked,
      hasApiKey: !!row?.apiKeyEnc,
      testMode: row?.testMode ?? true,
      enabled: row?.enabled ?? false,
      botEnabled: row?.botEnabled ?? false,
      webhookUrl,
      webhookSecret: row?.webhookSecret ?? null,
      cipherReady: true,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  }
}
