/**
 * Tipos del módulo de configuración de IA por tenant.
 * Compartidos entre API y web. Las keys NUNCA viajan en claro al cliente —
 * solo enmascaradas (`••••XXXX`).
 */

export type TenantAIMode = 'DISABLED' | 'PLATFORM' | 'OWN';
export type AIProviderName = 'claude' | 'openai' | 'openrouter' | 'mock';
export type AIFeature = 'DESCRIPTION' | 'CHATBOT' | 'EMBEDDINGS';

export interface PlatformAISettingsView {
  defaultProvider: string | null;
  defaultModel: string | null;
  embeddingsProvider: string | null;
  embeddingsModel: string | null;
  hasClaudeKey: boolean;
  hasOpenAIKey: boolean;
  hasOpenRouterKey: boolean;
  hasEmbeddingsKey: boolean;
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
  defaultByPlan: TenantAIMode;
  updatedAt: string | null;
}

export interface AIUsageBreakdownEntry {
  feature: AIFeature;
  provider: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
}

export interface AIUsageMonthlySummary {
  since: string;
  totals: { calls: number; inputTokens: number; outputTokens: number };
  breakdown: AIUsageBreakdownEntry[];
}
