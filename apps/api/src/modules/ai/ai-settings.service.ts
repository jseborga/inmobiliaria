import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma, TenantAIMode, TenantPlan } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { decryptKey, encryptKey, isCipherReady, maskKey } from '../../common/crypto/key-cipher';
import type { AIProviderName } from './ai.service';

const SINGLETON_ID = 'singleton';

export type AIProviderKey = 'claude' | 'openai' | 'openrouter';

export interface ResolvedAIConfig {
  /** Provider efectivo a usar para esta llamada. */
  provider: AIProviderName;
  /** Modelo efectivo. */
  model?: string;
  /** Key plana (ya desencriptada) para el provider seleccionado. */
  apiKey: string | null;
  /** True si la key vino del super-admin (mode=PLATFORM, billing). */
  billable: boolean;
}

export interface PlatformAISettingsView {
  defaultProvider: string | null;
  defaultModel: string | null;
  embeddingsProvider: string | null;
  embeddingsModel: string | null;
  /** Indicadores de cuáles keys están cargadas (sin exponer el valor). */
  hasClaudeKey: boolean;
  hasOpenAIKey: boolean;
  hasOpenRouterKey: boolean;
  hasEmbeddingsKey: boolean;
  /** Key enmascarada para mostrar al super-admin. */
  claudeKeyMasked: string | null;
  openaiKeyMasked: string | null;
  openrouterKeyMasked: string | null;
  embeddingsKeyMasked: string | null;
  cipherReady: boolean;
  updatedAt: string | null;
}

export interface TenantAISettingsView {
  mode: TenantAIMode;
  provider: string | null;
  model: string | null;
  hasClaudeKey: boolean;
  hasOpenAIKey: boolean;
  hasOpenRouterKey: boolean;
  claudeKeyMasked: string | null;
  openaiKeyMasked: string | null;
  openrouterKeyMasked: string | null;
  monthlyTokenLimit: number | null;
  monthlyTokenUsed: number;
  monthlyResetAt: string;
  /** Lo que el system asume si no hay row todavía (default por plan). */
  defaultByPlan: TenantAIMode;
  updatedAt: string | null;
}

export interface UpdatePlatformAISettings {
  defaultProvider?: AIProviderName | null;
  defaultModel?: string | null;
  claudeKey?: string | null;
  openaiKey?: string | null;
  openrouterKey?: string | null;
  embeddingsProvider?: string | null;
  embeddingsModel?: string | null;
  embeddingsKey?: string | null;
}

export interface UpdateTenantAISettings {
  mode?: TenantAIMode;
  provider?: AIProviderName | null;
  model?: string | null;
  claudeKey?: string | null;
  openaiKey?: string | null;
  openrouterKey?: string | null;
  monthlyTokenLimit?: number | null;
}

/** Default según TenantPlan (FREE → DISABLED, PRO → PLATFORM). */
export function defaultModeForPlan(plan: TenantPlan): TenantAIMode {
  return plan === 'PRO' ? 'PLATFORM' : 'DISABLED';
}

