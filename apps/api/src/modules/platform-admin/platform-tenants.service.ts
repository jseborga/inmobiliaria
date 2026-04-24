import {
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Prisma, TenantPlan } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { hashPassword } from '../auth/hash.util';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Injectable()
export class PlatformTenantsService {
  private readonly logger = new Logger(PlatformTenantsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Onboarding de una inmobiliaria: crea Tenant + usuario OWNER en una transacción.
   * Slugs duplicados o email duplicado dentro del tenant recién creado → 409.
   */
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
        tenant: {
          id: result.tenant.id,
          slug: result.tenant.slug,
          name: result.tenant.name,
          plan: result.tenant.plan,
          status: result.tenant.status,
          createdAt: result.tenant.createdAt,
        },
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
}
