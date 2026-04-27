import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type MessageChannel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AIService } from '../ai/ai.service';
import { EmbeddingsService } from '../ai/embeddings.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { normalizePhone } from '../visits/phone-otp.service';

const HISTORY_WINDOW = 12;
const MAX_RAG_RESULTS = 5;

interface InboundMessage {
  tenantId: string;
  channel: MessageChannel;
  /** phone normalizado o sessionId del web. */
  externalId: string;
  body: string;
  /** ID del provider (Evolution messageId) — opcional. */
  externalMessageId?: string;
}

export interface BotReply {
  text: string;
  /** Propiedades sugeridas (si el bot encontró matches por similitud). */
  suggestedProperties?: Array<{
    id: string;
    title: string;
    slug: string;
    price: string;
    currency: string;
    operation: string;
  }>;
  /** True si la respuesta vino del bot (vs. queue para humano). */
  botResponded: boolean;
}

/**
 * Servicio de chat conversacional. Procesa mensajes entrantes (de Evolution
 * o del widget web), mantiene contexto via ChatSession + últimos N mensajes,
 * usa RAG para encontrar propiedades match, y genera respuesta con LLM.
 *
 * Decisiones:
 *  - Una sesión por (tenant, channel, externalId). Mensajes se acumulan.
 *  - Si el bot está desactivado para WhatsApp, NO genera respuesta — solo
 *    persiste el mensaje para que el agente lo conteste a mano desde admin.
 *  - El bot no responde mensajes propios (direction=OUT) que recibimos como
 *    eco; los ignoramos.
 *  - Si la integración está en modo prueba, el bot procesa pero el envío
 *    final por WhatsappService queda en logs.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AIService,
    private readonly embeddings: EmbeddingsService,
    private readonly whatsapp: WhatsappService,
  ) {}

  async handleInbound(msg: InboundMessage): Promise<BotReply | null> {
    const session = await this.upsertSession(msg);

    // Persistir el mensaje entrante.
    await this.prisma.raw.chatMessage.create({
      data: {
        tenantId: msg.tenantId,
        sessionId: session.id,
        channel: msg.channel,
        direction: 'IN',
        body: msg.body,
        externalId: msg.externalMessageId,
        status: 'DELIVERED',
      },
    });
    await this.prisma.raw.chatSession.update({
      where: { id: session.id },
      data: { lastMessageAt: new Date() },
    });

    // Si es WhatsApp y el bot está deshabilitado para el tenant → no respondemos.
    if (msg.channel === 'WHATSAPP') {
      const integration = await this.prisma.raw.whatsappIntegration.findUnique({
        where: { tenantId: msg.tenantId },
      });
      if (!integration?.botEnabled) {
        return null;
      }
    }

    // Generar respuesta del bot.
    const reply = await this.generateReply(msg.tenantId, session.id, msg.body);

    // Persistir el mensaje saliente del bot.
    const outMsg = await this.prisma.raw.chatMessage.create({
      data: {
        tenantId: msg.tenantId,
        sessionId: session.id,
        channel: msg.channel,
        direction: 'OUT',
        body: reply.text,
        status: 'PENDING',
        fromBot: true,
        metadata: reply.suggestedProperties
          ? { suggested: reply.suggestedProperties.map((p) => p.id) }
          : undefined,
      },
    });

    // Para WhatsApp, mandar via Evolution.
    if (msg.channel === 'WHATSAPP') {
      const sendResult = await this.whatsapp.send({
        tenantId: msg.tenantId,
        phone: msg.externalId,
        text: reply.text,
      });
      await this.prisma.raw.chatMessage.update({
        where: { id: outMsg.id },
        data: { status: sendResult.sent ? 'SENT' : 'FAILED' },
      });
    }

    return { ...reply, botResponded: true };
  }

  /**
   * Generación pública para web chat: igual flujo pero sin enviar por WhatsApp,
   * el caller lo devuelve por HTTP al cliente.
   */
  async chatWeb(opts: {
    tenantId: string;
    sessionExternalId: string;
    body: string;
  }): Promise<BotReply> {
    const reply = await this.handleInbound({
      tenantId: opts.tenantId,
      channel: 'WEB_CHAT',
      externalId: opts.sessionExternalId,
      body: opts.body,
    });
    return reply ?? { text: 'No tengo respuesta en este momento.', botResponded: false };
  }

  /** Manda mensaje desde el panel admin (humano). */
  async sendManual(opts: {
    tenantId: string;
    phone: string;
    text: string;
  }): Promise<{ ok: boolean; status: string }> {
    const phone = normalizePhone(opts.phone);
    const session = await this.upsertSession({
      tenantId: opts.tenantId,
      channel: 'WHATSAPP',
      externalId: phone,
    });
    const sendResult = await this.whatsapp.send({
      tenantId: opts.tenantId,
      phone,
      text: opts.text,
    });
    await this.prisma.raw.chatMessage.create({
      data: {
        tenantId: opts.tenantId,
        sessionId: session.id,
        channel: 'WHATSAPP',
        direction: 'OUT',
        body: opts.text,
        status: sendResult.sent ? 'SENT' : 'FAILED',
        fromBot: false,
      },
    });
    return { ok: sendResult.sent, status: sendResult.reason ?? 'sent' };
  }

  /** Lista historial de una sesión (para mostrar al admin). */
  async listMessages(tenantId: string, sessionId: string) {
    return this.prisma.raw.chatMessage.findMany({
      where: { tenantId, sessionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Lista sesiones recientes de un tenant. */
  async listSessions(tenantId: string, params: { take?: number } = {}) {
    const take = Math.min(Math.max(params.take ?? 30, 1), 100);
    return this.prisma.raw.chatSession.findMany({
      where: { tenantId },
      orderBy: { lastMessageAt: 'desc' },
      take,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  // -------------------------------------------------------------------------

  private async upsertSession(msg: {
    tenantId: string;
    channel: MessageChannel;
    externalId: string;
  }) {
    const existing = await this.prisma.raw.chatSession.findUnique({
      where: {
        tenantId_channel_externalId: {
          tenantId: msg.tenantId,
          channel: msg.channel,
          externalId: msg.externalId,
        },
      },
    });
    if (existing) return existing;
    return this.prisma.raw.chatSession.create({
      data: {
        tenantId: msg.tenantId,
        channel: msg.channel,
        externalId: msg.externalId,
      },
    });
  }

  /**
   * Genera respuesta del bot:
   *  1. Recupera últimos N mensajes de la sesión (contexto).
   *  2. Si el último mensaje del visitante parece preguntar por propiedades,
   *     usa embeddings + búsqueda en pgvector para encontrar matches.
   *  3. Llama al LLM con system prompt + historial + matches.
   *  4. Devuelve texto + propiedades sugeridas para metadata.
   *
   * Si la IA está desactivada para el tenant (mode=DISABLED), devuelve un
   * mensaje genérico avisando que el agente humano va a responder.
   */
  private async generateReply(
    tenantId: string,
    sessionId: string,
    inboundText: string,
  ): Promise<BotReply> {
    // 1. Histórico
    const recentMessages = await this.prisma.raw.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_WINDOW,
    });
    const historyOldestFirst = [...recentMessages].reverse();

    // 2. RAG
    let rag: BotReply['suggestedProperties'] = [];
    try {
      const embedded = await this.embeddings.embed(inboundText, {
        tenantId,
        feature: 'EMBEDDINGS',
      });
      if (embedded) {
        const vectorLiteral = `[${embedded.vector.join(',')}]`;
        const rows = await this.prisma.raw.$queryRaw<
          Array<{
            id: string;
            slug: string;
            title: string;
            operation: string;
            type: string;
            price: string;
            currency: string;
            similarity: number;
          }>
        >(Prisma.sql`
          SELECT
            p.id, p.slug, p.title,
            p.operation::text AS operation,
            p.type::text AS type,
            p.price::text AS price,
            p.currency::text AS currency,
            (1 - (p.embedding <=> ${vectorLiteral}::vector)) AS similarity
          FROM properties p
          WHERE p.tenant_id = ${tenantId}
            AND p.status = 'PUBLISHED'
            AND p.embedding IS NOT NULL
          ORDER BY p.embedding <=> ${vectorLiteral}::vector ASC
          LIMIT ${MAX_RAG_RESULTS}
        `);
        rag = rows
          .filter((r) => Number(r.similarity) > 0.3) // umbral de relevancia
          .map((r) => ({
            id: r.id,
            slug: r.slug,
            title: r.title,
            operation: r.operation,
            type: r.type,
            price: r.price,
            currency: r.currency,
          }));
      }
    } catch (err) {
      this.logger.warn(`RAG falló: ${(err as Error).message}`);
    }

    // 3. Construir prompt
    const tenant = await this.prisma.raw.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    const system = [
      `Sos un asesor inmobiliario virtual de la empresa ${tenant?.name ?? 'la inmobiliaria'}.`,
      'Hablás en español neutro, cálido y profesional. Respondés breve (2-4 oraciones, máx 350 caracteres en WhatsApp).',
      'Tu objetivo: ayudar al cliente a encontrar la propiedad correcta y, cuando esté listo, ofrecerle agendar una visita.',
      'Si el cliente quiere agendar visita, explicalé que en el sitio web puede hacerlo con un código por WhatsApp.',
      'Si no tenés información concreta, no inventes — pedí más detalle al cliente.',
      'No reveles que sos un bot a menos que pregunten directamente. No menciones "RAG", "embeddings" ni términos técnicos.',
    ].join('\n');

    const historyText = historyOldestFirst
      .filter((m) => m.body.trim().length > 0)
      .slice(0, -1) // sin el último (es el inbound actual, lo agregamos abajo)
      .map((m) => `${m.direction === 'IN' ? 'Cliente' : 'Asesor'}: ${m.body}`)
      .join('\n');

    const ragText = rag.length
      ? rag
          .map(
            (p, i) =>
              `${i + 1}. ${p.title} — ${p.operation === 'SALE' ? 'venta' : p.operation === 'RENT' ? 'alquiler' : 'anticrético'} ${p.currency} ${p.price} (slug: ${p.slug})`,
          )
          .join('\n')
      : '(no hay propiedades exactamente similares en este momento)';

    const userPrompt = [
      historyText ? `Historial reciente:\n${historyText}\n` : '',
      `Mensaje del cliente:\n${inboundText}\n`,
      `Propiedades disponibles que podrían interesarle:\n${ragText}\n`,
      'Respondé al cliente. Si hay propiedades match arriba, mencioná 1-2 brevemente y ofrecé enviar más detalles. Si no hay match, pedile que aclare lo que busca.',
    ]
      .filter(Boolean)
      .join('\n');

    // 4. Llamar al LLM.
    let text: string;
    try {
      const result = await this.ai.generate(
        tenantId,
        'CHATBOT',
        {
          system,
          user: userPrompt,
          maxTokens: 350,
          temperature: 0.5,
        },
      );
      text = result.text;
    } catch (err) {
      // Si la IA está deshabilitada o falla, devolvemos respuesta genérica.
      this.logger.warn(`AI generate falló: ${(err as Error).message}`);
      text =
        'Gracias por tu mensaje! Un asesor humano te va a responder en breve.';
    }

    return {
      text: text.trim(),
      suggestedProperties: rag,
      botResponded: true,
    };
  }
}
