import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { VisitStatus } from '@prisma/client';

/** Filtros del listado admin. */
export class ListVisitsDto {
  @IsOptional()
  @IsEnum(VisitStatus)
  status?: VisitStatus;

  @IsOptional()
  @IsString()
  assignedUserId?: string;

  @IsOptional()
  @IsString()
  propertyId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;
}

/** Crear visita manual desde admin (walk-in, llamada, etc). */
export class CreateAdminVisitDto {
  @IsString()
  @MinLength(3)
  propertyId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  visitorName!: string;

  @IsString()
  @MinLength(7)
  @MaxLength(30)
  visitorPhone!: string;

  @IsOptional()
  @IsEmail()
  visitorEmail?: string;

  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(180)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  assignedUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/** Update parcial. */
export class UpdateVisitDto {
  @IsOptional()
  @IsEnum(VisitStatus)
  status?: VisitStatus;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(180)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  assignedUserId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cancelReason?: string;
}
