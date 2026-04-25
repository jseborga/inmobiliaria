import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger as PinoLogger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { initSentry } from './common/observability/sentry';

// Sentry debe inicializarse ANTES de que Nest cree la app para que
// patchee fetch/http globales y capture errores tempranos.
const sentryEnabled = initSentry();

async function bootstrap() {
  // bufferLogs=true para que mensajes durante el bootstrap se acumulen y
  // recién emitan cuando Pino está listo (vía `app.useLogger`).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(PinoLogger));

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3001);
  const apiPrefix = config.get<string>('API_PREFIX', 'api');
  const corsOrigins = config
    .get<string>('CORS_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Necesario para que req.ip refleje la IP real detr\u00e1s de Nginx en prod.
  app.set('trust proxy', 1);

  app.setGlobalPrefix(apiPrefix);
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(port);
  Logger.log(
    `API escuchando en http://localhost:${port}/${apiPrefix} ` +
      `(sentry=${sentryEnabled ? 'on' : 'off'})`,
    'Bootstrap',
  );
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Error iniciando la API:', err);
  process.exit(1);
});
