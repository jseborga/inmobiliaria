import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

const PROVIDERS = ['claude', 'openai', 'openrouter', 'mock'] as const;
const TONES = ['commercial', 'family', 'investor', 'luxury'] as const;

/**
 * Body opcional para el endpoint de generación. Todos los campos son opcionales:
 * si no se pasan, se usa el default del AIService (env var AI_PROVIDER + AI_MODEL).
 */
export class GeneratePropertyDescriptionDto {
  @IsOptional()
  @IsIn(PROVIDERS)
  provider?: (typeof PROVIDERS)[number];

  /** Override del modelo (ej. 'gpt-4o', 'meta-llama/llama-3.1-405b-instruct'). */
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  model?: string;

  /** Tono comercial. Default 'commercial'. */
  @IsOptional()
  @IsIn(TONES)
  tone?: (typeof TONES)[number];

  /** Cantidad aproximada de palabras esperada. Default 150. */
  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(500)
  approxWords?: number;

  /** Notas extra del agente para condicionar el texto. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
