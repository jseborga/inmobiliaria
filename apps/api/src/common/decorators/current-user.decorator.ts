import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedSubject } from '../../modules/auth/types';

/**
 * Inyecta el sujeto autenticado (tenant user o platform admin) en el handler.
 *
 * Tipado: el parámetro del handler declara el subtipo esperado
 * (AuthenticatedTenantUser | AuthenticatedPlatformAdmin). Es responsabilidad
 * del controller proteger la ruta con TenantOnlyGuard / PlatformOnlyGuard
 * para garantizar ese narrowing en runtime.
 */
export const CurrentUser = createParamDecorator<unknown, ExecutionContext, AuthenticatedSubject>(
  (_data, ctx) => {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!req.user) {
      throw new Error('CurrentUser usado en una ruta sin JwtAuthGuard');
    }
    return req.user as unknown as AuthenticatedSubject;
  },
);
