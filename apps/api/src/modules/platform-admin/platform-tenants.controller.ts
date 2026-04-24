import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PlatformOnlyGuard } from '../../common/guards/platform-only.guard';
import { CreateTenantDto } from './dto/create-tenant.dto';
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
}
