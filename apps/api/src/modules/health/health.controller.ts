import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

interface HealthResponse {
  status: 'ok' | 'degraded';
  uptime: number;
  db: 'up' | 'down';
  storage: 'r2' | 'mock';
  release?: string;
  env?: string;
  timestamp: string;
}

/**
 * Healthcheck público.
 *
 * Devuelve 200 si la app está viva, 503 si la DB no responde — los
 * orquestadores (Easypanel/Caddy/Docker) usan ese código para saber si
 * tienen que reiniciar el contenedor o sacar el endpoint del pool.
 *
 * Incluye `release` (commit hash inyectado en el Dockerfile) cuando
 * existe, para correlacionar con Sentry y deploys.
 */
@Controller('health')
@Public()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthResponse> {
    let db: 'up' | 'down' = 'down';
    try {
      await this.prisma.raw.$queryRaw`SELECT 1`;
      db = 'up';
    } catch {
      db = 'down';
    }

    const status: 'ok' | 'degraded' = db === 'up' ? 'ok' : 'degraded';

    if (status !== 'ok') {
      // 503 Service Unavailable — orquestadores deben reintentar o reiniciar.
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      status,
      uptime: process.uptime(),
      db,
      storage: this.storage.driverName(),
      ...(process.env.GIT_SHA ? { release: process.env.GIT_SHA } : {}),
      ...(process.env.NODE_ENV ? { env: process.env.NODE_ENV } : {}),
      timestamp: new Date().toISOString(),
    };
  }
}
