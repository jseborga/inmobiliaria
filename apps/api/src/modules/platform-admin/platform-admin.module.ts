import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformTenantsController } from './platform-tenants.controller';
import { PlatformTenantsService } from './platform-tenants.service';

/**
 * Módulo de administración de plataforma (super-admins).
 * Reutiliza JwtModule/PassportModule re-exportados por AuthModule.
 */
@Module({
  imports: [AuthModule],
  controllers: [PlatformAuthController, PlatformTenantsController],
  providers: [PlatformAuthService, PlatformTenantsService],
})
export class PlatformAdminModule {}
