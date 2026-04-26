import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  PropertyStatus as PropertyStatusEnum,
  Currency as CurrencyEnum,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { ListPropertiesDto } from './dto/list-properties.dto';
import { ConfirmImageDto } from './dto/presign-image.dto';
import { randomSuffix, slugify } from './slug.util';

/**
 * Lógica de Properties.
 *
 * Multi-tenancy: las queries pasan por `prisma.client` (extensión que inyecta
 * `tenantId`). Las operaciones explícitas con `prisma.raw` ocurren solo:
 *   - cuando necesitamos SQL raw por PostGIS (búsqueda geoespacial).
 *   - cuando necesitamos leer el tenantId desde fuera del contexto (ej. search
 *     público del marketplace global, que cruza tenants).
 */
@Injectable()
export class PropertiesService {
  private readonly logger = new Logger(PropertiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // -------------------------------------------------------------------------
  // Admin (tenant-scoped)
  // -------------------------------------------------------------------------

  async create(tenantId: string, userId: string, dto: CreatePropertyDto) {
    const slug = await this.resolveSlug(tenantId, dto.slug, dto.title);
    const status = dto.status ?? PropertyStatusEnum.DRAFT;
    const now = new Date();

    try {
      return await this.prisma.raw.property.create({
        data: {
          tenantId,
          slug,
          title: dto.title,
          description: dto.description ?? null,
          operation: dto.operation,
          type: dto.type,
          status,
          price: new Prisma.Decimal(dto.price),
          currency: dto.currency ?? CurrencyEnum.BOB,
          areaSqm: dto.areaSqm !== undefined ? new Prisma.Decimal(dto.areaSqm) : null,
          bedrooms: dto.bedrooms ?? null,
          bathrooms: dto.bathrooms ?? null,
          parkingSpaces: dto.parkingSpaces ?? null,
          city: dto.city ?? null,
          zone: dto.zone ?? null,
          address: dto.address ?? null,
          latitude: dto.latitude !== undefined ? new Prisma.Decimal(dto.latitude) : null,
          longitude: dto.longitude !== undefined ? new Prisma.Decimal(dto.longitude) : null,
          videoUrl: dto.videoUrl ?? null,
          tour360Url: dto.tour360Url ?? null,
          createdById: userId,
          publishedAt: status === PropertyStatusEnum.PUBLISHED ? now : null,
          archivedAt: status === PropertyStatusEnum.ARCHIVED ? now : null,
        },
        include: { images: { orderBy: { order: 'asc' } } },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`Ya existe una propiedad con slug "${slug}"`);
      }
      throw err;
    }
  }

  async update(tenantId: string, id: string, dto: UpdatePropertyDto) {
    const existing = await this.prisma.raw.property.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Propiedad no encontrada');

    // Transición de status → setear timestamps derivados.
    let publishedAt = existing.publishedAt;
    let archivedAt = existing.archivedAt;
    if (dto.status && dto.status !== existing.status) {
      const now = new Date();
      if (dto.status === PropertyStatusEnum.PUBLISHED && !publishedAt) publishedAt = now;
      if (dto.status === PropertyStatusEnum.ARCHIVED) archivedAt = now;
      if (dto.status === PropertyStatusEnum.DRAFT) archivedAt = null;
    }

    let newSlug: string | undefined;
    if (dto.slug && dto.slug !== existing.slug) {
      newSlug = await this.resolveSlug(tenantId, dto.slug, existing.title, id);
    }

    const data: Prisma.PropertyUpdateInput = {
      ...(newSlug ? { slug: newSlug } : {}),
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.operation !== undefined ? { operation: dto.operation } : {}),
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.price !== undefined ? { price: new Prisma.Decimal(dto.price) } : {}),
      ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
      ...(dto.areaSqm !== undefined
        ? { areaSqm: dto.areaSqm === null ? null : new Prisma.Decimal(dto.areaSqm) }
        : {}),
      ...(dto.bedrooms !== undefined ? { bedrooms: dto.bedrooms } : {}),
      ...(dto.bathrooms !== undefined ? { bathrooms: dto.bathrooms } : {}),
      ...(dto.parkingSpaces !== undefined ? { parkingSpaces: dto.parkingSpaces } : {}),
      ...(dto.city !== undefined ? { city: dto.city } : {}),
      ...(dto.zone !== undefined ? { zone: dto.zone } : {}),
      ...(dto.address !== undefined ? { address: dto.address } : {}),
      ...(dto.latitude !== undefined
        ? { latitude: dto.latitude === null ? null : new Prisma.Decimal(dto.latitude) }
        : {}),
      ...(dto.longitude !== undefined
        ? { longitude: dto.longitude === null ? null : new Prisma.Decimal(dto.longitude) }
        : {}),
      ...(dto.videoUrl !== undefined ? { videoUrl: dto.videoUrl || null } : {}),
      ...(dto.tour360Url !== undefined ? { tour360Url: dto.tour360Url || null } : {}),
      publishedAt,
      archivedAt,
    };

