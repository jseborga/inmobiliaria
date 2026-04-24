import { Prisma } from '@prisma/client';
import { getTenantContext } from '../common/tenant/tenant-context';

/**
 * Modelos cuyas operaciones deben filtrarse/inyectar `tenantId` autom\u00e1ticamente.
 * `Tenant` se excluye (es el pivote). `RefreshToken` se maneja expl\u00edcitamente
 * en el servicio de auth porque algunas operaciones ocurren antes de tener
 * un contexto de tenant consolidado.
 */
const TENANT_SCOPED_MODELS = new Set<string>(['User']);

function shouldScope(model: string | undefined): boolean {
  return !!model && TENANT_SCOPED_MODELS.has(model);
}

/**
 * Extensi\u00f3n Prisma que:
 *   - Inyecta `tenantId` en `create` / `createMany` si no viene.
 *   - Agrega `where.tenantId` en `find*`, `update*`, `delete*`, `count`, `aggregate`.
 *
 * La protecci\u00f3n final contra IDOR sigue siendo responsabilidad del controller
 * (validar que el recurso consultado pertenece al tenant del JWT). Esta extensi\u00f3n
 * es defensa en profundidad: garantiza que nadie se olvide de filtrar.
 */
export function tenantScopedExtension() {
  return Prisma.defineExtension((client) =>
    client.$extends({
      name: 'tenant-scoped',
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (!shouldScope(model)) {
              return query(args);
            }

            const ctx = getTenantContext();
            const tenantId = ctx?.tenantId;

            // Sin contexto de tenant, pasar la query tal cual (ej. operaciones de
            // bootstrap o tests); el caller es responsable de filtrar.
            if (!tenantId) {
              return query(args);
            }

            const a = (args ?? {}) as Record<string, unknown>;

            switch (operation) {
              case 'findUnique':
              case 'findUniqueOrThrow':
              case 'findFirst':
              case 'findFirstOrThrow':
              case 'findMany':
              case 'count':
              case 'aggregate':
              case 'groupBy':
              case 'updateMany':
              case 'deleteMany': {
                a.where = { ...((a.where as object) ?? {}), tenantId };
                break;
              }
              case 'update':
              case 'delete': {
                // Para update/delete con `where` por id \u00fanico, a\u00f1adimos el filtro
                // como AND adicional para evitar cross-tenant.
                a.where = { ...((a.where as object) ?? {}), tenantId };
                break;
              }
              case 'upsert': {
                a.where = { ...((a.where as object) ?? {}), tenantId };
                a.create = { ...((a.create as object) ?? {}), tenantId };
                break;
              }
              case 'create': {
                a.data = { ...((a.data as object) ?? {}), tenantId };
                break;
              }
              case 'createMany': {
                const data = a.data;
                if (Array.isArray(data)) {
                  a.data = data.map((row) => ({ ...(row as object), tenantId }));
                } else if (data && typeof data === 'object') {
                  a.data = { ...(data as object), tenantId };
                }
                break;
              }
              default:
                break;
            }

            return query(a);
          },
        },
      },
    }),
  );
}
