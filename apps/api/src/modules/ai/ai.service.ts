import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClaudeProvider } from './providers/claude.provider';
import { MockAIProvider } from './providers/mock.provider';
import { OpenAICompatibleProvider } from './providers/openai-compatible.provider';
import type { AIGenerateInput, AIGenerateResult, AIProvider } from './providers/types';

export type AIProviderName = 'claude' | 'openai' | 'openrouter' | 'mock';

const DEFAULT_MODELS: Record<AIProviderName, string> = {
  claude: 'claude-haiku-4-5-20251001',
  openai: 'gpt-4o-mini',
  openrouter: 'meta-llama/llama-3.3-70b-instruct',
  mock: 'mock-determ-v1',
};

/**
 * Orquesta los providers de LLM. Lee la configuración por env vars:
 *
 *   AI_PROVIDER       claude | openai | openrouter | mock   (default: mock si no hay key)
 *   AI_MODEL          override del modelo default del provider
 *   ANTHROPIC_API_KEY  para Claude
 *   OPENAI_API_KEY     para OpenAI
 *   OPENROUTER_API_KEY para OpenRouter
 *
 * Si AI_PROVIDER no está y NO hay ninguna key, default a `mock` para no romper
 * deploys sin IA configurada. Útil en CI / staging.
 */
@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly defaultProviderName: AIProviderName;
  private readonly defaultModel: string | undefined;
  private readonly providers = new Map<AIProviderName, AIProvider>();

  constructor(
    @Optional() @Inject(ConfigService) private readonly config?: ConfigService,
  ) {
    const requested = (this.config?.get<string>('AI_PROVIDER') ?? '')
      .trim()
      .toLowerCase() as AIProviderName | '';

    this.providers.set('mock', new MockAIProvider());

    const claudeKey = this.config?.get<string>('ANTHROPIC_API_KEY');
    if (claudeKey) {
      this.providers.set('claude', new ClaudeProvider(claudeKey));
    }

    const openaiKey = this.config?.get<string>('OPENAI_API_KEY');
    if (openaiKey) {
      this.providers.set(
        'openai',
        new OpenAICompatibleProvider({
          name: 'openai',
          endpoint: 'https://api.openai.com/v1/chat/completions',
          apiKey: openaiKey,
          defaultModel: DEFAULT_MODELS.openai,
        }),
      );
    }

    const openrouterKey = this.config?.get<string>('OPENROUTER_API_KEY');
    if (openrouterKey) {
      this.providers.set(
        'openrouter',
        new OpenAICompatibleProvider({
          name: 'openrouter',
          endpoint: 'https://openrouter.ai/api/v1/chat/completions',
          apiKey: openrouterKey,
          defaultModel: DEFAULT_MODELS.openrouter,
          extraHeaders: {
            // OpenRouter recomienda estos headers para identificar la app:
            'HTTP-Referer': this.config?.get<string>('WEB_PUBLIC_URL') ?? 'https://inmobiliaria.local',
            'X-Title': 'Inmobiliaria',
          },
        }),
      );
    }

    // Default provider: el solicitado por env, si está disponible. Sino el
    // primero disponible que no sea mock. Sino mock.
    if (requested && this.providers.has(requested as AIProviderName)) {
      this.defaultProviderName = requested as AIProviderName;
    } else if (this.providers.has('claude')) {
      this.defaultProviderName = 'claude';
    } else if (this.providers.has('openai')) {
      this.defaultProviderName = 'openai';
    } else if (this.providers.has('openrouter')) {
      this.defaultProviderName = 'openrouter';
    } else {
      this.defaultProviderName = 'mock';
    }

    const modelOverride = this.config?.get<string>('AI_MODEL');
    this.defaultModel = modelOverride && modelOverride.trim().length > 0
      ? modelOverride.trim()
      : undefined;

    this.logger.log(
      `AIService listo — provider=${this.defaultProviderName}` +
        (this.defaultModel ? ` model=${this.defaultModel}` : '') +
        ` | disponibles: ${[...this.providers.keys()].join(', ')}`,
    );
  }

  /** Lista de providers cargados (para diagnóstico / panel de config). */
  availableProviders(): AIProviderName[] {
    return [...this.providers.keys()];
  }

  defaultProvider(): AIProviderName {
    return this.defaultProviderName;
  }

  async generate(
    input: AIGenerateInput,
    opts: { provider?: AIProviderName; model?: string } = {},
  ): Promise<AIGenerateResult> {
    const providerName = opts.provider ?? this.defaultProviderName;
    const provider = this.providers.get(providerName);
    if (!provider) {
      this.logger.warn(
        `Provider '${providerName}' no disponible, fallback a mock. Configurá la API key correspondiente.`,
      );
      return this.providers.get('mock')!.generate(input, opts.model);
    }
    const model = opts.model ?? this.defaultModel;
    return provider.generate(input, model);
  }
}