    try {
      return await this.prisma.raw.property.update({
        where: { id },
        data,
        include: { images: { orderBy: { order: 'asc' } } },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Conflicto de slug en este tenant');
      }
      throw err;
    }
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const existing = await this.prisma.raw.property.findFirst({
      where: { id, tenantId },
      include: { images: true },
    });
    if (!existing) throw new NotFoundException('Propiedad no encontrada');

    // Intentar borrar imágenes del storage (best-effort).
    for (const img of existing.images) {
      try {
        await this.storage.deleteObject(img.r2Key);
      } catch (err) {
        this.logger.warn(
          `No se pudo borrar objeto R2 ${img.r2Key}: ${(err as Error).message}`,
        );
      }
    }

    await this.prisma.raw.property.delete({ where: { id } });
  }

  async findByIdForTenant(tenantId: string, id: string) {
    const p = await this.prisma.raw.property.findFirst({
      where: { id, tenantId },
      include: { images: { orderBy: { order: 'asc' } } },
    });
    if (!p) throw new NotFoundException('Propiedad no encontrada');
    return p;
  }

  async listForTenant(tenantId: string, filters: ListPropertiesDto) {
    const { where, take, skip } = this.buildFilters(tenantId, filters, /*publicOnly*/ false);

    // Si no hay filtro geoespacial, usamos Prisma normal.
    if (!this.hasGeo(filters)) {
      const [items, total] = await Promise.all([
        this.prisma.raw.property.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }],
          take,
          skip,
          include: { images: { orderBy: { order: 'asc' }, take: 1 } },
        }),
        this.prisma.raw.property.count({ where }),
      ]);
      return { items, total, take, skip };
    }

    return this.geoSearch({ tenantId, filters, publicOnly: false });
  }

  // -------------------------------------------------------------------------
  // Público (marketplace)
  // -------------------------------------------------------------------------

  /**
   * Listado público global (marketplace). No requiere auth, no requiere tenant.
   * Siempre filtra status=PUBLISHED. Si el request trae `X-Tenant-Slug` o
   * subdominio, se filtra además por ese tenant (sitio por inmobiliaria).
   */
  async publicList(filters: ListPropertiesDto, tenantIdOptional?: string) {
    const tenantId = tenantIdOptional ?? null;
    const { where, take, skip } = this.buildFilters(tenantId, filters, /*publicOnly*/ true);

    if (!this.hasGeo(filters)) {
      const [items, total] = await Promise.all([
        this.prisma.raw.property.findMany({
          where,
          orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
          take,
          skip,
          include: {
            images: { orderBy: { order: 'asc' }, take: 1 },
            tenant: { select: { id: true, slug: true, name: true, logoUrl: true } },
          },
        }),
        this.prisma.raw.property.count({ where }),
      ]);
      return { items, total, take, skip };
    }

    return this.geoSearch({ tenantId: tenantIdOptional, filters, publicOnly: true });
  }

  /** Detalle público por slug, requiere saber el tenant (subdominio o slug). */
  async publicDetailBySlug(tenantId: string, slug: string) {
    const p = await this.prisma.raw.property.findFirst({
      where: { tenantId, slug, status: PropertyStatusEnum.PUBLISHED },
      include: {
        images: { orderBy: { order: 'asc' } },
        tenant: { select: { id: true, slug: true, name: true, logoUrl: true, phone: true, email: true } },
      },
    });
    if (!p) throw new NotFoundException('Propiedad no encontrada');
    return p;
  }

  // -------------------------------------------------------------------------
  // Imágenes
  // -------------------------------------------------------------------------

  async presignImageUpload(
    tenantId: string,
    propertyId: string,
    contentType: string,
    contentLength: number,
  ) {
    const property = await this.prisma.raw.property.findFirst({
      where: { id: propertyId, tenantId },
      select: { id: true },
    });
    if (!property) throw new NotFoundException('Propiedad no encontrada');

    return this.storage.presignUpload({
      tenantId,
      propertyId: property.id,
      contentType,
      contentLength,
    });
  }

  async confirmImage(tenantId: string, propertyId: string, dto: ConfirmImageDto) {
    const property = await this.prisma.raw.property.findFirst({
      where: { id: propertyId, tenantId },
      select: { id: true },
    });
    if (!property) throw new NotFoundException('Propiedad no encontrada');

    // Validar que la r2Key corresponda al tenant+property (defensa contra cross-tenant).
    const expectedPrefix = `tenants/${tenantId}/properties/${propertyId}/`;
    if (!dto.r2Key.startsWith(expectedPrefix)) {
      throw new ForbiddenException('r2Key no pertenece a esta propiedad');
    }

    try {
      return await this.prisma.raw.propertyImage.create({
        data: {
          tenantId,
          propertyId,
          r2Key: dto.r2Key,
          publicUrl: dto.publicUrl,
          order: dto.order ?? 0,
          width: dto.width ?? null,
          height: dto.height ?? null,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Esa imagen ya fue registrada');
      }
      throw err;
    }
  }

  async deleteImage(tenantId: string, propertyId: string, imageId: string) {
    const img = await this.prisma.raw.propertyImage.findFirst({
      where: { id: imageId, propertyId, tenantId },
    });
    if (!img) throw new NotFoundException('Imagen no encontrada');

    try {
      await this.storage.deleteObject(img.r2Key);
    } catch (err) {
      this.logger.warn(`No se pudo borrar objeto R2: ${(err as Error).message}`);
    }

    await this.prisma.raw.propertyImage.delete({ where: { id: img.id } });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private hasGeo(f: ListPropertiesDto): boolean {
    return f.nearLat !== undefined && f.nearLng !== undefined && f.radiusKm !== undefined;
  }

  private buildFilters(
    tenantId: string | null,
    f: ListPropertiesDto,
    publicOnly: boolean,
  ): { where: Prisma.PropertyWhereInput; take: number; skip: number } {
    const where: Prisma.PropertyWhereInput = {};
    if (tenantId) where.tenantId = tenantId;

    if (publicOnly) {
      where.status = PropertyStatusEnum.PUBLISHED;
    } else if (f.status) {
      where.status = f.status;
    }

    if (f.operation) where.operation = f.operation;
    if (f.type) where.type = f.type;
    if (f.currency) where.currency = f.currency;
    if (f.city) where.city = { equals: f.city, mode: 'insensitive' };
    if (f.zone) where.zone = { equals: f.zone, mode: 'insensitive' };
    if (f.bedrooms !== undefined) where.bedrooms = { gte: f.bedrooms };
    if (f.bathrooms !== undefined) where.bathrooms = { gte: f.bathrooms };

    if (f.minPrice !== undefined || f.maxPrice !== undefined) {
      where.price = {
        ...(f.minPrice !== undefined ? { gte: new Prisma.Decimal(f.minPrice) } : {}),
        ...(f.maxPrice !== undefined ? { lte: new Prisma.Decimal(f.maxPrice) } : {}),
      };
    }

    if (f.q) {
      const q = f.q.trim();
      if (q.length > 0) {
        where.OR = [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { city: { contains: q, mode: 'insensitive' } },
          { zone: { contains: q, mode: 'insensitive' } },
        ];
      }
    }

    const take = Math.min(Math.max(f.take ?? 20, 1), 100);
    const skip = Math.max(f.skip ?? 0, 0);
    return { where, take, skip };
  }

  /**
   * Búsqueda geoespacial vía SQL raw (PostGIS ST_DWithin).
   * Devuelve el mismo shape que Prisma normal + `distanceMeters`.
   * Nota: los filtros adicionales se aplican en SQL para consistencia.
   */
  private async geoSearch(opts: {
    tenantId?: string | null;
    filters: ListPropertiesDto;
    publicOnly: boolean;
  }) {
    const { tenantId, filters: f, publicOnly } = opts;

    if (f.nearLat === undefined || f.nearLng === undefined || f.radiusKm === undefined) {
      throw new BadRequestException('Faltan nearLat/nearLng/radiusKm');
    }

    const take = Math.min(Math.max(f.take ?? 20, 1), 100);
    const skip = Math.max(f.skip ?? 0, 0);
    const radiusMeters = f.radiusKm * 1000;

    // Construimos WHERE dinámico con parámetros numerados para evitar SQL injection.
    const conditions: Prisma.Sql[] = [
      Prisma.sql`ST_DWithin(p.location, ST_SetSRID(ST_MakePoint(${f.nearLng}::float8, ${f.nearLat}::float8), 4326)::geography, ${radiusMeters}::float8)`,
      Prisma.sql`p.location IS NOT NULL`,
    ];

    if (tenantId) conditions.push(Prisma.sql`p.tenant_id = ${tenantId}`);
    if (publicOnly) conditions.push(Prisma.sql`p.status = 'PUBLISHED'`);
    else if (f.status) conditions.push(Prisma.sql`p.status = ${f.status}::text::"PropertyStatus"`);

    if (f.operation) conditions.push(Prisma.sql`p.operation = ${f.operation}::text::"PropertyOperation"`);
    if (f.type) conditions.push(Prisma.sql`p.type = ${f.type}::text::"PropertyType"`);
    if (f.currency) conditions.push(Prisma.sql`p.currency = ${f.currency}::text::"Currency"`);
    if (f.city) conditions.push(Prisma.sql`LOWER(p.city) = LOWER(${f.city})`);
    if (f.zone) conditions.push(Prisma.sql`LOWER(p.zone) = LOWER(${f.zone})`);
    if (f.bedrooms !== undefined) conditions.push(Prisma.sql`p.bedrooms >= ${f.bedrooms}`);
    if (f.bathrooms !== undefined) conditions.push(Prisma.sql`p.bathrooms >= ${f.bathrooms}`);
    if (f.minPrice !== undefined) conditions.push(Prisma.sql`p.price >= ${f.minPrice}`);
    if (f.maxPrice !== undefined) conditions.push(Prisma.sql`p.price <= ${f.maxPrice}`);

    const whereSql = Prisma.sql`${Prisma.join(conditions, ' AND ')}`;

    const rows = await this.prisma.raw.$queryRaw<
      Array<{
        id: string;
        tenant_id: string;
        slug: string;
        title: string;
        description: string | null;
        operation: string;
        type: string;
        status: string;
        price: string;
        currency: string;
        area_sqm: string | null;
        bedrooms: number | null;
        bathrooms: number | null;
        parking_spaces: number | null;
        city: string | null;
        zone: string | null;
        address: string | null;
        latitude: string | null;
        longitude: string | null;
        published_at: Date | null;
        created_at: Date;
        distance_meters: number;
      }>
    >(Prisma.sql`
      SELECT
        p.id, p.tenant_id, p.slug, p.title, p.description,
        p.operation::text AS operation, p.type::text AS type, p.status::text AS status,
        p.price::text AS price, p.currency::text AS currency,
        p.area_sqm::text AS area_sqm, p.bedrooms, p.bathrooms, p.parking_spaces,
        p.city, p.zone, p.address,
        p.latitude::text AS latitude, p.longitude::text AS longitude,
        p.published_at, p.created_at,
        ST_Distance(
          p.location,
          ST_SetSRID(ST_MakePoint(${f.nearLng}::float8, ${f.nearLat}::float8), 4326)::geography
        ) AS distance_meters
      FROM properties p
      WHERE ${whereSql}
      ORDER BY distance_meters ASC
      LIMIT ${take} OFFSET ${skip}
    `);

    const totalRes = await this.prisma.raw.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count FROM properties p WHERE ${whereSql}
    `);
    const total = Number(totalRes[0]?.count ?? 0);

    const ids = rows.map((r) => r.id);
    const images = ids.length
      ? await this.prisma.raw.propertyImage.findMany({
          where: { propertyId: { in: ids } },
          orderBy: { order: 'asc' },
        })
      : [];
    const byProperty = new Map<string, typeof images>();
    for (const img of images) {
      const arr = byProperty.get(img.propertyId) ?? [];
      arr.push(img);
      byProperty.set(img.propertyId, arr);
    }

    const items = rows.map((r) => ({
      id: r.id,
      tenantId: r.tenant_id,
      slug: r.slug,
      title: r.title,
      description: r.description,
      operation: r.operation,
      type: r.type,
      status: r.status,
      price: r.price,
      currency: r.currency,
      areaSqm: r.area_sqm,
      bedrooms: r.bedrooms,
      bathrooms: r.bathrooms,
      parkingSpaces: r.parking_spaces,
      city: r.city,
      zone: r.zone,
      address: r.address,
      latitude: r.latitude,
      longitude: r.longitude,
      publishedAt: r.published_at,
      createdAt: r.created_at,
      distanceMeters: Math.round(Number(r.distance_meters)),
      images: (byProperty.get(r.id) ?? []).slice(0, 1),
    }));

    return { items, total, take, skip };
  }

  /**
   * Resuelve el slug definitivo: si viene en dto, lo normaliza; si no, lo
   * genera a partir del título. Si colisiona dentro del tenant, agrega sufijo
   * aleatorio hasta encontrar uno libre.
   */
  private async resolveSlug(
    tenantId: string,
    raw: string | undefined,
    title: string,
    excludeId?: string,
  ): Promise<string> {
    const base = raw ? slugify(raw) : slugify(title);
    if (!base) throw new BadRequestException('Título inválido para generar slug');

    let candidate = base;
    for (let i = 0; i < 5; i++) {
      const clash = await this.prisma.raw.property.findFirst({
        where: { tenantId, slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
        select: { id: true },
      });
      if (!clash) return candidate;
      candidate = `${base}-${randomSuffix(2)}`;
    }
    throw new ConflictException('No se pudo generar un slug único');
  }
}
