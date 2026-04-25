'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import type { PropertyImageDto } from '@inmobiliaria/shared';
import { ApiError } from '@/lib/api';
import { getServerApi } from '@/lib/api/server';
import { requireUser } from '@/lib/auth/session';
import type { ActionError, ActionResult } from './properties';

/**
 * Server actions para imágenes de propiedades.
 *
 * Flow del upload (3 pasos):
 *   1. Cliente llama `presignPropertyImage()` con el contentType+size
 *   2. Cliente hace `fetch(uploadUrl, {method:'PUT', body:file, headers})`
 *      directamente al storage (R2 o mock). El access token NO viaja al
 *      storage — la firma presigned ya autoriza la subida.
 *   3. Cliente llama `confirmPropertyImage()` con `r2Key + publicUrl` para
 *      persistir en DB.
 *
 * Decisión: usamos server actions en vez de un proxy `/api/admin/...` para
 * que el access token nunca salga del server. El cliente solo conoce el
 * uploadUrl efímero (5 min de TTL), nunca el bearer.
 */

export interface PresignResult {
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresIn: number;
  r2Key: string;
  publicUrl: string;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_BYTES = 10 * 1024 * 1024;

function apiErrorTo(err: unknown): ActionError {
  if (err instanceof ApiError) {
    const body = err.body as { message?: string | string[] } | null;
    const msg = Array.isArray(body?.message)
      ? body!.message.join(', ')
      : body?.message ?? err.displayMessage;
    return { message: msg };
  }
  return { message: 'Error inesperado' };
}

export async function presignPropertyImage(
  propertyId: string,
  contentType: string,
  contentLength: number,
): Promise<ActionResult<PresignResult>> {
  await requireUser();

  if (!ALLOWED_TYPES.includes(contentType)) {
    return {
      ok: false,
      error: { message: `Tipo no soportado. Usa: ${ALLOWED_TYPES.join(', ')}` },
    };
  }
  if (!Number.isFinite(contentLength) || contentLength <= 0 || contentLength > MAX_BYTES) {
    return {
      ok: false,
      error: { message: `Tamaño inválido. Máximo ${MAX_BYTES / 1024 / 1024} MB` },
    };
  }

  try {
    const api = getServerApi({ cache: 'no-store' });
    const presign = await api.post<PresignResult>(
      `/properties/${propertyId}/images/presign`,
      { contentType, contentLength },
    );
    return { ok: true, data: presign };
  } catch (err) {
    return { ok: false, error: apiErrorTo(err) };
  }
}

export async function confirmPropertyImage(
  propertyId: string,
  payload: {
    r2Key: string;
    publicUrl: string;
    order?: number;
    width?: number;
    height?: number;
  },
): Promise<ActionResult<PropertyImageDto>> {
  await requireUser();
  try {
    const api = getServerApi({ cache: 'no-store' });
    const img = await api.post<PropertyImageDto>(
      `/properties/${propertyId}/images`,
      payload,
    );
    revalidatePath(`/admin/properties/${propertyId}/edit`);
    revalidateTag('public-properties');
    return { ok: true, data: img };
  } catch (err) {
    return { ok: false, error: apiErrorTo(err) };
  }
}

export async function deletePropertyImage(
  propertyId: string,
  imageId: string,
): Promise<ActionResult<null>> {
  await requireUser();
  try {
    const api = getServerApi({ cache: 'no-store' });
    await api.delete(`/properties/${propertyId}/images/${imageId}`);
    revalidatePath(`/admin/properties/${propertyId}/edit`);
    revalidateTag('public-properties');
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: apiErrorTo(err) };
  }
}
