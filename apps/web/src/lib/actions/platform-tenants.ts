'use server';

import { revalidatePath } from 'next/cache';
import {
  createTenantSchema,
  resetUserPasswordSchema,
  updateTenantSchema,
  type CreateTenantInput,
  type ResetUserPasswordInput,
  type TenantDetail,
  type TenantListItem,
  type UpdateTenantInput,
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

function zodToFieldErrors(
  issues: { path: (string | number)[]; message: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path.join('.') || '_';
    if (!out[key]) out[key] = i.message;
  }
  return out;
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
    return {
      ok: false,
      error: {
        message: 'Revisá los campos marcados',
        fieldErrors: zodToFieldErrors(parsed.error.issues),
      },
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

export async function updateTenantAction(
  tenantId: string,
  input: UpdateTenantInput,
): Promise<ActionResult<TenantListItem>> {
  await requirePlatformAdmin();

  const cleaned = sanitize(input);
  const parsed = updateTenantSchema.safeParse(cleaned);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        message: 'Revisá los campos marcados',
        fieldErrors: zodToFieldErrors(parsed.error.issues),
      },
    };
  }

  try {
    const api = getPlatformApi();
    const data = await api.patch<TenantListItem>(
      `/platform-admin/tenants/${tenantId}`,
      parsed.data,
    );
    revalidatePath('/platform-admin');
    revalidatePath(`/platform-admin/tenants/${tenantId}`);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: apiErrorToAction(err) };
  }
}

export async function setTenantStatusAction(
  tenantId: string,
  action: 'suspend' | 'reactivate',
): Promise<ActionResult<TenantListItem>> {
  await requirePlatformAdmin();
  try {
    const api = getPlatformApi();
    const data = await api.post<TenantListItem>(
      `/platform-admin/tenants/${tenantId}/${action}`,
    );
    revalidatePath('/platform-admin');
    revalidatePath(`/platform-admin/tenants/${tenantId}`);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: apiErrorToAction(err) };
  }
}

export async function deleteTenantAction(
  tenantId: string,
): Promise<ActionResult<{ ok: true }>> {
  await requirePlatformAdmin();
  try {
    const api = getPlatformApi();
    await api.delete(`/platform-admin/tenants/${tenantId}`);
    revalidatePath('/platform-admin');
    return { ok: true, data: { ok: true } };
  } catch (err) {
    return { ok: false, error: apiErrorToAction(err) };
  }
}

export async function resetUserPasswordAction(
  tenantId: string,
  userId: string,
  input: ResetUserPasswordInput,
): Promise<ActionResult<{ ok: true }>> {
  await requirePlatformAdmin();

  const parsed = resetUserPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        message: 'Password inválida',
        fieldErrors: zodToFieldErrors(parsed.error.issues),
      },
    };
  }

  try {
    const api = getPlatformApi();
    await api.post(
      `/platform-admin/tenants/${tenantId}/users/${userId}/reset-password`,
      parsed.data,
    );
    revalidatePath(`/platform-admin/tenants/${tenantId}`);
    return { ok: true, data: { ok: true } };
  } catch (err) {
    return { ok: false, error: apiErrorToAction(err) };
  }
}

export async function getTenantDetailAction(
  tenantId: string,
): Promise<ActionResult<TenantDetail>> {
  await requirePlatformAdmin();
  try {
    const api = getPlatformApi({ cache: 'no-store' });
    const data = await api.get<TenantDetail>(`/platform-admin/tenants/${tenantId}`);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: apiErrorToAction(err) };
  }
}
