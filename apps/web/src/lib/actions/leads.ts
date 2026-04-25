'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  adminLeadCreateSchema,
  leadActivityCreateSchema,
  leadUpdateSchema,
  type AdminLeadCreateInput,
  type LeadActivityCreateInput,
  type LeadActivityDto,
  type LeadDto,
  type LeadUpdateInput,
} from '@inmobiliaria/shared';
import { ApiError } from '@/lib/api';
import { getServerApi } from '@/lib/api/server';
import { requireUser } from '@/lib/auth/session';
import type { ActionError, ActionResult } from './properties';

/**
 * Server actions para CRM de leads.
 *
 * Cada mutación revalida `/admin/leads` (lista) y, cuando aplica, el detalle
 * `/admin/leads/[id]`. Los kinds automáticos (CREATED, STATUS_CHANGE,
 * ASSIGNMENT) los emite el API como side-effect — desde acá solo enviamos
 * los kinds manuales (NOTE/CALL/EMAIL/WHATSAPP/MEETING).
 */

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
    // strings vacíos → undefined; null se conserva (semántica "borrar valor").
    if (v === '' || v === undefined) continue;
    out[k] = v;
  }
  return out as T;
}

function revalidateLead(leadId?: string): void {
  revalidatePath('/admin/leads');
  revalidatePath('/admin');
  if (leadId) revalidatePath(`/admin/leads/${leadId}`);
}

export async function createLead(
  raw: AdminLeadCreateInput,
): Promise<ActionResult<LeadDto>> {
  await requireUser('/admin/leads/new');

  const parsed = adminLeadCreateSchema.safeParse(raw);
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
    const created = await api.post<LeadDto>('/leads', sanitize(parsed.data));
    revalidateLead(created.id);
    return { ok: true, data: created };
  } catch (err) {
    return { ok: false, error: apiErrorToAction(err) };
  }
}

export async function updateLead(
  id: string,
  raw: LeadUpdateInput,
): Promise<ActionResult<LeadDto>> {
  await requireUser(`/admin/leads/${id}`);

  const parsed = leadUpdateSchema.safeParse(raw);
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
    const updated = await api.patch<LeadDto>(`/leads/${id}`, sanitize(parsed.data));
    revalidateLead(updated.id);
    return { ok: true, data: updated };
  } catch (err) {
    return { ok: false, error: apiErrorToAction(err) };
  }
}

export async function addLeadActivity(
  leadId: string,
  raw: LeadActivityCreateInput,
): Promise<ActionResult<LeadActivityDto>> {
  await requireUser(`/admin/leads/${leadId}`);

  const parsed = leadActivityCreateSchema.safeParse(raw);
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
    const activity = await api.post<LeadActivityDto>(
      `/leads/${leadId}/activities`,
      parsed.data,
    );
    revalidateLead(leadId);
    return { ok: true, data: activity };
  } catch (err) {
    return { ok: false, error: apiErrorToAction(err) };
  }
}

export async function deleteLead(id: string): Promise<ActionResult<null>> {
  await requireUser('/admin/leads');
  try {
    const api = getServerApi({ cache: 'no-store' });
    await api.delete(`/leads/${id}`);
    revalidateLead();
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: apiErrorToAction(err) };
  }
}

export async function deleteLeadAndRedirect(id: string): Promise<void> {
  const r = await deleteLead(id);
  if (!r.ok) throw new Error(r.error.message);
  redirect('/admin/leads');
}
