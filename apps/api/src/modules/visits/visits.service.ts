import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, VisitStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BookVisitDto,
  RequestVisitOtpDto,
  VerifyVisitOtpDto,
} from './dto/book-visit.dto';
import {
  CreateAdminVisitDto,
  ListVisitsDto,
  UpdateVisitDto,
} from './dto/admin-visits.dto';
import { PhoneOtpService, normalizePhone } from './phone-otp.service';

const MIN_LEAD_TIME_MIN = 60; // mínimo 1 hora desde ahora hasta la visita

@Injectable()
export class VisitsService {
  private readonly logger = new Logger(VisitsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: PhoneOtpService,
  ) {}

  // -------------------------------------------------------------------------
  // Público (booking flow)
  // -------------------------------------------------------------------------

  async requestOtp(dto: RequestVisitOtpDto) {
    const tenant = await this.prisma.raw.tenant.findUnique({
      where: { slug: dto.tenantSlug.toLowerCase() },
      select: { id: true, status: true, name: true },
    });
    if (!tenant || tenant.status !== 'ACTIVE') {
      throw new NotFoundException('Inmobiliaria no encontrada');
    }
    const property = await this.prisma.raw.property.findFirst({
      where: { id: dto.propertyId, tenantId: tenant.id, status: 'PUBLISHED' },
      select: { id: true, title: true },
    });
    if (!property) throw new NotFoundException('Propiedad no encontrada o no publicada');

    const result = await this.otp.requestOtp({
      phone: dto.phone,
      context: 'VISIT_BOOKING',
      tenantId: tenant.id,
      customMessage:
        `Hola! Tu código para agendar una visita a *${property.title}* con ${tenant.name} es: *${'{{CODE}}'}*\n\nVence en 10 minutos. No lo compartas con nadie.`,
    });
    // Nota: el customMessage tiene un placeholder pero phoneOtpService no
    // lo reemplaza. Es solo informativo. El mensaje real viene del template
    // default del service. Si querés template custom, mejor extender el service.
    return result;
  }

  async verifyOtp(dto: VerifyVisitOtpDto): Promise<{ verified: boolean }> {
    const verified = await this.otp.verifyOtp({
      phone: dto.phone,
      code: dto.code,
      context: 'VISIT_BOOKING',
    });
    return { verified };
  }

  async bookVisit(dto: BookVisitDto) {
    const tenant = await this.prisma.raw.tenant.findUnique({
      where: { slug: dto.tenantSlug.toLowerCase() },
      select: { id: true, status: true },
    });
    if (!tenant || tenant.status !== 'ACTIVE') {
      throw new NotFoundException('Inmobiliaria no encontrada');
    }

    const property = await this.prisma.raw.property.findFirst({
      where: { id: dto.propertyId, tenantId: tenant.id, status: 'PUBLISHED' },
      select: { id: true, createdById: true, title: true },
    });
    if (!property) throw new NotFoundException('Propiedad no encontrada o no publicada');

    // Validar OTP — el endpoint de book consume el código.
    const verified = await this.otp.verifyOtp({
      phone: dto.visitorPhone,
      code: dto.otpCode,
      context: 'VISIT_BOOKING',
    });
    if (!verified) {
      throw new ForbiddenException('Código inválido o expirado. Pedí uno nuevo.');
    }

    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Fecha/hora inválida');
    }
    const minScheduled = new Date(Date.now() + MIN_LEAD_TIME_MIN * 60_000);
    if (scheduledAt < minScheduled) {
      throw new BadRequestException(
        `La visita debe agendarse al menos ${MIN_LEAD_TIME_MIN} minutos en el futuro.`,
      );
    }

    // Asignar al createdBy de la propiedad si existe; sino al primer OWNER del tenant.
    let assignedUserId: string | null = property.createdById ?? null;
    if (!assignedUserId) {
      const owner = await this.prisma.raw.user.findFirst({
        where: { tenantId: tenant.id, role: 'OWNER', status: 'ACTIVE' },
        select: { id: true },
      });
      assignedUserId = owner?.id ?? null;
    }

    const phone = normalizePhone(dto.visitorPhone);

    const visit = await this.prisma.raw.visit.create({
      data: {
        tenantId: tenant.id,
        propertyId: property.id,
        assignedUserId,
        scheduledAt,
        durationMinutes: dto.durationMinutes ?? 30,
        status: 'REQUESTED',
        visitorName: dto.visitorName.trim(),
        visitorPhone: phone,
        visitorEmail: dto.visitorEmail?.trim() || null,
        notes: dto.notes?.trim() || null,
        phoneVerifiedAt: new Date(),
      },
    });

