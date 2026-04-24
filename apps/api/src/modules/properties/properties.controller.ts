import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantOnlyGuard } from '../../common/guards/tenant-only.guard';
import type { AuthenticatedTenantUser } from '../auth/types';
import { CreatePropertyDto } from './dto/create-property.dto';
import { ListPropertiesDto } from './dto/list-properties.dto';
import { ConfirmImageDto, PresignImageDto } from './dto/presign-image.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertiesService } from './properties.service';

/**
 * CRUD administrativo de propiedades.
 * Todas las rutas requieren sesión de tenant user.
 * OWNER y ADMIN pueden crear/editar/borrar; AGENT puede crear y editar.
 */
@Controller('properties')
@UseGuards(TenantOnlyGuard)
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedTenantUser, @Query() q: ListPropertiesDto) {
    return this.properties.listForTenant(user.tenantId, q);
  }

  @Get(':id')
  async detail(@CurrentUser() user: AuthenticatedTenantUser, @Param('id') id: string) {
    return this.properties.findByIdForTenant(user.tenantId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.AGENT)
  async create(
    @CurrentUser() user: AuthenticatedTenantUser,
    @Body() dto: CreatePropertyDto,
  ) {
    return this.properties.create(user.tenantId, user.sub, dto);
  }

  @Put(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.AGENT)
  async update(
    @CurrentUser() user: AuthenticatedTenantUser,
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
  ) {
    return this.properties.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async remove(@CurrentUser() user: AuthenticatedTenantUser, @Param('id') id: string) {
    await this.properties.remove(user.tenantId, id);
  }

  // --- Imágenes ---

  @Post(':id/images/presign')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.AGENT)
  async presignImage(
    @CurrentUser() user: AuthenticatedTenantUser,
    @Param('id') id: string,
    @Body() dto: PresignImageDto,
  ) {
    return this.properties.presignImageUpload(
      user.tenantId,
      id,
      dto.contentType,
      dto.contentLength,
    );
  }

  @Post(':id/images')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.AGENT)
  async confirmImage(
    @CurrentUser() user: AuthenticatedTenantUser,
    @Param('id') id: string,
    @Body() dto: ConfirmImageDto,
  ) {
    return this.properties.confirmImage(user.tenantId, id, dto);
  }

  @Delete(':id/images/:imageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.AGENT)
  async deleteImage(
    @CurrentUser() user: AuthenticatedTenantUser,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    await this.properties.deleteImage(user.tenantId, id, imageId);
  }
}
