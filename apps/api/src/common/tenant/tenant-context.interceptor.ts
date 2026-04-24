import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { tenantStorage, type TenantContext } from './tenant-context';

/**
 * Establece el AsyncLocalStorage con el tenant/usuario actuales para que la
 * extensi\u00f3n Prisma pueda filtrar autom\u00e1ticamente. Debe correr DESPU\u00c9S de
 * la autenticaci\u00f3n, as\u00ed que se aplica a nivel controller/handler v\u00eda
 * @UseInterceptors o globalmente tras el guard.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const store: TenantContext | undefined = this.buildStore(req);

    if (!store) {
      return next.handle();
    }

    return new Observable((subscriber) => {
      tenantStorage.run(store, () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
    });
  }

  private buildStore(req: Request): TenantContext | undefined {
    const user = req.user as { sub: string; tenantId: string; role: string } | undefined;
    // Preferimos el tenantId del JWT (fuente de verdad en rutas autenticadas).
    // Para rutas p\u00fablicas sin JWT, usamos el tenant resuelto por subdominio.
    const tenantId = user?.tenantId ?? req.tenant?.id;
    if (!tenantId) return undefined;

    return {
      tenantId,
      userId: user?.sub,
      role: user?.role,
    };
  }
}
