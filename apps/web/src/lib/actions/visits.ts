'use server';

import { revalidatePath } from 'next/cache';
import type {
  PaginatedResponse,
  VisitDetail,
  VisitListItem,
  VisitStatus,
} from '@inmobiliaria/shared';
import { ApiError } from '@/lib/api';
import { getServerApi } from '@/lib/api/server';
import { requireUser } from '@/lib/auth/session';

export interface VisitsActionError {
  message: string;
}
export type VisitsActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: VisitsActionError };

function apiErrorTo(err: unknown): VisitsActionError {
  if (err instanceof ApiError) {
    const body = err.body as { message?: string | string[] } | null;
    const msg = Array.isArray(body?.message)
      ? body!.message.join(', ')
      : body?.message ?? err.displayMessage;
    return { message: msg };
  }
  return { message: 'Error inesperado' };
}

export interface ListVisitsFilters {
  status?: VisitStatus;
  assignedUserId?: string;
  propertyId?: string;
  from?: string;
  to?: string;
  take?: number;
  skip?: number;
}

export async function listVisits(
  filters: ListVisitsFilters = {},
): Promise<PaginatedResponse<VisitListItem>> {
  await requireUser('/admin/visits');
  const api = getServerApi({ cache: 'no-store' });
  const query: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== '') query[k] = v;
  }
  return api.get<PaginatedResponse<VisitListItem>>('/visits', { query });
}

export async function getVisit(id: string): Promise<VisitDetail> {
  await requireUser(`/admin/visits/${id}`);
  const api = getServerApi({ cache: 'no-store' });
  return api.get<VisitDetail>(`/visits/${id}`);
}

export interface UpdateVisitInput {
  status?: VisitStatus;
  scheduledAt?: string;
  durationMinutes?: number;
  assignedUserId?: string | null;
  notes?: string;
  cancelReason?: string;
}

export async function updateVisit(
  id: string,
  input: UpdateVisitInput,
): Promise<VisitsActionResult<VisitDetail>> {
  await requireUser(`/admin/visits/${id}`);
  try {
    const api = getServerApi({ cache: 'no-store' });
    const data = await api.patch<VisitDetail>(`/visits/${id}`, input);
    revalidatePath('/admin/visits');
    revalidatePath(`/admin/visits/${id}`);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: apiErrorTo(err) };
  }
}

export async function deleteVisit(id: string): Promise<VisitsActionResult<null>> {
  await requireUser(`/admin/visits/${id}`);
  try {
    const api = getServerApi({ cache: 'no-store' });
    await api.delete(`/visits/${id}`);
    revalidatePath('/admin/visits');
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: apiErrorTo(err) };
  }
}

export interface CreateAdminVisitInput {
  propertyId: string;
  visitorName: string;
  visitorPhone: string;
  visitorEmail?: string;
  scheduledAt: string;
  durationMinutes?: number;
  assignedUserId?: string;
  notes?: string;
}

export async function createAdminVisit(
  input: CreateAdminVisitInput,
): Promise<VisitsActionResult<VisitListItem>> {
  await requireUser('/admin/visits');
  try {
    const api = getServerApi({ cache: 'no-store' });
    const data = await api.post<VisitListItem>('/visits', input);
    revalidatePath('/admin/visits');
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: apiErrorTo(err) };
  }
}
