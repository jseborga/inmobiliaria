import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TenantPlan, TenantStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { hashPassword } from '../auth/hash.util';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class PlatformTenantsService {
  private readonly logger = new Logger(PlatformTenantsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createTenantWithOwner(dto: CreateTenantDto) {
    const passwordHash = await hashPassword(dto.ownerPassword);

    try {
      const result = await this.prisma.raw.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            slug: dto.slug.toLowerCase(),
            name: dto.name,
            plan: dto.plan ?? TenantPlan.FREE,
            phone: dto.phone,
            email: dto.contactEmail,
            address: dto.address,
            city: dto.city,
          },
        });

        const owner = await tx.user.create({
          data: {
            tenantId: tenant.id,
            email: dto.ownerEmail.toLowerCase(),
            passwordHash,
            firstName: dto.ownerFirstName,
            lastName: dto.ownerLastName,
            role: 'OWNER',
          },
        });

        return { tenant, owner };
      });

      this.logger.log(
        `Tenant creado: ${result.tenant.slug} (${result.tenant.id}) con OWNER ${result.owner.email}`,
      );

      return {
        tenant: this.tenantToDto(result.tenant),
        owner: {
          id: result.owner.id,
          email: result.owner.email,
          firstName: result.owner.firstName,
          lastName: result.owner.lastName,
          role: result.owner.role,
        },
      };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = (err.meta?.target as string[] | undefined)?.join(',') ?? 'campo único';
        throw new ConflictException(`Ya existe un registro con ese valor (${target})`);
      }
      throw err;
    }
  }

  async listTenants(params: { take?: number; skip?: number } = {}) {
    const take = Math.min(Math.max(params.take ?? 50, 1), 200);
    const skip = Math.max(params.skip ?? 0, 0);

    const [items, total] = await Promise.all([
      this.prisma.raw.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        select: {
          id: true,
          slug: true,
          name: true,
          plan: true,
          status: true,
          city: true,
          createdAt: true,
          _count: { select: { users: true } },
        },
      }),
      this.prisma.raw.tenant.count(),
    ]);

    return { items, total, take, skip };
  }

  async getTenantDetail(id: string) {
    const tenant = await this.prisma.raw.tenant.findUnique({
      where: { id },
      include: {
        users: {
          orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            status: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
        _count: { select: { users: true, properties: true, leads: true } },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');
    return {
      ...this.tenantToDto(tenant),
      address: tenant.address,
      phone: tenant.phone,
      contactEmail: tenant.email,
      counts: {
        users: tenant._count.users,
        properties: tenant._count.properties,
        leads: tenant._count.leads,
      },
      users: tenant.users,
    };
  }

  async updateTenant(id: string, dto: UpdateTenantDto) {
    await this.assertExists(id);
    try {
      const updated = await this.prisma.raw.tenant.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.plan !== undefined ? { plan: dto.plan } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.contactEmail !== undefined ? { email: dto.contactEmail } : {}),
          ...(dto.address !== undefined ? { address: dto.address } : {}),
          ...(dto.city !== undefined ? { city: dto.city } : {}),
        },
      });
      this.logger.log(`Tenant actualizado: ${updated.slug} (${updated.id})`);
      return this.tenantToDto(updated);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Conflicto al actualizar (campo único duplicado)');
      }
      throw err;
    }
  }

  async setTenantStatus(id: string, status: TenantStatus) {
    await this.assertExists(id);
    const updated = await this.prisma.raw.tenant.update({
      where: { id },
      data: { status },
    });
    this.logger.log(`Tenant ${updated.slug} → status=${status}`);
    return this.tenantToDto(updated);
  }

  /**
   * Borra el tenant y TODO lo asociado (users, properties, leads, etc.)
   * por cascade del schema. Operación destructiva irrecuperable —
   * la confirmación es responsabilidad del cliente.
   */
  async deleteTenant(id: string) {
    await this.assertExists(id);
    await this.prisma.raw.tenant.delete({ where: { id } });
    this.logger.warn(`Tenant ${id} eliminado (cascade)`);
  }

  /**
   * Resetea el password de un user del tenant. Útil cuando el OWNER
   * pierde acceso. Se valida que el user pertenezca al tenant indicado
   * para evitar manipulación cross-tenant.
   */
  async resetUserPassword(tenantId: string, userId: string, newPassword: string) {
    const user = await this.prisma.raw.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, tenantId: true },
    });
    if (!user || user.tenantId !== tenantId) {
      throw new NotFoundException('Usuario no encontrado en este tenant');
    }
    const passwordHash = await hashPassword(newPassword);
    await this.prisma.raw.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    // Revocamos refresh tokens del user para forzar re-login en otros devices.
    await this.prisma.raw.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.logger.log(`Password reseteada para user ${user.email} (tenant=${tenantId})`);
    return { ok: true };
  }

  private async assertExists(id: string) {
    const found = await this.prisma.raw.tenant.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Tenant no encontrado');
  }

  private tenantToDto<
    T extends {
      id: string;
      slug: string;
      name: string;
      plan: TenantPlan;
      status: TenantStatus;
      city: string | null;
      createdAt: Date;
    },
  >(t: T) {
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      plan: t.plan,
      status: t.status,
      city: t.city,
      createdAt: t.createdAt,
    };
  }
}
