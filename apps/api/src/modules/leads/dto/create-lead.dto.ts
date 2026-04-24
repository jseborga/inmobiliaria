import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { LeadSource, LeadStatus } from '@prisma/client';

/**
 * Creación manual de lead desde el admin (ej. llamada entrante, visita a la oficina).
 * A diferencia del endpoint público, permite setear status y asignar agente de entrada.
 */
export class CreateLeadDto {
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

  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  assignedUserId?: string;
}
