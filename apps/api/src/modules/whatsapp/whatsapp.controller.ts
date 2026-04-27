import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantOnlyGuard } from '../../common/guards/tenant-only.guard';
import type { AuthenticatedTenantUser } from '../auth/types';
import { UpdateWhatsappIntegrationDto } from './dto/update-whatsapp-integration.dto';
import { WhatsappService } from './whatsapp.service';

/**
 * Configuración de la integración WhatsApp (Evolution API) para el tenant.
 * Solo OWNER/ADMIN pueden modificar; cualquier usuario del tenant puede leer.
 *
 * Endpoint de "test send": útil para QA — manda un mensaje al número que
 * elijas y devuelve si Evolution lo aceptó.
 */
@Controller('tenants/current/whatsapp')
@UseGuards(TenantOnlyGuard)
export class WhatsappController {
  constructor(private readonly whatsapp: WhatsappService) {}

  @Get('integration')
  async get(@CurrentUser() user: AuthenticatedTenantUser) {
    return this.whatsapp.getIntegration(user.tenantId);
  }

  @Patch('integration')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async update(
    @CurrentUser() user: AuthenticatedTenantUser,
    @Body() dto: UpdateWhatsappIntegrationDto,
  ) {
    return this.whatsapp.updateIntegration(user.tenantId, dto);
  }

  @Post('integration/test-send')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async testSend(
    @CurrentUser() user: AuthenticatedTenantUser,
    @Body() body: { phone: string; text?: string },
  ) {
    return this.whatsapp.send({
      tenantId: user.tenantId,
      phone: body.phone,
      text:
        body.text ??
        '🧪 Mensaje de prueba desde el panel admin. Si lo recibís, la integración está OK.',
    });
  }
}
