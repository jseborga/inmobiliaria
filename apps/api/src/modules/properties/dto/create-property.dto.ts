import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  Currency as CurrencyEnum,
  PropertyOperation as PropertyOperationEnum,
  PropertyStatus as PropertyStatusEnum,
  PropertyType as PropertyTypeEnum,
} from '@prisma/client';

export class CreatePropertyDto {
  /** Identificador URL-safe por tenant. Se autogenera si no viene. */
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  @Matches(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, {
    message: 'slug debe contener solo minúsculas, números y guiones',
  })
  slug?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsEnum(PropertyOperationEnum)
  operation!: PropertyOperationEnum;

  @IsEnum(PropertyTypeEnum)
  type!: PropertyTypeEnum;

  @IsOptional()
  @IsEnum(PropertyStatusEnum)
  status?: PropertyStatusEnum;

  /** En la moneda indicada. */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999.99)
  price!: number;

  @IsOptional()
  @IsEnum(CurrencyEnum)
  currency?: CurrencyEnum;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999)
  areaSqm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  bedrooms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  bathrooms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  parkingSpaces?: number;

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
  @MaxLength(250)
  address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  /** URL del video (YouTube, Vimeo, etc.) — link público. */
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  videoUrl?: string;

  /** URL del tour 360 (Matterport, Kuula, etc.) — link público. */
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  tour360Url?: string;
}
