import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantOnlyGuard } from '../../common/guards/tenant-only.guard';
import type { AuthenticatedTenantUser } from '../auth/types';
import { ChatService } from './chat.service';

@Controller('chat')
@UseGuards(TenantOnlyGuard)
export class AdminChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('sessions')
  async listSessions(
    @CurrentUser() user: AuthenticatedTenantUser,
    @Query('take') takeRaw?: string,
  ) {
    const take = takeRaw ? Number(takeRaw) : undefined;
    return this.chat.listSessions(user.tenantId, { take });
  }

  @Get('sessions/:id/messages')
  async listMessages(
    @CurrentUser() user: AuthenticatedTenantUser,
    @Param('id') id: string,
  ) {
    return this.chat.listMessages(user.tenantId, id);
  }

  @Post('whatsapp/send')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.AGENT)
  async sendManual(
    @CurrentUser() user: AuthenticatedTenantUser,
    @Body() body: { phone: string; text: string },
  ) {
    return this.chat.sendManual({
      tenantId: user.tenantId,
      phone: body.phone,
      text: body.text,
    });
  }
}
