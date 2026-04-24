import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Tenant, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import {
  generateRefreshToken,
  hashRefreshToken,
  verifyPassword,
} from './hash.util';
import type { TenantJwtPayload } from './types';

export interface AuthTokens {
  accessToken: string;
  accessTokenExpiresIn: number; // segundos
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface AuthResult {
  user: Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'role'> & { tenantId: string };
  tenant: Pick<Tenant, 'id' | 'slug' | 'name'>;
  tokens: AuthTokens;
}

/**
 * Auth de usuarios de tenant (OWNER/ADMIN/AGENT).
 * El alta de tenants y de su usuario OWNER se hace exclusivamente desde
 * el m\u00f3dulo platform-admin (no hay registro p\u00fablico).
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly refreshTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.refreshTtlMs = parseDurationMs(this.config.get<string>('JWT_REFRESH_TTL', '7d'));
  }

  async login(dto: LoginDto, meta: { userAgent?: string; ip?: string }): Promise<AuthResult> {
    const tenant = await this.prisma.raw.tenant.findUnique({
      where: { slug: dto.tenantSlug },
    });
    if (!tenant || tenant.status !== 'ACTIVE') {
      throw new UnauthorizedException('Credenciales inv\u00e1lidas');
    }

    const user = await this.prisma.raw.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: dto.email.toLowerCase() } },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Credenciales inv\u00e1lidas');
    }

    const ok = await verifyPassword(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciales inv\u00e1lidas');
    }

    await this.prisma.raw.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokens(user, tenant, meta);
    return this.buildResult(user, tenant, tokens);
  }

  /**
   * Valida el refresh token, lo rota (revoca el anterior, emite uno nuevo)
   * y devuelve un nuevo par de tokens.
   */
  async refresh(
    rawToken: string,
    meta: { userAgent?: string; ip?: string },
  ): Promise<AuthResult> {
    const tokenHash = hashRefreshToken(rawToken);
    const stored = await this.prisma.raw.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true, tenant: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inv\u00e1lido');
    }
    if (stored.user.status !== 'ACTIVE' || stored.tenant.status !== 'ACTIVE') {
      throw new UnauthorizedException('Cuenta deshabilitada');
    }

    await this.prisma.raw.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokens(stored.user, stored.tenant, meta);
    return this.buildResult(stored.user, stored.tenant, tokens);
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const tokenHash = hashRefreshToken(rawToken);
    await this.prisma.raw.refreshToken
      .updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch((err) => {
        this.logger.warn(`Fallo al revocar refresh token: ${(err as Error).message}`);
      });
  }

  async getMe(userId: string, tenantId: string) {
    const user = await this.prisma.raw.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        tenant: { select: { id: true, slug: true, name: true } },
      },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  private async issueTokens(
    user: User,
    tenant: Tenant,
    meta: { userAgent?: string; ip?: string },
  ): Promise<AuthTokens> {
    const payload: TenantJwtPayload = {
      kind: 'TENANT',
      sub: user.id,
      tenantId: tenant.id,
      role: user.role,
      email: user.email,
    };
    const accessTtl = this.config.get<string>('JWT_ACCESS_TTL', '15m');
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: accessTtl });
    const accessTokenExpiresIn = Math.floor(parseDurationMs(accessTtl) / 1000);

    const refreshToken = generateRefreshToken();
    const refreshTokenExpiresAt = new Date(Date.now() + this.refreshTtlMs);
    await this.prisma.raw.refreshToken.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: refreshTokenExpiresAt,
        userAgent: meta.userAgent?.slice(0, 255),
        ip: meta.ip,
      },
    });

    return { accessToken, accessTokenExpiresIn, refreshToken, refreshTokenExpiresAt };
  }

  private buildResult(user: User, tenant: Tenant, tokens: AuthTokens): AuthResult {
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: tenant.id,
      },
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
      tokens,
    };
  }
}

/** Convierte "15m", "7d", "30s" a milisegundos. */
function parseDurationMs(input: string): number {
  const match = /^(\d+)([smhd])$/.exec(input.trim());
  if (!match) throw new Error(`Duraci\u00f3n inv\u00e1lida: ${input}`);
  const value = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  return value * multiplier;
}
