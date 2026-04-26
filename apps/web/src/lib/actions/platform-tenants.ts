'use server';

import { revalidatePath } from 'next/cache';
import {
  createTenantSchema,
  type CreateTenantInput,
  type TenantListItem,
} from '@inmobiliaria/shared';
import { ApiError } from '@/lib/api';
import { getPlatformApi } from '@/lib/api/platform';
import { requirePlatformAdmin } from '@/lib/auth/platform-session';

/**
 * Server actions para administración de tenants (super-admin).
 * Mismo patrón que `actions/properties.ts`, autenticado con cookie de
 * platform-admin.
 */

export interface ActionError {
  message: string;
  fieldErrors?: Record<string, string>;
}

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };

function sanitize<T extends object>(input: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === '' || v === undefined) continue;
    out[k] = v;
  }
  return out as T;
}

function apiErrorToAction(err: unknown): ActionError {
  if (err instanceof ApiError) {
    const body = err.body as { message?: string | string[]; error?: string } | null;
    const msg = Array.isArray(body?.message)
      ? body!.message.join(', ')
      : body?.message ?? body?.error ?? err.displayMessage;
    return { message: msg };
  }
  return { message: 'Error inesperado al contactar la API' };
}

interface CreateTenantResponse {
  tenant: TenantListItem;
  owner: { id: string; email: string; firstName: string; lastName: string; role: string };
}

export async function createTenantAction(
  input: CreateTenantInput,
): Promise<ActionResult<CreateTenantResponse>> {
  await requirePlatformAdmin();

  const cleaned = sanitize(input);
  const parsed = createTenantSchema.safeParse(cleaned);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_';
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      ok: false,
      error: { message: 'Revisá los campos marcados', fieldErrors },
    };
  }

  try {
    const api = getPlatformApi();
    const data = await api.post<CreateTenantResponse>(
      '/platform-admin/tenants',
      parsed.data,
    );
    revalidatePath('/platform-admin');
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: apiErrorToAction(err) };
  }
}
