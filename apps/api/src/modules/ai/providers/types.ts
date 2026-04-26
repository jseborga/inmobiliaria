/**
 * Contrato común para todos los proveedores de LLM (Claude, OpenAI, OpenRouter, mock).
 *
 * Diseño:
 *   - Un único método `generate({ system, user })` que devuelve texto plano.
 *   - El service decide qué provider usar a partir de env vars (AI_PROVIDER + AI_MODEL).
 *   - Todos los providers retornan la misma forma para que el caller no se entere.
 */

export interface AIGenerateInput {
  /** Instrucción de sistema (rol, estilo, idioma). */
  system: string;
  /** Prompt del usuario (datos de entrada). */
  user: string;
  /** Tokens máximos a generar. Default por provider si no se pasa. */
  maxTokens?: number;
  /** Temperature 0-1. Default 0.7 (texto comercial creativo pero no errático). */
  temperature?: number;
}

export interface AIGenerateResult {
  /** Texto generado, sin metadata. */
  text: string;
  /** Modelo efectivo usado (para mostrar al user / debug). */
  model: string;
  /** Provider efectivo usado. */
  provider: 'claude' | 'openai' | 'openrouter' | 'mock';
  /** Tokens consumidos si el provider los reporta. */
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface AIProvider {
  readonly name: 'claude' | 'openai' | 'openrouter' | 'mock';
  readonly defaultModel: string;
  generate(input: AIGenerateInput, model?: string): Promise<AIGenerateResult>;
}
