import type { UserRole } from '@prisma/client';

/**
 * Todos los access tokens llevan `kind` para distinguir el tipo de sujeto.
 * - TENANT: usuario de una inmobiliaria (OWNER/ADMIN/AGENT)
 * - PLATFORM: super-admin de plataforma (global, sin tenant)
 */
export type SubjectKind = 'TENANT' | 'PLATFORM';

export interface TenantJwtPayload {
  kind: 'TENANT';
  sub: string; // userId
  tenantId: string;
  role: UserRole;
  email: string;
}

export interface PlatformJwtPayload {
  kind: 'PLATFORM';
  sub: string; // platformAdminId
  email: string;
}

export type JwtAccessPayload = TenantJwtPayload | PlatformJwtPayload;

/** Usuario de tenant autenticado (req.user tras JwtAuthGuard + TenantOnlyGuard). */
export interface AuthenticatedTenantUser {
  kind: 'TENANT';
  sub: string;
  tenantId: string;
  role: UserRole;
  email: string;
}

/** Platform admin autenticado (req.user tras JwtAuthGuard + PlatformOnlyGuard). */
export interface AuthenticatedPlatformAdmin {
  kind: 'PLATFORM';
  sub: string;
  email: string;
}

export type AuthenticatedSubject = AuthenticatedTenantUser | AuthenticatedPlatformAdmin;

/**
 * Compat: muchos controllers esperaban `AuthenticatedUser` (solo tenant).
 * Mantenemos el alias apuntando al tipo estricto para no romper imports.
 */
export type AuthenticatedUser = AuthenticatedTenantUser;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    /**
     * Passport declara `Express.User` como interface vacía. Para que `req.user`
     * sea tipado como unión discriminada, extendemos la interface con los
     * campos comunes y los específicos como opcionales. En runtime, los guards
     * (TenantOnlyGuard / PlatformOnlyGuard) garantizan el subtipo correcto.
     */
    interface User {
      kind: SubjectKind;
      sub: string;
      email: string;
      tenantId?: string;
      role?: UserRole;
    }

    interface Request {
      tenant?: {
        id: string;
        slug: string;
        name: string;
      };
    }
  }
}

export {};
