import { InternalServerErrorException, Logger } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { decryptKey } from '../../common/crypto/key-cipher';
import { AIUsageService } from './ai-usage.service';

const SINGLETON_ID = 'singleton';
const DEFAULT_PROVIDER = 'openai';
const DEFAULT_MODEL = 'text-embedding-3-small';

interface PlatformEmbeddingsConfig {
  provider: string;
  model: string;
  apiKey: string;
}

interface OpenAIEmbeddingsResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage: { prompt_tokens: number; total_tokens: number };
}

/**
 * Genera embeddings (vectores semánticos) para texto. Usado por:
 *   - PropertyIndexerService (al crear/editar propiedad)
 *   - Búsqueda semántica en publicList (al recibir ?q=)
 *
 * Decisión: las keys de embeddings vienen SIEMPRE del PlatformAISettings
 * (no del tenant). Razón: las propiedades indexadas y las queries de
 * búsqueda DEBEN usar el mismo modelo/provider, sino los vectores no son
 * comparables. Centralizar evita inconsistencias.
 *
 * El costo de embeddings se trackea en AIUsage con feature=EMBEDDINGS pero
 * NO billable (lo asume la plataforma).
 */
@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: AIUsageService,
  ) {}

  /**
   * True si la plataforma tiene config válida para embeddings. La búsqueda
   * semántica chequea esto antes de intentar generar query embedding —
   * cuando es false, cae a búsqueda keyword normal.
   */
  async isReady(): Promise<boolean> {
    try {
      await this.getPlatformConfig();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Genera el vector embedding para un texto. Devuelve null si la plataforma
   * no tiene embeddings configurados (caller debe hacer fallback).
   */
  async embed(text: string, opts?: { tenantId?: string; feature?: 'EMBEDDINGS' }): Promise<{
    vector: number[];
    model: string;
  } | null> {
    let cfg: PlatformEmbeddingsConfig;
    try {
      cfg = await this.getPlatformConfig();
    } catch (err) {
      this.logger.warn(`Embeddings no disponibles: ${(err as Error).message}`);
      return null;
    }

    const cleaned = text.trim().slice(0, 8000); // safety cap
    if (!cleaned) return null;

    if (cfg.provider !== 'openai') {
      throw new InternalServerErrorException(
        `Provider de embeddings no soportado: ${cfg.provider}. Solo openai por ahora.`,
      );
    }

    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: cfg.model, input: cleaned }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      throw new InternalServerErrorException(
        `Embeddings API error: ${body?.error?.message ?? res.status}`,
      );
    }

    const body = (await res.json()) as OpenAIEmbeddingsResponse;
    const vector = body.data[0]?.embedding;
    if (!vector || vector.length === 0) {
      throw new InternalServerErrorException('Embeddings API devolvió vector vacío');
    }

    if (opts?.tenantId) {
      void this.usage.record({
        tenantId: opts.tenantId,
        feature: 'EMBEDDINGS',
        provider: cfg.provider,
        model: body.model,
        inputTokens: body.usage.total_tokens,
        outputTokens: 0,
        billable: false, // embeddings los asume la plataforma
      });
    }

    return { vector, model: body.model };
  }

  // -------------------------------------------------------------------------

  private async getPlatformConfig(): Promise<PlatformEmbeddingsConfig> {
    const row = await this.prisma.raw.platformAISettings.findUnique({
      where: { id: SINGLETON_ID },
    });
    if (!row?.embeddingsKeyEnc) {
      throw new Error(
        'Platform embeddings no configurados (falta key en /platform-admin/ai-settings).',
      );
    }
    const apiKey = decryptKey(row.embeddingsKeyEnc);
    if (!apiKey) throw new Error('No se pudo desencriptar la key de embeddings');
    return {
      provider: row.embeddingsProvider ?? DEFAULT_PROVIDER,
      model: row.embeddingsModel ?? DEFAULT_MODEL,
      apiKey,
    };
  }
}
