import { IsBoolean, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class UpdateWhatsappIntegrationDto {
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(300)
  baseUrl?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  instance?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  apiKey?: string | null;

  @IsOptional()
  @IsBoolean()
  testMode?: boolean;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
