import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'node:crypto';
import type { PresignedUpload, PresignRequest } from './storage.types';

const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const PRESIGN_TTL_SECONDS = 60 * 5; // 5 min

/**
 * Servicio de storage.
 *
 * En prod se firma directamente contra Cloudflare R2 (S3-compatible). En dev,
 * si no hay credenciales R2 configuradas, caemos a un mock local que:
 *   - acepta el PUT en el propio servicio (ver MockStorageController)
 *   - guarda el archivo en disco bajo `storage/uploads/`
 *   - sirve la URL pública vía la API
 *
 * Esto permite probar el flow end-to-end sin depender de R2.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: 'r2' | 'mock';
  private readonly s3?: S3Client;
  private readonly bucket?: string;
  private readonly publicBase?: string;
  private readonly mockBaseUrl: string;

  constructor(@Optional() @Inject(ConfigService) private readonly config?: ConfigService) {
    const accountId = this.config?.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.config?.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.config?.get<string>('R2_SECRET_ACCESS_KEY');
    const bucket = this.config?.get<string>('R2_BUCKET');
    const publicBase = this.config?.get<string>('R2_PUBLIC_URL');

    if (accountId && accessKeyId && secretAccessKey && bucket && publicBase) {
      this.driver = 'r2';
      this.bucket = bucket;
      this.publicBase = publicBase.replace(/\/$/, '');
      this.s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.logger.log(`StorageService en modo R2 (bucket=${bucket})`);
    } else {
      this.driver = 'mock';
      this.logger.warn('StorageService en modo mock (R2 no configurado)');
    }

    const port = this.config?.get<number>('PORT', 3001) ?? 3001;
    const prefix = this.config?.get<string>('API_PREFIX', 'api') ?? 'api';
    this.mockBaseUrl = `http://localhost:${port}/${prefix}`;
  }

  isMock(): boolean {
    return this.driver === 'mock';
  }

  /** Valida los parámetros de subida y rechaza todo lo que no sea imagen razonable. */
  private validate(req: PresignRequest): void {
    if (!ALLOWED_CONTENT_TYPES.has(req.contentType)) {
      throw new InternalServerErrorException(
        `Content-Type no soportado: ${req.contentType}`,
      );
    }
    if (!Number.isFinite(req.contentLength) || req.contentLength <= 0) {
      throw new InternalServerErrorException('contentLength inválido');
    }
    if (req.contentLength > MAX_BYTES) {
      throw new InternalServerErrorException(
        `Archivo demasiado grande (max ${MAX_BYTES} bytes)`,
      );
    }
  }

  private buildKey(req: PresignRequest): string {
    const ext = req.contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';
    const rand = randomBytes(8).toString('hex');
    return `tenants/${req.tenantId}/properties/${req.propertyId}/${Date.now()}-${rand}.${ext}`;
  }

  async presignUpload(req: PresignRequest): Promise<PresignedUpload> {
    this.validate(req);
    const r2Key = this.buildKey(req);

    if (this.driver === 'r2') {
      const cmd = new PutObjectCommand({
        Bucket: this.bucket!,
        Key: r2Key,
        ContentType: req.contentType,
        ContentLength: req.contentLength,
      });
      const uploadUrl = await getSignedUrl(this.s3!, cmd, { expiresIn: PRESIGN_TTL_SECONDS });
      return {
        uploadUrl,
        method: 'PUT',
        headers: {
          'Content-Type': req.contentType,
          'Content-Length': String(req.contentLength),
        },
        expiresIn: PRESIGN_TTL_SECONDS,
        r2Key,
        publicUrl: `${this.publicBase}/${r2Key}`,
      };
    }

    // Mock: el cliente hace PUT contra la propia API. Controller debajo recibe.
    const encoded = encodeURIComponent(r2Key);
    return {
      uploadUrl: `${this.mockBaseUrl}/_mock-storage/${encoded}`,
      method: 'PUT',
      headers: {
        'Content-Type': req.contentType,
      },
      expiresIn: PRESIGN_TTL_SECONDS,
      r2Key,
      publicUrl: `${this.mockBaseUrl}/_mock-storage/${encoded}`,
    };
  }

  /** Borra un objeto. En mock es no-op para mantener simplicidad. */
  async deleteObject(r2Key: string): Promise<void> {
    if (this.driver !== 'r2') return;
    await this.s3!.send(new DeleteObjectCommand({ Bucket: this.bucket!, Key: r2Key }));
  }
}