@Injectable()
export class AISettingsService {
  private readonly logger = new Logger(AISettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Platform (super-admin)
  // -------------------------------------------------------------------------

  async getPlatformSettings(): Promise<PlatformAISettingsView> {
    const row = await this.prisma.raw.platformAISettings.findUnique({
      where: { id: SINGLETON_ID },
    });

    return {
      defaultProvider: row?.defaultProvider ?? null,
      defaultModel: row?.defaultModel ?? null,
      embeddingsProvider: row?.embeddingsProvider ?? null,
      embeddingsModel: row?.embeddingsModel ?? null,
      hasClaudeKey: !!row?.claudeKeyEnc,
      hasOpenAIKey: !!row?.openaiKeyEnc,
      hasOpenRouterKey: !!row?.openrouterKeyEnc,
      hasEmbeddingsKey: !!row?.embeddingsKeyEnc,
      claudeKeyMasked: this.tryMask(row?.claudeKeyEnc),
      openaiKeyMasked: this.tryMask(row?.openaiKeyEnc),
      openrouterKeyMasked: this.tryMask(row?.openrouterKeyEnc),
      embeddingsKeyMasked: this.tryMask(row?.embeddingsKeyEnc),
      cipherReady: isCipherReady(),
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  }

  async updatePlatformSettings(input: UpdatePlatformAISettings): Promise<PlatformAISettingsView> {
    const data: Prisma.PlatformAISettingsUpsertArgs['create'] = { id: SINGLETON_ID };
    const update: Prisma.PlatformAISettingsUpdateInput = {};

    if (input.defaultProvider !== undefined) {
      data.defaultProvider = input.defaultProvider;
      update.defaultProvider = input.defaultProvider;
    }
    if (input.defaultModel !== undefined) {
      data.defaultModel = input.defaultModel;
      update.defaultModel = input.defaultModel;
    }
    if (input.embeddingsProvider !== undefined) {
      data.embeddingsProvider = input.embeddingsProvider;
      update.embeddingsProvider = input.embeddingsProvider;
    }
    if (input.embeddingsModel !== undefined) {
      data.embeddingsModel = input.embeddingsModel;
      update.embeddingsModel = input.embeddingsModel;
    }
    // Keys — encriptar antes de persistir. Pasar string vacío "" borra la key.
    if (input.claudeKey !== undefined) {
      const enc = encryptKey(input.claudeKey);
      data.claudeKeyEnc = enc;
      update.claudeKeyEnc = enc;
    }
    if (input.openaiKey !== undefined) {
      const enc = encryptKey(input.openaiKey);
      data.openaiKeyEnc = enc;
      update.openaiKeyEnc = enc;
    }
    if (input.openrouterKey !== undefined) {
      const enc = encryptKey(input.openrouterKey);
      data.openrouterKeyEnc = enc;
      update.openrouterKeyEnc = enc;
    }
    if (input.embeddingsKey !== undefined) {
      const enc = encryptKey(input.embeddingsKey);
      data.embeddingsKeyEnc = enc;
      update.embeddingsKeyEnc = enc;
    }

    await this.prisma.raw.platformAISettings.upsert({
      where: { id: SINGLETON_ID },
      create: data,
      update,
    });
    this.logger.log('PlatformAISettings actualizado');
    return this.getPlatformSettings();
  }

  // -------------------------------------------------------------------------
  // Tenant
  // -------------------------------------------------------------------------

  async getTenantSettings(tenantId: string): Promise<TenantAISettingsView> {
    const tenant = await this.prisma.raw.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, plan: true },
    });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');

    const row = await this.prisma.raw.tenantAISettings.findUnique({
      where: { tenantId },
    });
    const defaultByPlan = defaultModeForPlan(tenant.plan);

    return {
      mode: row?.mode ?? defaultByPlan,
      provider: row?.provider ?? null,
      model: row?.model ?? null,
      hasClaudeKey: !!row?.claudeKeyEnc,
      hasOpenAIKey: !!row?.openaiKeyEnc,
      hasOpenRouterKey: !!row?.openrouterKeyEnc,
      claudeKeyMasked: this.tryMask(row?.claudeKeyEnc),
      openaiKeyMasked: this.tryMask(row?.openaiKeyEnc),
      openrouterKeyMasked: this.tryMask(row?.openrouterKeyEnc),
      monthlyTokenLimit: row?.monthlyTokenLimit ?? null,
      monthlyTokenUsed: row?.monthlyTokenUsed ?? 0,
      monthlyResetAt: (row?.monthlyResetAt ?? new Date()).toISOString(),
      defaultByPlan,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  }

