import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmbeddingsService } from './embeddings.service';

/**
 * Genera y persiste embeddings semánticos de propiedades para búsqueda RAG.
 *
 * El indexado es idempotente: si la propiedad ya tiene embedding y el modelo
 * configurado no cambió, no re-indexa. Para forzar reindex, pasar `force: true`.
 *
 * Uso:
 *  - Llamar `indexProperty(id)` desde properties.service.create/update cuando
 *    cambian title/description/city/zone/type/operation. Fail-safe: si falla
 *    (no hay key, API down), loguea warning pero no rompe el flujo principal.
 *  - `reindexAll()` para reindex masivo (super-admin).
 */
@Injectable()
export class PropertyIndexerService {
  private readonly logger = new Logger(PropertyIndexerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  async indexProperty(propertyId: string, opts: { force?: boolean } = {}): Promise<void> {
    const ready = await this.embeddings.isReady();
    if (!ready) {
      this.logger.debug(
        `Embeddings no listos (falta config en platform); skip index ${propertyId}`,
      );
      return;
    }

    const property = await this.prisma.raw.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        tenantId: true,
        title: true,
        description: true,
        operation: true,
        type: true,
        city: true,
        zone: true,
        embeddingModel: true,
      },
    });
    if (!property) return;

    const text = this.buildIndexText(property);
    if (!text) return;

    try {
      const result = await this.embeddings.embed(text, { tenantId: property.tenantId });
      if (!result) return;

      // Si el modelo no cambió y ya está indexado, podríamos saltear.
      // Por simplicidad, siempre actualizamos cuando vino algo del provider.
      // El cliente Prisma no soporta vector(N) — usamos $executeRaw.
      const vectorLiteral = `[${result.vector.join(',')}]`;
      await this.prisma.raw.$executeRaw(Prisma.sql`
        UPDATE "properties"
        SET "embedding" = ${vectorLiteral}::vector,
            "embedding_model" = ${result.model},
            "embedded_at" = NOW()
        WHERE "id" = ${propertyId}
      `);
      this.logger.log(`Indexada propiedad ${propertyId} (model=${result.model})`);
    } catch (err) {
      // Fail-safe: no rompemos el create/update si el reindex falla.
      this.logger.warn(
        `Fallo indexando ${propertyId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Reindex masivo. El super-admin lo dispara desde el panel cuando cambia
   * de modelo o quiere refrescar. Procesa en lotes para no bloquear.
   */
  async reindexAll(opts: { batchSize?: number; onlyMissing?: boolean } = {}): Promise<{
    total: number;
    indexed: number;
    skipped: number;
  }> {
    const ready = await this.embeddings.isReady();
    if (!ready) {
      throw new Error('Embeddings no configurados; revisá /platform-admin/ai-settings.');
    }
    const batchSize = opts.batchSize ?? 50;
    const where = opts.onlyMissing
      ? Prisma.sql`WHERE "embedding" IS NULL`
      : Prisma.sql``;

    const idsRows = await this.prisma.raw.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id FROM "properties" ${where} ORDER BY created_at DESC
    `);
    const ids = idsRows.map((r) => r.id);

    let indexed = 0;
    let skipped = 0;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      // Procesamos en serie dentro del batch para no martillar la API de embeddings.
      for (const id of batch) {
        try {
          await this.indexProperty(id, { force: true });
          indexed++;
        } catch {
          skipped++;
        }
      }
      this.logger.log(`Reindex progreso: ${i + batch.length}/${ids.length}`);
    }
    return { total: ids.length, indexed, skipped };
  }

  // -------------------------------------------------------------------------

  /**
   * Construye el texto que se va a embeber. Combina campos relevantes para
   * que la similarity capture todo: ubicación + tipo + operación + descripción.
   * El precio NO se incluye (es un filtro tradicional, no semántico).
   */
  private buildIndexText(p: {
    title: string;
    description: string | null;
    operation: string;
    type: string;
    city: string | null;
    zone: string | null;
  }): string {
    const parts: string[] = [];
    parts.push(`${p.type} en ${p.operation.toLowerCase()}`);
    if (p.title) parts.push(p.title);
    if (p.zone || p.city) parts.push([p.zone, p.city].filter(Boolean).join(', '));
    if (p.description) parts.push(p.description);
    return parts.join('. ').trim();
  }
}
