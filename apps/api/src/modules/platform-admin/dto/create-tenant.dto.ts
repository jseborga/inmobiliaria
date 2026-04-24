import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TenantPlan } from '@prisma/client';

/**
 * Payload para onboarding de una nueva inmobiliaria.
 * Crea Tenant + usuario OWNER en una misma transacción.
 */
export class CreateTenantDto {
  /** Identificador URL-safe usado como subdominio. */
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  @Matches(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, {
    message: 'slug debe contener solo minúsculas, números y guiones',
  })
  slug!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsEnum(TenantPlan)
  plan?: TenantPlan;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  // --- Datos del usuario OWNER inicial ---
  @IsEmail()
  ownerEmail!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  ownerPassword!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  ownerFirstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  ownerLastName!: string;
}
