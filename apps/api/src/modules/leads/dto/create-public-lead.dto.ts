import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { LeadSource } from '@prisma/client';

/**
 * Payload del formulario público de contacto en el marketplace.
 * Al menos uno de `email` o `phone` debe venir (validado en el service).
 * No acepta `status` ni `assignedUserId` (arrancan en defaults).
 */
export class CreatePublicLeadDto {
  /** Slug del tenant destino si no viene por subdominio/header. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  tenantSlug?: string;

  /** Id de la propiedad consultada (opcional, contacto general si falta). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  propertyId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;
}
