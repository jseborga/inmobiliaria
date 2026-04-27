import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatService } from './chat.service';

interface PublicChatBody {
  tenantSlug: string;
  /** Identificador estable de la sesión web (cookie/localStorage del cliente). */
  sessionId: string;
  message: string;
}

/**
 * Endpoint público para el widget de chat de la página pública (Sprint 5).
 * Crea/usa una ChatSession con channel=WEB_CHAT y devuelve la respuesta del
 * bot inmediatamente (sin enviar por Evolution).
 *
 * Si el bot está deshabilitado a nivel tenant, igual devolvemos respuesta
 * genérica para que el usuario sepa que su mensaje quedó registrado.
 */
@Controller('public/chat')
@Public()
export class PublicChatController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async send(@Body() body: PublicChatBody) {
    if (!body.tenantSlug || !body.sessionId || !body.message) {
      throw new BadRequestException('tenantSlug, sessionId y message son requeridos');
    }
    if (body.message.length > 1000) {
      throw new BadRequestException('Mensaje demasiado largo');
    }
    const tenant = await this.prisma.raw.tenant.findUnique({
      where: { slug: body.tenantSlug.toLowerCase() },
      select: { id: true, status: true },
    });
    if (!tenant || tenant.status !== 'ACTIVE') {
      throw new NotFoundException('Inmobiliaria no encontrada');
    }
    const reply = await this.chat.chatWeb({
      tenantId: tenant.id,
      sessionExternalId: body.sessionId,
      body: body.message.trim(),
    });
    return {
      reply: reply.text,
      suggestedProperties: reply.suggestedProperties ?? [],
    };
  }
}