    // Crear lead asociado (source=PHONE pero podría ser WEB con flag visit-related).
    // Flag: source=WEB para que aparezca en el listado del marketplace junto con otros leads.
    try {
      const lead = await this.prisma.raw.lead.create({
        data: {
          tenantId: tenant.id,
          propertyId: property.id,
          firstName: dto.visitorName.split(' ')[0] ?? dto.visitorName,
          lastName: dto.visitorName.split(' ').slice(1).join(' ') || null,
          email: dto.visitorEmail?.trim() || null,
          phone,
          message:
            `Solicitud de visita para "${property.title}" el ` +
            scheduledAt.toLocaleString('es-BO') +
            (dto.notes ? `. Nota: ${dto.notes}` : ''),
          source: 'WEB',
          status: 'NEW',
          assignedUserId,
        },
      });
      await this.prisma.raw.visit.update({
        where: { id: visit.id },
        data: { leadId: lead.id },
      });
      // Actividad CREATED automática del lead (lo crea el service de leads
      // normalmente; acá lo dejamos sin actividad explícita para no acoplar).
    } catch (err) {
      this.logger.warn(`Lead asociado a visit no se creó: ${(err as Error).message}`);
    }

    return {
      id: visit.id,
      status: visit.status,
      scheduledAt: visit.scheduledAt.toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // Admin (tenant-scoped)
  // -------------------------------------------------------------------------

  async list(tenantId: string, filters: ListVisitsDto) {
    const where: Prisma.VisitWhereInput = { tenantId };
    if (filters.status) where.status = filters.status;
    if (filters.assignedUserId) where.assignedUserId = filters.assignedUserId;
    if (filters.propertyId) where.propertyId = filters.propertyId;
    if (filters.from || filters.to) {
      where.scheduledAt = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      };
    }
    const take = Math.min(Math.max(filters.take ?? 30, 1), 100);
    const skip = Math.max(filters.skip ?? 0, 0);

    const [items, total] = await Promise.all([
      this.prisma.raw.visit.findMany({
        where,
        orderBy: [{ scheduledAt: 'asc' }],
        take,
        skip,
        include: {
          property: { select: { id: true, slug: true, title: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
          lead: { select: { id: true } },
        },
      }),
      this.prisma.raw.visit.count({ where }),
    ]);
    return { items, total, take, skip };
  }

  async getDetail(tenantId: string, id: string) {
    const visit = await this.prisma.raw.visit.findFirst({
      where: { id, tenantId },
      include: {
        property: { select: { id: true, slug: true, title: true, address: true, city: true, zone: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        lead: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    if (!visit) throw new NotFoundException('Visita no encontrada');
    return visit;
  }

  async createManual(tenantId: string, dto: CreateAdminVisitDto) {
    const property = await this.prisma.raw.property.findFirst({
      where: { id: dto.propertyId, tenantId },
      select: { id: true, createdById: true },
    });
    if (!property) throw new NotFoundException('Propiedad no encontrada');

    const scheduledAt = new Date(dto.scheduledAt);
    const phone = normalizePhone(dto.visitorPhone);
    const assignedUserId =
      dto.assignedUserId ?? property.createdById ?? null;

    const visit = await this.prisma.raw.visit.create({
      data: {
        tenantId,
        propertyId: property.id,
        assignedUserId,
        scheduledAt,
        durationMinutes: dto.durationMinutes ?? 30,
        status: 'CONFIRMED', // visitas manuales nacen confirmadas
        visitorName: dto.visitorName.trim(),
        visitorPhone: phone,
        visitorEmail: dto.visitorEmail?.trim() || null,
        notes: dto.notes?.trim() || null,
        // No phoneVerifiedAt: la creó el agente, no hubo OTP.
      },
    });
    return visit;
  }

  async update(tenantId: string, id: string, dto: UpdateVisitDto) {
    const existing = await this.prisma.raw.visit.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Visita no encontrada');

    const data: Prisma.VisitUpdateInput = {};
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.scheduledAt !== undefined) data.scheduledAt = new Date(dto.scheduledAt);
    if (dto.durationMinutes !== undefined) data.durationMinutes = dto.durationMinutes;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.cancelReason !== undefined) data.cancelReason = dto.cancelReason;
    if (dto.assignedUserId !== undefined) {
      data.assignedTo = dto.assignedUserId
        ? { connect: { id: dto.assignedUserId } }
        : { disconnect: true };
    }

    return this.prisma.raw.visit.update({
      where: { id },
      data,
      include: {
        property: { select: { id: true, slug: true, title: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.raw.visit.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Visita no encontrada');
    await this.prisma.raw.visit.delete({ where: { id } });
  }
}
