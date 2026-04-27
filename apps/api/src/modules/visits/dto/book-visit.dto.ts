import {
  IsDateString,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Step 1: pedir OTP (visitante quiere agendar y va a recibir código). */
export class RequestVisitOtpDto {
  @IsString()
  @MinLength(7)
  @MaxLength(30)
  phone!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  tenantSlug!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  propertyId!: string;
}

/** Step 2 (opcional): verificar OTP antes de mostrar el form completo. */
export class VerifyVisitOtpDto {
  @IsString()
  @MinLength(7)
  @MaxLength(30)
  phone!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(8)
  code!: string;
}

/** Step 3: crear la visita con todos los datos + código OTP válido. */
export class BookVisitDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  tenantSlug!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
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
  @MaxLength(255)
  visitorEmail?: string;

  /** Código OTP recibido por WhatsApp. Se valida contra phone_otps. */
  @IsString()
  @MinLength(4)
  @MaxLength(8)
  otpCode!: string;

  /** Fecha+hora ISO 8601 propuesta por el visitante. Debe ser futuro. */
  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(180)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
