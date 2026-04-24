import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  Currency as CurrencyEnum,
  PropertyOperation as PropertyOperationEnum,
  PropertyStatus as PropertyStatusEnum,
  PropertyType as PropertyTypeEnum,
} from '@prisma/client';

/**
 * Filtros paginados para listado de propiedades.
 * Usado por el admin (con status) y por el marketplace público (forzado a PUBLISHED).
 */
export class ListPropertiesDto {
  @IsOptional()
  @IsEnum(PropertyStatusEnum)
  status?: PropertyStatusEnum;

  @IsOptional()
  @IsEnum(PropertyOperationEnum)
  operation?: PropertyOperationEnum;

  @IsOptional()
  @IsEnum(PropertyTypeEnum)
  type?: PropertyTypeEnum;

  @IsOptional()
  @IsEnum(CurrencyEnum)
  currency?: CurrencyEnum;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  zone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bedrooms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bathrooms?: number;

  /** Búsqueda geoespacial: centro + radio (km). Requiere los 3 juntos. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  nearLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  nearLng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(500)
  radiusKm?: number;

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
