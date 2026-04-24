import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { PlatformAdmin } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  generateRefreshToken,
  hashRefreshToken,
  verifyPassword,
} from '../auth/hash.util';
import type { PlatformJwtPayload } from '../auth/types';
import { PlatformLoginDto } from './dto/platform-login.dto';

export interface PlatformAuthTokens {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface PlatformAuthResult {
  admin: Pick<PlatformAdmin, 'id' | 'email' | 'firstName' | 'lastName'>;
  tokens: PlatformAuthTokens;
}

/**
 * Auth de super-admins de plataforma (kind=PLATFORM).
 * Totalmente aislado del auth de tenants: otra tabla de usuarios
 * y otra tabla de refresh tokens.
 */
@Injectable()
export class PlatformAuthService {
  private readonly logger = new Logger(PlatformAuthService.name);
  private readonly refreshTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.refreshTtlMs = parseDurationMs(this.config.get<string>('JWT_REFRESH_TTL', '7d'));
  }

  async login(
    dto: PlatformLoginDto,
    meta: { userAgent?: string; ip?: string },
  ): Promise<PlatformAuthResult> {
    const admin = await this.prisma.raw.platformAdmin.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!admin || admin.status !== 'ACTIVE') {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const ok = await verifyPassword(dto.password, admin.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');

    await this.prisma.raw.platformAdmin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokens(admin, meta);
    return this.buildResult(admin, tokens);
  }

  async refresh(
    rawToken: string,
    meta: { userAgent?: string; ip?: string },
  ): Promise<PlatformAuthResult> {
    const tokenHash = hashRefreshToken(rawToken);
    const stored = await this.prisma.raw.platformRefreshToken.findUnique({
      where: { tokenHash },
      include: { admin: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido');
    }
    if (stored.admin.status !== 'ACTIVE') {
      throw new UnauthorizedException('Cuenta deshabilitada');
    }

    await this.prisma.raw.platformRefreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokens(stored.admin, meta);
    return this.buildResult(stored.admin, tokens);
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const tokenHash = hashRefreshToken(rawToken);
    await this.prisma.raw.platformRefreshToken
      .updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch((err) => {
        this.logger.warn(`Fallo al revocar refresh platform: ${(err as Error).message}`);
      });
  }

  async getMe(adminId: string) {
    const admin = await this.prisma.raw.platformAdmin.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        lastLoginAt: true,
      },
    });
    if (!admin) throw new NotFoundException('Admin no encontrado');
    return admin;
  }

  private async issueTokens(
    admin: PlatformAdmin,
    meta: { userAgent?: string; ip?: string },
  ): Promise<PlatformAuthTokens> {
    const payload: PlatformJwtPayload = {
      kind: 'PLATFORM',
      sub: admin.id,
      email: admin.email,
    };
    const accessTtl = this.config.get<string>('JWT_ACCESS_TTL', '15m');
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: accessTtl });
    const accessTokenExpiresIn = Math.floor(parseDurationMs(accessTtl) / 1000);

    const refreshToken = generateRefreshToken();
    const refreshTokenExpiresAt = new Date(Date.now() + this.refreshTtlMs);
    await this.prisma.raw.platformRefreshToken.create({
      data: {
        adminId: admin.id,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: refreshTokenExpiresAt,
        userAgent: meta.userAgent?.slice(0, 255),
        ip: meta.ip,
      },
    });

    return { accessToken, accessTokenExpiresIn, refreshToken, refreshTokenExpiresAt };
  }

  private buildResult(admin: PlatformAdmin, tokens: PlatformAuthTokens): PlatformAuthResult {
    return {
      admin: {
        id: admin.id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
      },
      tokens,
    };
  }
}

function parseDurationMs(input: string): number {
  const match = /^(\d+)([smhd])$/.exec(input.trim());
  if (!match) throw new Error(`Duración inválida: ${input}`);
  const value = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  return value * multiplier;
}
