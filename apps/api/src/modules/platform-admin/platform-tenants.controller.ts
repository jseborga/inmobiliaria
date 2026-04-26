import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PlatformOnlyGuard } from '../../common/guards/platform-only.guard';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { PlatformTenantsService } from './platform-tenants.service';

/**
 * Administración de tenants (solo super-admins).
 * Toda la ruta está protegida: JwtAuthGuard (global) + PlatformOnlyGuard.
 */
@Controller('platform-admin/tenants')
@UseGuards(PlatformOnlyGuard)
export class PlatformTenantsController {
  constructor(private readonly tenants: PlatformTenantsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateTenantDto) {
    return this.tenants.createTenantWithOwner(dto);
  }

  @Get()
  async list(
    @Query('take', new DefaultValuePipe(50), ParseIntPipe) take: number,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
  ) {
    return this.tenants.listTenants({ take, skip });
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.tenants.getTenantDetail(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenants.updateTenant(id, dto);
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  async suspend(@Param('id') id: string) {
    return this.tenants.setTenantStatus(id, 'SUSPENDED');
  }

  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  async reactivate(@Param('id') id: string) {
    return this.tenants.setTenantStatus(id, 'ACTIVE');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.tenants.deleteTenant(id);
  }

  @Post(':id/users/:userId/reset-password')
  @HttpCode(HttpStatus.OK)
  async resetUserPassword(
    @Param('id') tenantId: string,
    @Param('userId') userId: string,
    @Body() dto: ResetUserPasswordDto,
  ) {
    return this.tenants.resetUserPassword(tenantId, userId, dto.newPassword);
  }
}
