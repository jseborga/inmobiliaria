import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantOnlyGuard } from '../../common/guards/tenant-only.guard';
import type { AuthenticatedTenantUser } from '../auth/types';
import { AIService } from './ai.service';
import { GeneratePropertyDescriptionDto } from './dto/generate-description.dto';
import { PropertyDescriptionService } from './property-description.service';

/**
 * Endpoints de IA para tenant users. Toda mutación que usa LLM debería pasar
 * por acá para centralizar logging, rate limiting (futuro) y selección de
 * provider/modelo.
 */
@Controller('ai')
@UseGuards(TenantOnlyGuard)
export class AIController {
  constructor(
    private readonly ai: AIService,
    private readonly descriptions: PropertyDescriptionService,
  ) {}

  /** Diagnóstico: qué providers están cargados y cuál es el default. */
  @Get('providers')
  status() {
    return {
      default: this.ai.defaultProvider(),
      available: this.ai.availableProviders(),
    };
  }

  /**
   * Genera una descripción comercial para una propiedad existente.
   * El cliente decide si reemplaza el campo description o solo lo sugiere al agente.
   */
  @Post('properties/:id/description')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.AGENT)
  async describeProperty(
    @CurrentUser() user: AuthenticatedTenantUser,
    @Param('id') id: string,
    @Body() dto: GeneratePropertyDescriptionDto,
  ) {
    return this.descriptions.generateForProperty(user.tenantId, id, dto);
  }
}
