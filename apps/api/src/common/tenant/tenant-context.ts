import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Contexto por-request que transporta el tenant + usuario actuales.
 * Se propaga con AsyncLocalStorage para que la extensi\u00f3n Prisma pueda
 * leerlo sin tener que pasar `tenantId` expl\u00edcitamente en cada query.
 */
export interface TenantContext {
  tenantId: string;
  userId?: string;
  role?: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

/** Lee el contexto actual o lanza si no est\u00e1 seteado (uso interno). */
export function getTenantContext(): TenantContext | undefined {
  return tenantStorage.getStore();
}

/** Lee el tenantId actual o lanza si no est\u00e1 seteado. */
export function requireTenantId(): string {
  const ctx = tenantStorage.getStore();
  if (!ctx?.tenantId) {
    throw new Error('Tenant context no disponible en este punto');
  }
  return ctx.tenantId;
}