  async updateTenantSettings(
    tenantId: string,
    input: UpdateTenantAISettings,
  ): Promise<TenantAISettingsView> {
    const tenant = await this.prisma.raw.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, plan: true },
    });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');

    const data: Prisma.TenantAISettingsUpsertArgs['create'] = {
      tenantId,
      mode: input.mode ?? defaultModeForPlan(tenant.plan),
    };
    const update: Prisma.TenantAISettingsUpdateInput = {};

    if (input.mode !== undefined) {
      data.mode = input.mode;
      update.mode = input.mode;
    }
    if (input.provider !== undefined) {
      data.provider = input.provider;
      update.provider = input.provider;
    }
    if (input.model !== undefined) {
      data.model = input.model;
      update.model = input.model;
    }
    if (input.monthlyTokenLimit !== undefined) {
      data.monthlyTokenLimit = input.monthlyTokenLimit;
      update.monthlyTokenLimit = input.monthlyTokenLimit;
    }
    if (input.claudeKey !== undefined) {
      const enc = encryptKey(input.claudeKey);
      data.claudeKeyEnc = enc;
      update.claudeKeyEnc = enc;
    }
    if (input.openaiKey !== undefined) {
      const enc = encryptKey(input.openaiKey);
      data.openaiKeyEnc = enc;
      update.openaiKeyEnc = enc;
    }
    if (input.openrouterKey !== undefined) {
      const enc = encryptKey(input.openrouterKey);
      data.openrouterKeyEnc = enc;
      update.openrouterKeyEnc = enc;
    }

    await this.prisma.raw.tenantAISettings.upsert({
      where: { tenantId },
      create: data,
      update,
    });
    this.logger.log(`TenantAISettings ${tenantId} actualizado`);
    return this.getTenantSettings(tenantId);
  }

  // -------------------------------------------------------------------------
  // Resolver (usado por AIService al momento de generar)
  // -------------------------------------------------------------------------

  /**
   * Devuelve qué provider+key efectivos usar para un tenant. Lanza ForbiddenException
   * si el tenant tiene IA deshabilitada (DISABLED).
   */
  async resolveForTenant(tenantId: string): Promise<ResolvedAIConfig> {
    const tenant = await this.prisma.raw.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, plan: true },
    });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');

    const tenantSettings = await this.prisma.raw.tenantAISettings.findUnique({
      where: { tenantId },
    });
    const platform = await this.prisma.raw.platformAISettings.findUnique({
      where: { id: SINGLETON_ID },
    });

    const mode = tenantSettings?.mode ?? defaultModeForPlan(tenant.plan);

    if (mode === 'DISABLED') {
      throw new ForbiddenException({
        code: 'AI_DISABLED',
        message:
          'Tu plan no incluye IA. Pasá a un plan con IA o cargá tus propias keys en /admin/settings/ai.',
      });
    }

    // Resolver provider/modelo: tenant override → platform default → fallback claude.
    const provider =
      ((tenantSettings?.provider as AIProviderName | null | undefined) ??
        (platform?.defaultProvider as AIProviderName | null | undefined) ??
        'mock') as AIProviderName;
    const model =
      tenantSettings?.model ?? platform?.defaultModel ?? undefined;

    // Resolver la key según modo + provider.
    let encrypted: string | null = null;
    if (mode === 'OWN') {
      encrypted = this.pickKeyEnc(tenantSettings, provider);
      if (!encrypted) {
        throw new ForbiddenException({
          code: 'AI_KEY_MISSING',
          message: `Tu inmobiliaria está en modo OWN pero no tiene key para ${provider}. Cargala en /admin/settings/ai.`,
        });
      }
    } else if (mode === 'PLATFORM') {
      encrypted = this.pickKeyEnc(platform, provider);
      if (!encrypted && provider !== 'mock') {
        throw new ForbiddenException({
          code: 'AI_PLATFORM_KEY_MISSING',
          message: `El super-admin no cargó la key de ${provider} en el panel de plataforma.`,
        });
      }
    }

    return {
      provider,
      model,
      apiKey: encrypted ? decryptKey(encrypted) : null,
      billable: mode === 'PLATFORM',
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private pickKeyEnc(
    row:
      | { claudeKeyEnc?: string | null; openaiKeyEnc?: string | null; openrouterKeyEnc?: string | null }
      | null
      | undefined,
    provider: AIProviderName,
  ): string | null {
    if (!row) return null;
    switch (provider) {
      case 'claude':
        return row.claudeKeyEnc ?? null;
      case 'openai':
        return row.openaiKeyEnc ?? null;
      case 'openrouter':
        return row.openrouterKeyEnc ?? null;
      default:
        return null;
    }
  }

  private tryMask(enc: string | null | undefined): string | null {
    if (!enc) return null;
    try {
      return maskKey(decryptKey(enc));
    } catch {
      return '•••• (cipher inválido)';
    }
  }
}
