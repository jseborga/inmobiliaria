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
import { CreateActivityDto } from './dto/create-activity.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { ListLeadsDto } from './dto/list-leads.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsService } from './leads.service';

/**
 * CRUD administrativo del CRM de leads.
 * Todas las rutas requieren sesión de tenant user.
 * OWNER/ADMIN pueden borrar; todos los roles pueden ver, crear, editar
 * y registrar actividad.
 */
@Controller('leads')
@UseGuards(TenantOnlyGuard)
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedTenantUser,
    @Query() q: ListLeadsDto,
  ) {
    return this.leads.list(user.tenantId, user.sub, q);
  }

  @Get(':id')
  async detail(
    @CurrentUser() user: AuthenticatedTenantUser,
    @Param('id') id: string,
  ) {
    return this.leads.findById(user.tenantId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.AGENT)
  async create(
    @CurrentUser() user: AuthenticatedTenantUser,
    @Body() dto: CreateLeadDto,
  ) {
    return this.leads.createManual(user.tenantId, user.sub, dto);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.AGENT)
  async update(
    @CurrentUser() user: AuthenticatedTenantUser,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leads.update(user.tenantId, user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async remove(
    @CurrentUser() user: AuthenticatedTenantUser,
    @Param('id') id: string,
  ) {
    await this.leads.remove(user.tenantId, id);
  }

  @Post(':id/activities')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.AGENT)
  async addActivity(
    @CurrentUser() user: AuthenticatedTenantUser,
    @Param('id') id: string,
    @Body() dto: CreateActivityDto,
  ) {
    return this.leads.addActivity(user.tenantId, user.sub, id, dto);
  }
}
