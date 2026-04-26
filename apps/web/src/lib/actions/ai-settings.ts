'use server';

import { revalidatePath } from 'next/cache';
import type {
  AIUsageMonthlySummary,
  PlatformAISettingsView,
  TenantAISettingsView,
} from '@inmobiliaria/shared';
import { ApiError } from '@/lib/api';
import { getPlatformApi } from '@/lib/api/platform';
import { getServerApi } from '@/lib/api/server';
import { requirePlatformAdmin } from '@/lib/auth/platform-session';
import { requireUser } from '@/lib/auth/session';

export interface AiSettingsActionError {
  message: string;
}

export type AiSettingsActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: AiSettingsActionError };

function apiErrorTo(err: unknown): AiSettingsActionError {
  if (err instanceof ApiError) {
    const body = err.body as { message?: string | string[] } | null;
    const msg = Array.isArray(body?.message)
      ? body!.message.join(', ')
      : body?.message ?? err.displayMessage;
    return { message: msg };
  }
  return { message: 'Error inesperado' };
}

// ---------------------------------------------------------------------------
// Super-admin
// ---------------------------------------------------------------------------

export async function getPlatformAISettings(): Promise<PlatformAISettingsView> {
  await requirePlatformAdmin('/platform-admin/ai-settings');
  const api = getPlatformApi({ cache: 'no-store' });
  return api.get<PlatformAISettingsView>('/platform-admin/ai-settings');
}

export interface UpdatePlatformAISettingsInput {
  defaultProvider?: 'claude' | 'openai' | 'openrouter' | 'mock' | null;
  defaultModel?: string | null;
  claudeKey?: string | null;
  openaiKey?: string | null;
  openrouterKey?: string | null;
  embeddingsProvider?: string | null;
  embeddingsModel?: string | null;
  embeddingsKey?: string | null;
}

export async function updatePlatformAISettings(
  input: UpdatePlatformAISettingsInput,
): Promise<AiSettingsActionResult<PlatformAISettingsView>> {
  await requirePlatformAdmin('/platform-admin/ai-settings');
  // Solo enviamos campos presentes; null SÍ se manda (significa "borrar key").
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) sanitized[k] = v;
  }
  try {
    const api = getPlatformApi({ cache: 'no-store' });
    const data = await api.patch<PlatformAISettingsView>('/platform-admin/ai-settings', sanitized);
    revalidatePath('/platform-admin/ai-settings');
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: apiErrorTo(err) };
  }
}

export async function getPlatformTenantAISettings(
  tenantId: string,
): Promise<TenantAISettingsView> {
  await requirePlatformAdmin();
  const api = getPlatformApi({ cache: 'no-store' });
  return api.get<TenantAISettingsView>(`/platform-admin/tenants/${tenantId}/ai-settings`);
}

export interface UpdateTenantAIByPlatformInput {
  mode?: 'DISABLED' | 'PLATFORM' | 'OWN';
  provider?: 'claude' | 'openai' | 'openrouter' | 'mock' | null;
  model?: string | null;
  monthlyTokenLimit?: number | null;
}

export async function updateTenantAISettingsByPlatform(
  tenantId: string,
  input: UpdateTenantAIByPlatformInput,
): Promise<AiSettingsActionResult<TenantAISettingsView>> {
  await requirePlatformAdmin();
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) sanitized[k] = v;
  }
  try {
    const api = getPlatformApi({ cache: 'no-store' });
    const data = await api.patch<TenantAISettingsView>(
      `/platform-admin/tenants/${tenantId}/ai-settings`,
      sanitized,
    );
    revalidatePath(`/platform-admin/tenants/${tenantId}`);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: apiErrorTo(err) };
  }
}

export async function getPlatformTenantAIUsage(
  tenantId: string,
): Promise<AIUsageMonthlySummary | null> {
  await requirePlatformAdmin();
  try {
    const api = getPlatformApi({ cache: 'no-store' });
    return await api.get<AIUsageMonthlySummary>(`/platform-admin/tenants/${tenantId}/ai-usage`);
  } catch {
    return null;
  }
}

export interface ReindexResult {
  total: number;
  indexed: number;
  skipped: number;
}

export async function reindexProperties(
  onlyMissing: boolean,
): Promise<AiSettingsActionResult<ReindexResult>> {
  await requirePlatformAdmin();
  try {
    const api = getPlatformApi({ cache: 'no-store' });
    const data = await api.post<ReindexResult>('/platform-admin/ai/reindex', { onlyMissing });
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: apiErrorTo(err) };
  }
}

export async function getEmbeddingsStatus(): Promise<{ ready: boolean }> {
  await requirePlatformAdmin();
  try {
    const api = getPlatformApi({ cache: 'no-store' });
    return await api.get<{ ready: boolean }>('/platform-admin/ai/embeddings/status');
  } catch {
    return { ready: false };
  }
}

// ---------------------------------------------------------------------------
// Tenant (OWNER/ADMIN)
// ---------------------------------------------------------------------------

export async function getMyTenantAISettings(): Promise<TenantAISettingsView> {
  await requireUser('/admin/settings/ai');
  const api = getServerApi({ cache: 'no-store' });
  return api.get<TenantAISettingsView>('/tenants/current/ai/settings');
}

export interface UpdateTenantAIByOwnerInput {
  mode?: 'DISABLED' | 'PLATFORM' | 'OWN';
  provider?: 'claude' | 'openai' | 'openrouter' | 'mock' | null;
  model?: string | null;
  claudeKey?: string | null;
  openaiKey?: string | null;
  openrouterKey?: string | null;
}

export async function updateMyTenantAISettings(
  input: UpdateTenantAIByOwnerInput,
): Promise<AiSettingsActionResult<TenantAISettingsView>> {
  await requireUser('/admin/settings/ai');
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) sanitized[k] = v;
  }
  try {
    const api = getServerApi({ cache: 'no-store' });
    const data = await api.patch<TenantAISettingsView>('/tenants/current/ai/settings', sanitized);
    revalidatePath('/admin/settings/ai');
    revalidatePath('/admin');
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: apiErrorTo(err) };
  }
}

export async function getMyTenantAIUsage(): Promise<AIUsageMonthlySummary | null> {
  await requireUser('/admin/settings/ai');
  try {
    const api = getServerApi({ cache: 'no-store' });
    return await api.get<AIUsageMonthlySummary>('/tenants/current/ai/usage');
  } catch {
    return null;
  }
}
