import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const PROVIDERS = ['claude', 'openai', 'openrouter', 'mock'] as const;

/**
 * Patch del PlatformAISettings. Reglas:
 *   - `null` o `""` en una key borra esa key.
 *   - undefined (no presente) deja la key sin tocar.
 *
 * Las keys se mandan en CLARO (HTTPS) y el server las encripta antes de persistir.
 */
export class UpdatePlatformAISettingsDto {
  @IsOptional()
  @IsIn([...PROVIDERS, null])
  defaultProvider?: (typeof PROVIDERS)[number] | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  defaultModel?: string | null;

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

  @IsOptional()
  @IsString()
  @MaxLength(120)
  embeddingsProvider?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  embeddingsModel?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  embeddingsKey?: string | null;
}
