'use server';

import { ApiError } from '@/lib/api';
import { getServerApi } from '@/lib/api/server';
import { requireUser } from '@/lib/auth/session';

export interface AiActionError {
  message: string;
}

export type AiActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: AiActionError };

export interface GenerateDescriptionInput {
  propertyId: string;
  tone?: 'commercial' | 'family' | 'investor' | 'luxury';
  approxWords?: number;
  notes?: string;
  /** Override del provider (default: el global del API). */
  provider?: 'claude' | 'openai' | 'openrouter' | 'mock';
  model?: string;
}

export interface GenerateDescriptionResult {
  description: string;
  provider: string;
  model: string;
  tone: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}

export async function generatePropertyDescription(
  input: GenerateDescriptionInput,
): Promise<AiActionResult<GenerateDescriptionResult>> {
  await requireUser(`/admin/properties/${input.propertyId}/edit`);
  const { propertyId, ...rest } = input;
  const sanitized = Object.fromEntries(
    Object.entries(rest).filter(([, v]) => v !== undefined && v !== ''),
  );
  try {
    const api = getServerApi({ cache: 'no-store' });
    const data = await api.post<GenerateDescriptionResult>(
      `/ai/properties/${propertyId}/description`,
      sanitized,
    );
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ApiError) {
      const body = err.body as { message?: string | string[] } | null;
      const msg = Array.isArray(body?.message)
        ? body!.message.join(', ')
        : body?.message ?? err.displayMessage;
      return { ok: false, error: { message: msg } };
    }
    return { ok: false, error: { message: 'Error inesperado al consultar la IA' } };
  }
}

export interface AIProvidersStatus {
  default: 'claude' | 'openai' | 'openrouter' | 'mock';
  available: Array<'claude' | 'openai' | 'openrouter' | 'mock'>;
}

export async function getAIProvidersStatus(): Promise<AIProvidersStatus | null> {
  await requireUser();
  try {
    const api = getServerApi({ cache: 'no-store' });
    return await api.get<AIProvidersStatus>('/ai/providers');
  } catch {
    return null;
  }
}
