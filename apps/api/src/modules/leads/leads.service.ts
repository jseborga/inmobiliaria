import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LeadActivityKind,
  LeadSource,
  LeadStatus,
  Prisma,
  TenantStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateActivityDto, USER_ACTIVITY_KINDS } from './dto/create-activity.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { CreatePublicLeadDto } from './dto/create-public-lead.dto';
import { ListLeadsDto } from './dto/list-leads.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

interface PublicLeadContext {
  sourceIp?: string;
  sourceUserAgent?: string;
  sourceReferrer?: string;
}

/**
 * Lógica de CRM de leads.
 *
 * Multi-tenancy: usa `prisma.raw` porque algunas operaciones (captura pública)
 * necesitan resolver el tenantId a partir del slug o de la propiedad. Dentro
 * del scope del tenant, el service valida manualmente que todo (property,
 * assignedUser, lead, activity) pertenezca a `tenantId`.
 */
@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Captura pública (marketplace / form embebido)
  // -------------------------------------------------------------------------

  /**
   * Crea un lead desde el form público.
   * Resuelve el tenant en este orden:
   *   1. `contextTenantId` (resuelto por el middleware desde subdominio/header).
   *   2. `dto.tenantSlug`.
   *   3. `dto.propertyId` → tenant de la propiedad.
   * Si ninguno resuelve, 404.
   */
  async createPublic(
    dto: CreatePublicLeadDto,
    contextTenantId: string | undefined,
    meta: PublicLeadContext,
  ) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Debés proveer email o teléfono');
    }

    const tenantId = await this.resolvePublicTenantId(dto, contextTenantId);
    if (!tenantId) {
      throw new NotFoundException('No se pudo resolver la inmobiliaria destino');
    }

    // Si viene propertyId, validar que exista en ese tenant.
    if (dto.propertyId) {
      const prop = await this.prisma.raw.property.findFirst({
        where: { id: dto.propertyId, tenantId },
        select: { id: true },
      });
      if (!prop) {
        throw new NotFoundException('Propiedad no encontrada');
      }
    }

    const lead = await this.prisma.raw.lead.create({
      data: {
        tenantId,
        propertyId: dto.propertyId ?? null,
        source: dto.source ?? LeadSource.WEB,
        status: LeadStatus.NEW,
        firstName: dto.firstName,
        lastName: dto.lastName ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        message: dto.message ?? null,
        sourceIp: meta.sourceIp ?? null,
        sourceUserAgent: meta.sourceUserAgent ?? null,
        sourceReferrer: meta.sourceReferrer ?? null,
      },
    });

    await this.prisma.raw.leadActivity.create({
      data: {
        tenantId,
        leadId: lead.id,
        userId: null,
        kind: LeadActivityKind.CREATED,
        body: 'Lead creado desde formulario público',
        metadata: {
          source: lead.source,
          propertyId: lead.propertyId,
        } satisfies Prisma.InputJsonValue,
      },
    });

    // Respuesta mínima al público para no filtrar datos internos.
    return { id: lead.id, createdAt: lead.createdAt };
  }

  // -------------------------------------------------------------------------
  // Admin (tenant-scoped)
  // -------------------------------------------------------------------------

  async createManual(tenantId: string, userId: string, dto: CreateLeadDto) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Debés proveer email o teléfono');
    }

    if (dto.propertyId) {
      const prop = await this.prisma.raw.property.findFirst({
        where: { id: dto.propertyId, tenantId },
        select: { id: true },
      });
      if (!prop) throw new NotFoundException('Propiedad no encontrada');
    }

    if (dto.assignedUserId) {
      await this.assertUserBelongsToTenant(tenantId, dto.assignedUserId);
    }

    const lead = await this.prisma.raw.lead.create({
      data: {
        tenantId,
        propertyId: dto.propertyId ?? null,
        source: dto.source ?? LeadSource.OTHER,
        status: dto.status ?? LeadStatus.NEW,
        firstName: dto.firstName,
        lastName: dto.lastName ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        message: dto.message ?? null,
        assignedUserId: dto.assignedUserId ?? null,
      },
    });

    await this.prisma.raw.leadActivity.create({
      data: {
        tenantId,
        leadId: lead.id,
        userId,
        kind: LeadActivityKind.CREATED,
        body: 'Lead creado manualmente',
        metadata: { source: lead.source } satisfies Prisma.InputJsonValue,
      },
    });

    if (dto.assignedUserId) {
      await this.prisma.raw.leadActivity.create({
        data: {
          tenantId,
          leadId: lead.id,
          userId,
          kind: LeadActivityKind.ASSIGNMENT,
          body: null,
          metadata: {
            assignedUserId: dto.assignedUserId,
          } satisfies Prisma.InputJsonValue,
        },
      });
    }

    return this.findById(tenantId, lead.id);
  }

  async list(tenantId: string, currentUserId: string, filters: ListLeadsDto) {
    const where: Prisma.LeadWhereInput = { tenantId };

    if (filters.status) where.status = filters.status;
    if (filters.source) where.source = filters.source;
    if (filters.propertyId) where.propertyId = filters.propertyId;
    if (filters.assignedUserId) {
      where.assignedUserId =
        filters.assignedUserId === 'me' ? currentUserId : filters.assignedUserId;
    }
    if (filters.q) {
      const q = filters.q.trim();
      if (q.length > 0) {
        where.OR = [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
          { message: { contains: q, mode: 'insensitive' } },
        ];
      }
    }

    const take = Math.min(Math.max(filters.take ?? 20, 1), 100);
    const skip = Math.max(filters.skip ?? 0, 0);

    const [items, total] = await Promise.all([
      this.prisma.raw.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: {
          property: { select: { id: true, slug: true, title: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.raw.lead.count({ where }),
    ]);

    return { items, total, take, skip };
  }

  async findById(tenantId: string, leadId: string) {
    const lead = await this.prisma.raw.lead.findFirst({
      where: { id: leadId, tenantId },
      include: {
        property: { select: { id: true, slug: true, title: true } },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        activities: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!lead) throw new NotFoundException('Lead no encontrado');
    return lead;
  }

  async update(
    tenantId: string,
    currentUserId: string,
    leadId: string,
    dto: UpdateLeadDto,
  ) {
    const existing = await this.prisma.raw.lead.findFirst({
      where: { id: leadId, tenantId },
    });
    if (!existing) throw new NotFoundException('Lead no encontrado');

    // Validar assignedUserId si viene (string no vacío).
    if (dto.assignedUserId !== undefined && dto.assignedUserId !== null) {
      await this.assertUserBelongsToTenant(tenantId, dto.assignedUserId);
    }

    const data: Prisma.LeadUpdateInput = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.message !== undefined) data.message = dto.message;
    if (dto.source !== undefined) data.source = dto.source;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.assignedUserId !== undefined) {
      data.assignedTo =
        dto.assignedUserId === null
          ? { disconnect: true }
          : { connect: { id: dto.assignedUserId } };
    }

    const updated = await this.prisma.raw.lead.update({
      where: { id: leadId },
      data,
    });

    // Emitir actividades automáticas por cambios relevantes.
    const systemActivities: Prisma.LeadActivityCreateManyInput[] = [];

    if (dto.status !== undefined && dto.status !== existing.status) {
      systemActivities.push({
        tenantId,
        leadId,
        userId: currentUserId,
        kind: LeadActivityKind.STATUS_CHANGE,
        body: null,
        metadata: { from: existing.status, to: dto.status },
      });
    }

    if (
      dto.assignedUserId !== undefined &&
      (dto.assignedUserId ?? null) !== existing.assignedUserId
    ) {
      systemActivities.push({
        tenantId,
        leadId,
        userId: currentUserId,
        kind: LeadActivityKind.ASSIGNMENT,
        body: null,
        metadata: {
          from: existing.assignedUserId,
          to: dto.assignedUserId ?? null,
        },
      });
    }

    if (systemActivities.length > 0) {
      await this.prisma.raw.leadActivity.createMany({ data: systemActivities });
    }

    return this.findById(tenantId, updated.id);
  }

  async remove(tenantId: string, leadId: string): Promise<void> {
    const existing = await this.prisma.raw.lead.findFirst({
      where: { id: leadId, tenantId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Lead no encontrado');

    await this.prisma.raw.lead.delete({ where: { id: leadId } });
  }

  // -------------------------------------------------------------------------
  // Actividades
  // -------------------------------------------------------------------------

  async addActivity(
    tenantId: string,
    currentUserId: string,
    leadId: string,
    dto: CreateActivityDto,
  ) {
    if (!USER_ACTIVITY_KINDS.includes(dto.kind)) {
      throw new ForbiddenException(
        `El kind "${dto.kind}" solo se genera automáticamente`,
      );
    }

    const lead = await this.prisma.raw.lead.findFirst({
      where: { id: leadId, tenantId },
      select: { id: true },
    });
    if (!lead) throw new NotFoundException('Lead no encontrado');

    const activity = await this.prisma.raw.leadActivity.create({
      data: {
        tenantId,
        leadId,
        userId: currentUserId,
        kind: dto.kind,
        body: dto.body ?? null,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Marcamos lastContactedAt para los kinds que son contacto real.
    const contactKinds: LeadActivityKind[] = [
      LeadActivityKind.CALL,
      LeadActivityKind.EMAIL,
      LeadActivityKind.WHATSAPP,
      LeadActivityKind.MEETING,
    ];
    if (contactKinds.includes(dto.kind)) {
      await this.prisma.raw.lead.update({
        where: { id: leadId },
        data: { lastContactedAt: new Date() },
      });
    }

    return activity;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async resolvePublicTenantId(
    dto: CreatePublicLeadDto,
    contextTenantId: string | undefined,
  ): Promise<string | null> {
    if (contextTenantId) return contextTenantId;

    if (dto.tenantSlug) {
      const t = await this.prisma.raw.tenant.findUnique({
        where: { slug: dto.tenantSlug.toLowerCase() },
        select: { id: true, status: true },
      });
      if (t && t.status === TenantStatus.ACTIVE) return t.id;
    }

    if (dto.propertyId) {
      const prop = await this.prisma.raw.property.findUnique({
        where: { id: dto.propertyId },
        select: { tenantId: true, tenant: { select: { status: true } } },
      });
      if (prop && prop.tenant.status === TenantStatus.ACTIVE) return prop.tenantId;
    }

    return null;
  }

  private async assertUserBelongsToTenant(tenantId: string, userId: string) {
    const u = await this.prisma.raw.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true, status: true },
    });
    if (!u) throw new NotFoundException('Usuario asignado no encontrado en el tenant');
    if (u.status !== 'ACTIVE') {
      throw new BadRequestException('No se puede asignar a un usuario deshabilitado');
    }
  }
}
