import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { OtpContext } from '@prisma/client';
import { createHash, randomInt } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

const CODE_LENGTH = 6;
const CODE_EXPIRY_MIN = 10;
const MAX_ATTEMPTS = 5;
/** Ventana de rate limit para evitar spam: máx N códigos por phone/contexto en M minutos. */
const RATE_LIMIT_COUNT = 3;
const RATE_LIMIT_MINUTES = 15;

/** Hashea un código (constant-time compare via SHA-256). */
function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function genCode(): string {
  // 6 dígitos numéricos, 0-padded.
  return String(randomInt(0, 1_000_000)).padStart(CODE_LENGTH, '0');
}

/**
 * Normaliza teléfono a E.164. Acepta inputs sucios y devuelve `+<dígitos>`.
 * Ej: "+591 7 700 1234" → "+59177001234". Si no parece válido, lanza.
 */
export function normalizePhone(input: string): string {
  const digits = input.replace(/[^\d+]/g, '');
  const withPlus = digits.startsWith('+') ? digits : `+${digits}`;
  if (!/^\+\d{8,15}$/.test(withPlus)) {
    throw new BadRequestException('Teléfono inválido. Usá formato internacional con +.');
  }
  return withPlus;
}

@Injectable()
export class PhoneOtpService {
  private readonly logger = new Logger(PhoneOtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
  ) {}

  /**
   * Genera OTP nuevo, lo guarda hasheado, y dispara WhatsApp.
   * Aplica rate limiting por phone/contexto.
   *
   * Devuelve solo metadata segura — nunca el código en claro al cliente
   * (excepto en testMode si así lo configuramos en el future).
   */
  async requestOtp(opts: {
    phone: string;
    context: OtpContext;
    tenantId: string;
    /** Mensaje custom; default es uno genérico con el contexto. */
    customMessage?: string;
  }): Promise<{
    expiresInSeconds: number;
    delivered: boolean;
    deliveryReason?: string;
  }> {
    const phone = normalizePhone(opts.phone);

    // Rate limit
    const since = new Date(Date.now() - RATE_LIMIT_MINUTES * 60_000);
    const recent = await this.prisma.raw.phoneOtp.count({
      where: {
        phone,
        context: opts.context,
        createdAt: { gte: since },
      },
    });
    if (recent >= RATE_LIMIT_COUNT) {
      throw new ForbiddenException(
        `Demasiados intentos. Esperá unos minutos antes de pedir otro código.`,
      );
    }

    const code = genCode();
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MIN * 60_000);

    const integration = await this.prisma.raw.whatsappIntegration.findUnique({
      where: { tenantId: opts.tenantId },
    });
    const isTestMode = !integration || integration.testMode || !integration.enabled;

    await this.prisma.raw.phoneOtp.create({
      data: {
        phone,
        context: opts.context,
        codeHash,
        expiresAt,
        tenantId: opts.tenantId,
        testMode: isTestMode,
      },
    });

    const message =
      opts.customMessage ??
      `Tu código de verificación es: *${code}*\n\nVence en ${CODE_EXPIRY_MIN} minutos. No lo compartas con nadie.`;

    if (isTestMode) {
      // En modo prueba el código queda en logs. El admin/QA lo ve por ahí.
      this.logger.log(`[otp:test-mode phone=${phone}] CODE=${code}`);
    }

    const result = await this.whatsapp.send({
      tenantId: opts.tenantId,
      phone,
      text: message,
    });

    return {
      expiresInSeconds: CODE_EXPIRY_MIN * 60,
      delivered: result.sent,
      deliveryReason: result.reason,
    };
  }

  /**
   * Verifica un código. Si OK, marca el OTP como consumido y devuelve true.
   * Sigue siendo verificable solo una vez (consumedAt). Si los intentos
   * exceden MAX_ATTEMPTS, invalida el código.
   */
  async verifyOtp(opts: {
    phone: string;
    code: string;
    context: OtpContext;
  }): Promise<boolean> {
    const phone = normalizePhone(opts.phone);
    const codeHash = hashCode(opts.code);

    // Buscamos el OTP más reciente no consumido y no expirado para este phone+context.
    const otp = await this.prisma.raw.phoneOtp.findFirst({
      where: {
        phone,
        context: opts.context,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) return false;

    if (otp.attempts >= MAX_ATTEMPTS) {
      // Marcamos como consumido para que no se pueda intentar más.
      await this.prisma.raw.phoneOtp.update({
        where: { id: otp.id },
        data: { consumedAt: new Date() },
      });
      throw new ForbiddenException('Código bloqueado por demasiados intentos. Pedí uno nuevo.');
    }

    if (otp.codeHash !== codeHash) {
      await this.prisma.raw.phoneOtp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      return false;
    }

    await this.prisma.raw.phoneOtp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });
    return true;
  }

  /** True si hay un OTP consumido recientemente para este phone+context (=usuario validado). */
  async wasRecentlyVerified(opts: {
    phone: string;
    context: OtpContext;
    /** Cuánto tiempo atrás contar como "validado". Default 30 min. */
    withinMinutes?: number;
  }): Promise<boolean> {
    const phone = normalizePhone(opts.phone);
    const since = new Date(Date.now() - (opts.withinMinutes ?? 30) * 60_000);
    const otp = await this.prisma.raw.phoneOtp.findFirst({
      where: {
        phone,
        context: opts.context,
        consumedAt: { gte: since, not: null },
      },
      orderBy: { consumedAt: 'desc' },
    });
    return !!otp;
  }
}
