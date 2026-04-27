import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantOnlyGuard } from '../../common/guards/tenant-only.guard';
import type { AuthenticatedTenantUser } from '../auth/types';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from './telegram.service';

class UpdateTelegramIntegrationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  botToken?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @MinLength(1)
  botUsername?: string | null;

  @IsOptional()
  @IsBoolean()
  testMode?: boolean;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

@Controller('tenants/current/telegram')
@UseGuards(TenantOnlyGuard)
export class TelegramAdminController {
  constructor(private readonly telegram: TelegramService) {}

  @Get('integration')
  async get(@CurrentUser() user: AuthenticatedTenantUser) {
    return this.telegram.getIntegration(user.tenantId);
  }

  @Patch('integration')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async update(
    @CurrentUser() user: AuthenticatedTenantUser,
    @Body() dto: UpdateTelegramIntegrationDto,
  ) {
    return this.telegram.updateIntegration(user.tenantId, dto);
  }

  /** Lista de usuarios del tenant con su estado de vinculación de Telegram. */
  @Get('users')
  async listUsers(@CurrentUser() user: AuthenticatedTenantUser) {
    return this.telegram.listUsersForTenant(user.tenantId);
  }

  /** Desvincula el chat de un usuario (admin). */
  @Post('users/:id/unlink')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async unlinkUser(
    @CurrentUser() user: AuthenticatedTenantUser,
    @Param('id') userId: string,
  ) {
    return this.telegram.unlinkUser(user.tenantId, userId);
  }
}

/**
 * Webhook entrante del bot Telegram. Configurar en Telegram con:
 *   POST https://api.telegram.org/bot{token}/setWebhook
 *   con url = {API_PUBLIC_URL}/webhooks/telegram/{tenantSlug}
 *
 * Telegram NO valida secret por defecto, pero acepta `secret_token` en el
 * setWebhook que después llega como header `X-Telegram-Bot-Api-Secret-Token`.
 * Acá lo recibimos opcionalmente; si la integración tiene token configurado
 * (vía botUsername), el webhook se autentifica por estar en su URL única
 * por tenant.
 */
@Controller('webhooks/telegram')
@Public()
export class TelegramWebhookController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
  ) {}

  @Post(':tenantSlug')
  @HttpCode(HttpStatus.OK)
  async receive(
    @Param('tenantSlug') tenantSlug: string,
    @Body() payload: unknown,
  ) {
    const tenant = await this.prisma.raw.tenant.findUnique({
      where: { slug: tenantSlug.toLowerCase() },
      include: { telegram: true },
    });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');
    if (!tenant.telegram?.enabled) {
      throw new ForbiddenException('Integración Telegram deshabilitada');
    }
    return this.telegram.handleWebhook(tenant.id, payload);
  }
}
