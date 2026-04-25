import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { TenantOnlyGuard } from '../../common/guards/tenant-only.guard';
import { AuthService, type AuthResult } from './auth.service';
import { LoginDto } from './dto/login.dto';
import type { AuthenticatedTenantUser } from './types';

const REFRESH_COOKIE = 'refresh_token';

/**
 * Auth de usuarios de tenant (OWNER/ADMIN/AGENT).
 * No hay registro público; los tenants y su OWNER se crean desde
 * POST /platform-admin/tenants (requiere sesión de super-admin).
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto, this.meta(req));
    this.setRefreshCookie(res, result);
    return this.sanitize(result);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException('Falta refresh token');
    const result = await this.auth.refresh(token, this.meta(req));
    this.setRefreshCookie(res, result);
    return this.sanitize(result);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    await this.auth.logout(token);
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  @UseGuards(TenantOnlyGuard)
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedTenantUser) {
    return this.auth.getMe(user.sub, user.tenantId);
  }

  private setRefreshCookie(res: Response, result: AuthResult): void {
    const maxAge = result.tokens.refreshTokenExpiresAt.getTime() - Date.now();
    res.cookie(REFRESH_COOKIE, result.tokens.refreshToken, {
      ...this.cookieOptions(),
      maxAge,
    });
  }

  private cookieOptions() {
    // `Secure` solo si estamos en prod Y no se pidió override.
    // `COOKIE_INSECURE=1` desactiva Secure para deploys atípicos sin TLS
    // (ver README, Fase 7.0). Bajar NODE_ENV a 'development' tendría
    // efectos colaterales no deseados.
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    const cookieInsecure = this.config.get<string>('COOKIE_INSECURE') === '1';
    return {
      httpOnly: true,
      secure: isProd && !cookieInsecure,
      sameSite: 'strict' as const,
      path: '/api/auth',
    };
  }

  private sanitize(result: AuthResult) {
    const { refreshToken: _rt, refreshTokenExpiresAt: _rtExp, ...tokens } = result.tokens;
    void _rt;
    void _rtExp;
    return { user: result.user, tenant: result.tenant, tokens };
  }

  private meta(req: Request): { userAgent?: string; ip?: string } {
    return {
      userAgent: req.header('user-agent') ?? undefined,
      ip: req.ip,
    };
  }
}
