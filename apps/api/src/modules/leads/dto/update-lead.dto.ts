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
 * Parchea campos básicos de un lead (contacto, status, asignación).
 * El assignedUserId null permite desasignar.
 */
export class UpdateLeadDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  lastName?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string | null;

  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  /** Pasar null para desasignar; string para asignar a un user del tenant. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  assignedUserId?: string | null;
}
