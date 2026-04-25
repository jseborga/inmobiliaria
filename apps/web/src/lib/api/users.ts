import 'server-only';

import type { UserSummary } from '@inmobiliaria/shared';
import { ApiError } from './errors';
import { getServerApi } from './server';

/**
 * Lista los usuarios ACTIVE del tenant para selectores de asignación.
 * Devuelve [] si la API falla (no es bloqueante: el form puede mostrar
 * "sin asignar" igual).
 */
export async function fetchTenantUsers(): Promise<UserSummary[]> {
  try {
    const api = getServerApi({ cache: 'no-store' });
    return await api.get<UserSummary[]>('/tenants/users');
  } catch (err) {
    if (err instanceof ApiError) return [];
    throw err;
  }
}
