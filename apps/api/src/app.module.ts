import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { buildLoggerConfig } from './common/observability/logger.config';
import { SentryExceptionFilter } from './common/observability/sentry.filter';
import { TenantContextInterceptor } from './common/tenant/tenant-context.interceptor';
import { TenantResolverMiddleware } from './common/tenant/tenant.middleware';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AIModule } from './modules/ai/ai.module';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { HealthModule } from './modules/health/health.module';
import { LeadsModule } from './modules/leads/leads.module';
import { PlatformAdminModule } from './modules/platform-admin/platform-admin.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { StorageModule } from './modules/storage/storage.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { VisitsModule } from './modules/visits/visits.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    LoggerModule.forRoot(buildLoggerConfig()),
    PrismaModule,
    AuthModule,
    PlatformAdminModule,
    TenantsModule,
    StorageModule,
    PropertiesModule,
    LeadsModule,
    AIModule,
    WhatsappModule,
    VisitsModule,
    ChatModule,
    TelegramModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    // Filter global: 5xx → Sentry, 4xx → contrato HTTP estándar de Nest.
    { provide: APP_FILTER, useClass: SentryExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantResolverMiddleware).forRoutes('*');
  }
}
