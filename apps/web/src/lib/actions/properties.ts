'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  propertyCreateSchema,
  propertyUpdateSchema,
  type PropertyCreateInput,
  type PropertyDto,
  type PropertyUpdateInput,
} from '@inmobiliaria/shared';
import { ApiError } from '@/lib/api';
import { getServerApi } from '@/lib/api/server';
import { requireUser } from '@/lib/auth/session';

/**
 * Server actions para CRUD admin de propiedades.
 *
 * Decisión: usar Server Actions en vez de route handlers porque:
 *   - los forms del admin son siempre tenant-scoped y necesitan auth ya
 *     resuelta (no exponer un proxy público)
 *   - revalidatePath/Tag se invocan en el mismo módulo, sin ida y vuelta
 *   - los errores se devuelven como objetos serializables (`ActionResult`)
 *     y los forms los muestran directamente
 *
 * Convención: las actions devuelven `ActionResult` salvo cuando hay redirect
 * (en cuyo caso lanzan internamente `redirect()` de Next).
 */

export interface ActionError {
  message: string;
  /** Errores por campo (Zod issues path → mensaje). */
  fieldErrors?: Record<string, string>;
}

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };

function zodToFieldErrors(issues: { path: (string | number)[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path.join('.') || '_';
    if (!out[key]) out[key] = i.message;
  }
  return out;
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

function sanitize<T extends object>(input: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    // strings vacíos → undefined; null se conserva (semántica de "borrar").
    if (v === '' || v === undefined) continue;
    out[k] = v;
  }
  return out as T;
}

function revalidateAll(propertyId?: string): void {
  revalidatePath('/admin/properties');
  revalidatePath('/admin');
  revalidateTag('public-properties');
  if (propertyId) revalidatePath(`/admin/properties/${propertyId}/edit`);
}

export async function createProperty(
  raw: PropertyCreateInput,
): Promise<ActionResult<PropertyDto>> {
  await requireUser('/admin/properties/new');

  const parsed = propertyCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        message: 'Hay errores en el formulario',
        fieldErrors: zodToFieldErrors(parsed.error.issues),
      },
    };
  }

  try {
    const api = getServerApi({ cache: 'no-store' });
    const created = await api.post<PropertyDto>('/properties', sanitize(parsed.data));
    revalidateAll(created.id);
    return { ok: true, data: created };
  } catch (err) {
    return { ok: false, error: apiErrorToAction(err) };
  }
}

export async function updateProperty(
  id: string,
  raw: PropertyUpdateInput,
): Promise<ActionResult<PropertyDto>> {
  await requireUser(`/admin/properties/${id}/edit`);

  const parsed = propertyUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        message: 'Hay errores en el formulario',
        fieldErrors: zodToFieldErrors(parsed.error.issues),
      },
    };
  }

  try {
    const api = getServerApi({ cache: 'no-store' });
    const updated = await api.put<PropertyDto>(`/properties/${id}`, sanitize(parsed.data));
    revalidateAll(updated.id);
    return { ok: true, data: updated };
  } catch (err) {
    return { ok: false, error: apiErrorToAction(err) };
  }
}

export async function setPropertyStatus(
  id: string,
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
): Promise<ActionResult<PropertyDto>> {
  await requireUser(`/admin/properties/${id}/edit`);
  try {
    const api = getServerApi({ cache: 'no-store' });
    const updated = await api.put<PropertyDto>(`/properties/${id}`, { status });
    revalidateAll(updated.id);
    return { ok: true, data: updated };
  } catch (err) {
    return { ok: false, error: apiErrorToAction(err) };
  }
}

export async function deleteProperty(id: string): Promise<ActionResult<null>> {
  await requireUser('/admin/properties');
  try {
    const api = getServerApi({ cache: 'no-store' });
    await api.delete(`/properties/${id}`);
    revalidateAll();
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: apiErrorToAction(err) };
  }
}

/**
 * Variante que redirige tras el delete. Se usa desde la página de edición:
 * si volvemos al listado con redirect dentro de la action, no podemos
 * mostrar errores en la misma vista, así que el caller decide.
 */
export async function deletePropertyAndRedirect(id: string): Promise<void> {
  const r = await deleteProperty(id);
  if (!r.ok) throw new Error(r.error.message);
  redirect('/admin/properties');
}
