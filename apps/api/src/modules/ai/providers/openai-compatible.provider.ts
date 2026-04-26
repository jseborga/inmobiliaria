import { InternalServerErrorException, Logger } from '@nestjs/common';
import type { AIGenerateInput, AIGenerateResult, AIProvider } from './types';

interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAICompatibleConfig {
  /** Nombre lógico (openai u openrouter). */
  name: 'openai' | 'openrouter';
  /** Endpoint completo de chat completions. */
  endpoint: string;
  /** Bearer key. */
  apiKey: string;
  /** Modelo default si no se pasa uno. */
  defaultModel: string;
  /** Headers extra (ej. OpenRouter pide HTTP-Referer + X-Title). */
  extraHeaders?: Record<string, string>;
}

/**
 * Provider para APIs compatibles con OpenAI Chat Completions: OpenAI y OpenRouter
 * comparten el mismo formato de request/response, así que un único cliente
 * sirve para ambos cambiando endpoint + key.
 *
 * Modelos sugeridos:
 *   - OpenAI: gpt-4o-mini (barato), gpt-4o, gpt-4.1
 *   - OpenRouter: meta-llama/llama-3.1-70b-instruct, anthropic/claude-3.5-sonnet,
 *                 google/gemini-pro-1.5, mistralai/mistral-large
 */
export class OpenAICompatibleProvider implements AIProvider {
  private readonly logger: Logger;
  readonly name: 'openai' | 'openrouter';
  readonly defaultModel: string;

  constructor(private readonly config: OpenAICompatibleConfig) {
    if (!config.apiKey) {
      throw new Error(`${config.name}Provider requiere API key`);
    }
    this.name = config.name;
    this.defaultModel = config.defaultModel;
    this.logger = new Logger(`${config.name}Provider`);
  }

  async generate(input: AIGenerateInput, model?: string): Promise<AIGenerateResult> {
    const finalModel = model || this.defaultModel;
    const res = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        ...(this.config.extraHeaders ?? {}),
      },
      body: JSON.stringify({
        model: finalModel,
        max_tokens: input.maxTokens ?? 1024,
        temperature: input.temperature ?? 0.7,
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user },
        ],
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      const msg = body?.error?.message ?? `${res.status} ${res.statusText}`;
      this.logger.error(`API error: ${msg}`);
      throw new InternalServerErrorException(`${this.config.name} API: ${msg}`);
    }

    const body = (await res.json()) as ChatCompletionResponse;
    const text = body.choices[0]?.message?.content?.trim() ?? '';

    return {
      text,
      model: body.model,
      provider: this.name,
      usage: body.usage
        ? {
            inputTokens: body.usage.prompt_tokens,
            outputTokens: body.usage.completion_tokens,
          }
        : undefined,
    };
  }
}
