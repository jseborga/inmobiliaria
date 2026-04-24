import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Solo permite pasar a platform admins (kind='PLATFORM').
 * Usar despu\u00e9s del JwtAuthGuard global.
 */
@Injectable()
export class PlatformOnlyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!req.user) throw new ForbiddenException('No autenticado');
    if (req.user.kind !== 'PLATFORM') {
      throw new ForbiddenException('Requiere sesi\u00f3n de platform admin');
    }
    return true;
  }
}
