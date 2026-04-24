import {
  BadRequestException,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { existsSync, createReadStream, mkdirSync } from 'node:fs';
import { writeFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { Public } from '../../common/decorators/public.decorator';
import { StorageService } from './storage.service';

/**
 * Controlador del mock de R2 para desarrollo local.
 * Acepta PUT con el body crudo y luego sirve GET del mismo key.
 * La key llega URL-encoded porque contiene slashes.
 *
 * NO se monta en producción: solo si StorageService está en modo mock.
 * El guard manual en `ensureMock()` lo fuerza.
 */
const STORAGE_ROOT = resolve(process.cwd(), 'storage', 'uploads');

@Controller('_mock-storage')
export class MockStorageController {
  constructor(private readonly storage: StorageService) {
    mkdirSync(STORAGE_ROOT, { recursive: true });
  }

  private ensureMock(): void {
    if (!this.storage.isMock()) {
      throw new NotFoundException();
    }
  }

  private resolveSafe(encodedKey: string): string {
    const key = decodeURIComponent(encodedKey);
    const target = normalize(join(STORAGE_ROOT, key));
    // Evita path traversal: el archivo resuelto debe seguir bajo STORAGE_ROOT.
    if (!target.startsWith(STORAGE_ROOT + '/')) {
      throw new BadRequestException('Key inválida');
    }
    return target;
  }

  @Public()
  @Put(':key')
  @HttpCode(HttpStatus.OK)
  async put(
    @Param('key') key: string,
    @Req() req: Request,
    @Res({ passthrough: true }) _res: Response,
  ): Promise<{ ok: true; key: string; bytes: number }> {
    this.ensureMock();
    const target = this.resolveSafe(key);
    mkdirSync(resolve(target, '..'), { recursive: true });

    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    const buf = Buffer.concat(chunks);
    await writeFile(target, buf);
    return { ok: true, key: decodeURIComponent(key), bytes: buf.length };
  }

  @Public()
  @Get(':key')
  @Header('Cache-Control', 'public, max-age=3600')
  async get(@Param('key') key: string, @Res() res: Response): Promise<void> {
    this.ensureMock();
    const target = this.resolveSafe(key);
    if (!existsSync(target)) {
      throw new NotFoundException();
    }
    const info = await stat(target);
    const ext = extname(target).toLowerCase();
    const mime =
      ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.png'
          ? 'image/png'
          : ext === '.webp'
            ? 'image/webp'
            : ext === '.avif'
              ? 'image/avif'
              : 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', info.size);
    createReadStream(target).pipe(res);
  }
}
