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
import { PlatformOnlyGuard } from '../../common/guards/platform-only.guard';
import type { AuthenticatedPlatformAdmin } from '../auth/types';
import { PlatformLoginDto } from './dto/platform-login.dto';
import {
  PlatformAuthService,
  type PlatformAuthResult,
} from './platform-auth.service';

const PLATFORM_REFRESH_COOKIE = 'platform_refresh_token';

/**
 * Auth del panel de super-admin. Usa una cookie distinta a la de tenants
 * (`platform_refresh_token`) y path propio para no colisionar.
 */
@Controller('platform-admin/auth')
export class PlatformAuthController {
  constructor(
    private readonly auth: PlatformAuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: PlatformLoginDto,
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
    const token = (req.cookies as Record<string, string> | undefined)?.[PLATFORM_REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException('Falta refresh token');
    const result = await this.auth.refresh(token, this.meta(req));
    this.setRefreshCookie(res, result);
    return this.sanitize(result);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req.cookies as Record<string, string> | undefined)?.[PLATFORM_REFRESH_COOKIE];
    await this.auth.logout(token);
    res.clearCookie(PLATFORM_REFRESH_COOKIE, this.cookieOptions());
  }

  @UseGuards(PlatformOnlyGuard)
  @Get('me')
  async me(@CurrentUser() admin: AuthenticatedPlatformAdmin) {
    return this.auth.getMe(admin.sub);
  }

  private setRefreshCookie(res: Response, result: PlatformAuthResult): void {
    const maxAge = result.tokens.refreshTokenExpiresAt.getTime() - Date.now();
    res.cookie(PLATFORM_REFRESH_COOKIE, result.tokens.refreshToken, {
      ...this.cookieOptions(),
      maxAge,
    });
  }

  private cookieOptions() {
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict' as const,
      path: '/api/platform-admin/auth',
    };
  }

  private sanitize(result: PlatformAuthResult) {
    const { refreshToken: _rt, refreshTokenExpiresAt: _rtExp, ...tokens } = result.tokens;
    void _rt;
    void _rtExp;
    return { admin: result.admin, tokens };
  }

  private meta(req: Request): { userAgent?: string; ip?: string } {
    return {
      userAgent: req.header('user-agent') ?? undefined,
      ip: req.ip,
    };
  }
}
