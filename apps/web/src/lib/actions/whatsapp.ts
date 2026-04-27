'use server';

import { revalidatePath } from 'next/cache';
import type { SendWhatsappResult, WhatsappIntegrationView } from '@inmobiliaria/shared';
import { ApiError } from '@/lib/api';
import { getServerApi } from '@/lib/api/server';
import { requireUser } from '@/lib/auth/session';

export interface WaActionError {
  message: string;
}
export type WaActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: WaActionError };

function apiErrorTo(err: unknown): WaActionError {
  if (err instanceof ApiError) {
    const body = err.body as { message?: string | string[] } | null;
    const msg = Array.isArray(body?.message)
      ? body!.message.join(', ')
      : body?.message ?? err.displayMessage;
    return { message: msg };
  }
  return { message: 'Error inesperado' };
}

export async function getMyWhatsappIntegration(): Promise<WhatsappIntegrationView> {
  await requireUser('/admin/settings/whatsapp');
  const api = getServerApi({ cache: 'no-store' });
  return api.get<WhatsappIntegrationView>('/tenants/current/whatsapp/integration');
}

export interface UpdateWhatsappIntegrationInput {
  baseUrl?: string | null;
  instance?: string | null;
  apiKey?: string | null;
  testMode?: boolean;
  enabled?: boolean;
  botEnabled?: boolean;
  rotateWebhookSecret?: boolean;
}

export async function updateMyWhatsappIntegration(
  input: UpdateWhatsappIntegrationInput,
): Promise<WaActionResult<WhatsappIntegrationView>> {
  await requireUser('/admin/settings/whatsapp');
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) sanitized[k] = v;
  }
  try {
    const api = getServerApi({ cache: 'no-store' });
    const data = await api.patch<WhatsappIntegrationView>(
      '/tenants/current/whatsapp/integration',
      sanitized,
    );
    revalidatePath('/admin/settings/whatsapp');
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: apiErrorTo(err) };
  }
}

export async function testSendWhatsapp(
  phone: string,
  text?: string,
): Promise<WaActionResult<SendWhatsappResult>> {
  await requireUser('/admin/settings/whatsapp');
  try {
    const api = getServerApi({ cache: 'no-store' });
    const data = await api.post<SendWhatsappResult>(
      '/tenants/current/whatsapp/integration/test-send',
      { phone, ...(text ? { text } : {}) },
    );
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: apiErrorTo(err) };
  }
}
