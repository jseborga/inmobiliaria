import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { TenantAIMode } from '@prisma/client';

const PROVIDERS = ['claude', 'openai', 'openrouter', 'mock'] as const;

/**
 * Patch del TenantAISettings. Usado por:
 *   - Super-admin (cambia mode + override de provider/model + límite mensual)
 *   - Tenant OWNER/ADMIN (puede cambiar a OWN y cargar sus keys, pero no
 *     puede subirse de DISABLED a PLATFORM por sí mismo — eso lo hace el
 *     super-admin).
 *
 * El controller correspondiente filtra qué campos puede tocar cada uno.
 */
export class UpdateTenantAISettingsDto {
  @IsOptional()
  @IsEnum(TenantAIMode)
  mode?: TenantAIMode;

  @IsOptional()
  @IsIn([...PROVIDERS, null])
  provider?: (typeof PROVIDERS)[number] | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  claudeKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  openaiKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  openrouterKey?: string | null;

  /** Solo super-admin: tope mensual en tokens (cuando mode=PLATFORM). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  monthlyTokenLimit?: number | null;
}
