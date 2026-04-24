import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { LeadSource, LeadStatus } from '@prisma/client';

/**
 * Filtros paginados para listar leads del tenant.
 * Orden por defecto: createdAt desc.
 */
export class ListLeadsDto {
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  propertyId?: string;

  /** 'me' como valor especial resuelve al user actual desde el controller. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  assignedUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;
}
