import { Injectable, Logger } from '@nestjs/common';
import type { AIFeature } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AIUsageRecord {
  tenantId: string;
  feature: AIFeature;
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  /** Si la key vino del super-admin (mode=PLATFORM) → cuenta para billing. */
  billable: boolean;
}

/**
 * Log de cada llamada exitosa a IA. Sirve para reportes y para acumular
 * `monthly_token_used` en TenantAISettings (solo cuando billable=true).
 */
@Injectable()
export class AIUsageService {
  private readonly logger = new Logger(AIUsageService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(usage: AIUsageRecord): Promise<void> {
    const totalTokens = (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
    try {
      await this.prisma.raw.$transaction([
        this.prisma.raw.aIUsage.create({
          data: {
            tenantId: usage.tenantId,
            feature: usage.feature,
            provider: usage.provider,
            model: usage.model,
            inputTokens: usage.inputTokens ?? 0,
            outputTokens: usage.outputTokens ?? 0,
            billable: usage.billable,
          },
        }),
        // Si es billable, acumular en el contador del tenant para que el super-admin
        // lo vea sin agregar el log entero.
        ...(usage.billable && totalTokens > 0
          ? [
              this.prisma.raw.tenantAISettings.update({
                where: { tenantId: usage.tenantId },
                data: {
                  monthlyTokenUsed: { increment: totalTokens },
                },
              }),
            ]
          : []),
      ]);
    } catch (err) {
      // Log de uso fallido no debe tirar el request principal.
      this.logger.warn(`No se pudo registrar AIUsage: ${(err as Error).message}`);
    }
  }

  /** Resumen del último mes para un tenant (para el panel del tenant). */
  async monthlySummary(tenantId: string) {
    const since = new Date();
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const rows = await this.prisma.raw.aIUsage.groupBy({
      by: ['feature', 'provider'],
      where: { tenantId, createdAt: { gte: since } },
      _sum: { inputTokens: true, outputTokens: true },
      _count: true,
    });

    const totals = rows.reduce(
      (acc, r) => {
        acc.calls += r._count;
        acc.inputTokens += r._sum.inputTokens ?? 0;
        acc.outputTokens += r._sum.outputTokens ?? 0;
        return acc;
      },
      { calls: 0, inputTokens: 0, outputTokens: 0 },
    );

    return {
      since: since.toISOString(),
      totals,
      breakdown: rows.map((r) => ({
        feature: r.feature,
        provider: r.provider,
        calls: r._count,
        inputTokens: r._sum.inputTokens ?? 0,
        outputTokens: r._sum.outputTokens ?? 0,
      })),
    };
  }
}
