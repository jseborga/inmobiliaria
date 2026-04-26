import { Injectable, Logger } from '@nestjs/common';
import type { AIFeature } from '@prisma/client';
import { ClaudeProvider } from './providers/claude.provider';
import { MockAIProvider } from './providers/mock.provider';
import { OpenAICompatibleProvider } from './providers/openai-compatible.provider';
import type { AIGenerateInput, AIGenerateResult, AIProvider } from './providers/types';
import { AISettingsService } from './ai-settings.service';
import { AIUsageService } from './ai-usage.service';

export type AIProviderName = 'claude' | 'openai' | 'openrouter' | 'mock';

const DEFAULT_MODELS: Record<AIProviderName, string> = {
  claude: 'claude-haiku-4-5-20251001',
  openai: 'gpt-4o-mini',
  openrouter: 'meta-llama/llama-3.3-70b-instruct',
  mock: 'mock-determ-v1',
};

const OPENROUTER_EXTRA_HEADERS: Record<string, string> = {
  'HTTP-Referer': process.env.WEB_PUBLIC_URL ?? 'https://inmobiliaria.local',
  'X-Title': 'Inmobiliaria',
};

/**
 * Orquesta llamadas a LLM. Resuelve el provider+key en runtime via
 * AISettingsService según el modo del tenant (DISABLED/PLATFORM/OWN).
 *
 * Cada provider se construye on-the-fly por request — no hay singleton de
 * keys porque cambian según el tenant. El mock provider es el único que
 * persiste como instancia (es estático, no necesita key).
 */
@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly mock = new MockAIProvider();

  constructor(
    private readonly settings: AISettingsService,
    private readonly usage: AIUsageService,
  ) {}

  /**
   * Genera texto en nombre de un tenant.
   *
   * @param tenantId   Owner del request — define qué key/modo usar.
   * @param feature    Para qué se está usando (description, chatbot, embeddings).
   *                   Se persiste en AIUsage.
   * @param input      Prompt + parámetros de generación.
   * @param overrides  Override opcional de provider/modelo (request-level).
   *                   Si no se pasa, usa lo configurado en el tenant/platform.
   */
  async generate(
    tenantId: string,
    feature: AIFeature,
    input: AIGenerateInput,
    overrides: { provider?: AIProviderName; model?: string } = {},
  ): Promise<AIGenerateResult> {
    const resolved = await this.settings.resolveForTenant(tenantId);

    const provider = overrides.provider ?? resolved.provider;
    const model = overrides.model ?? resolved.model ?? DEFAULT_MODELS[provider];

    const instance = this.buildProvider(provider, resolved.apiKey);
    const result = await instance.generate(input, model);

    // Log usage (no bloquea si falla)
    void this.usage.record({
      tenantId,
      feature,
      provider: result.provider,
      model: result.model,
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      billable: resolved.billable,
    });

    return result;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private buildProvider(name: AIProviderName, apiKey: string | null): AIProvider {
    if (name === 'mock') return this.mock;
    if (!apiKey) {
      this.logger.warn(
        `Provider ${name} sin API key resuelta — fallback a mock para no romper la request`,
      );
      return this.mock;
    }
    switch (name) {
      case 'claude':
        return new ClaudeProvider(apiKey);
      case 'openai':
        return new OpenAICompatibleProvider({
          name: 'openai',
          endpoint: 'https://api.openai.com/v1/chat/completions',
          apiKey,
          defaultModel: DEFAULT_MODELS.openai,
        });
      case 'openrouter':
        return new OpenAICompatibleProvider({
          name: 'openrouter',
          endpoint: 'https://openrouter.ai/api/v1/chat/completions',
          apiKey,
          defaultModel: DEFAULT_MODELS.openrouter,
          extraHeaders: OPENROUTER_EXTRA_HEADERS,
        });
    }
  }

  /** Útil para diagnóstico (panel super-admin). */
  defaultModelFor(provider: AIProviderName): string {
    return DEFAULT_MODELS[provider];
  }
}
