import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantOnlyGuard } from '../../common/guards/tenant-only.guard';
import type { AuthenticatedTenantUser } from '../auth/types';
import {
  CreateAdminVisitDto,
  ListVisitsDto,
  UpdateVisitDto,
} from './dto/admin-visits.dto';
import { VisitsService } from './visits.service';

/**
 * Endpoints admin para gestión de visitas. Tenant-scoped.
 * OWNER/ADMIN/AGENT pueden listar y editar; OWNER/ADMIN pueden eliminar.
 */
@Controller('visits')
@UseGuards(TenantOnlyGuard)
export class VisitsController {
  constructor(private readonly visits: VisitsService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedTenantUser,
    @Query() q: ListVisitsDto,
  ) {
    return this.visits.list(user.tenantId, q);
  }

  @Get(':id')
  async detail(@CurrentUser() user: AuthenticatedTenantUser, @Param('id') id: string) {
    return this.visits.getDetail(user.tenantId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.AGENT)
  async create(
    @CurrentUser() user: AuthenticatedTenantUser,
    @Body() dto: CreateAdminVisitDto,
  ) {
    return this.visits.createManual(user.tenantId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.AGENT)
  async update(
    @CurrentUser() user: AuthenticatedTenantUser,
    @Param('id') id: string,
    @Body() dto: UpdateVisitDto,
  ) {
    return this.visits.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async remove(@CurrentUser() user: AuthenticatedTenantUser, @Param('id') id: string) {
    await this.visits.remove(user.tenantId, id);
  }
}
