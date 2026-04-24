import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const user = req.user;
    if (!user) throw new ForbiddenException('No autenticado');
    // Roles solo aplica a usuarios de tenant; platform admins no tienen roles aqu\u00ed.
    if (user.kind !== 'TENANT' || !user.role) {
      throw new ForbiddenException('Requiere sesi\u00f3n de usuario de inmobiliaria');
    }
    if (!required.includes(user.role)) {
      throw new ForbiddenException('Permisos insuficientes');
    }
    return true;
  }
}
