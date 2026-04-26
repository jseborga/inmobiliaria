import type { AIGenerateInput, AIGenerateResult, AIProvider } from './types';

/**
 * Mock provider determinístico para tests/CI/staging sin gastar API.
 * Devuelve un texto coherente armado con los datos del prompt — no analiza
 * inteligentemente, solo extrae palabras clave y arma una plantilla.
 */
export class MockAIProvider implements AIProvider {
  readonly name = 'mock' as const;
  readonly defaultModel = 'mock-determ-v1';

  async generate(input: AIGenerateInput, model?: string): Promise<AIGenerateResult> {
    // Extraemos algunos datos típicos del prompt para que la respuesta no sea
    // siempre idéntica. El system prompt indica el formato.
    const tokens = Array.from(
      new Set(
        input.user
          .toLowerCase()
          .replace(/[^a-záéíóúñ0-9\s]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length >= 4),
      ),
    ).slice(0, 6);

    const text = [
      `[mock-ai] Propiedad excelente con buena ubicación.`,
      tokens.length > 0 ? `Detalles destacados: ${tokens.join(', ')}.` : '',
      `Ideal para quienes buscan comodidad, conectividad y un entorno tranquilo.`,
      `Consultá disponibilidad y agendá tu visita hoy mismo.`,
    ]
      .filter(Boolean)
      .join(' ');

    return {
      text,
      model: model ?? this.defaultModel,
      provider: 'mock',
      usage: { inputTokens: input.user.length, outputTokens: text.length },
    };
  }
}
