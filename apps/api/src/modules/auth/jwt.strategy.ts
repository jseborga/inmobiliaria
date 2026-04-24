import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthenticatedSubject, JwtAccessPayload } from './types';

/**
 * \u00danica strategy JWT para toda la API. Devuelve una uni\u00f3n discriminada
 * por `kind`; los guards (TenantOnlyGuard / PlatformOnlyGuard) restringen
 * qu\u00e9 tipo de sujeto puede acceder a cada ruta.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtAccessPayload): Promise<AuthenticatedSubject> {
    if (payload.kind === 'TENANT') {
      return {
        kind: 'TENANT',
        sub: payload.sub,
        tenantId: payload.tenantId,
        role: payload.role,
        email: payload.email,
      };
    }
    if (payload.kind === 'PLATFORM') {
      return {
        kind: 'PLATFORM',
        sub: payload.sub,
        email: payload.email,
      };
    }
    throw new UnauthorizedException('Token inv\u00e1lido');
  }
}
