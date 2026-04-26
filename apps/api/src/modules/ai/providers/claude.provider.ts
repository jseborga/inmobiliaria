import { InternalServerErrorException, Logger } from '@nestjs/common';
import type { AIGenerateInput, AIGenerateResult, AIProvider } from './types';

const CLAUDE_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

interface ClaudeMessagesResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  model: string;
  content: Array<{ type: string; text?: string }>;
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
}

interface ClaudeErrorResponse {
  type: 'error';
  error: { type: string; message: string };
}

/**
 * Anthropic Claude. Usa la API directa (sin SDK) para mantener cero deps nuevas.
 *
 * Modelos sugeridos (al 2026-04):
 *   - claude-haiku-4-5-20251001       (rápido y barato, default recomendado)
 *   - claude-sonnet-4-6               (calidad media-alta)
 *   - claude-opus-4-7                 (máxima calidad, más caro)
 */
export class ClaudeProvider implements AIProvider {
  readonly name = 'claude' as const;
  readonly defaultModel = 'claude-haiku-4-5-20251001';
  private readonly logger = new Logger(ClaudeProvider.name);

  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new Error('ClaudeProvider requiere ANTHROPIC_API_KEY');
    }
  }

  async generate(input: AIGenerateInput, model?: string): Promise<AIGenerateResult> {
    const finalModel = model || this.defaultModel;
    const res = await fetch(CLAUDE_API, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: finalModel,
        max_tokens: input.maxTokens ?? 1024,
        temperature: input.temperature ?? 0.7,
        system: input.system,
        messages: [{ role: 'user', content: input.user }],
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as ClaudeErrorResponse | null;
      const msg = body?.error?.message ?? `${res.status} ${res.statusText}`;
      this.logger.error(`Claude API error: ${msg}`);
      throw new InternalServerErrorException(`Claude API: ${msg}`);
    }

    const body = (await res.json()) as ClaudeMessagesResponse;
    const text = body.content
      .filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text!)
      .join('\n')
      .trim();

    return {
      text,
      model: body.model,
      provider: 'claude',
      usage: {
        inputTokens: body.usage.input_tokens,
        outputTokens: body.usage.output_tokens,
      },
    };
  }
}
