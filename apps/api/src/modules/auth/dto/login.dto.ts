import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  /**
   * Slug del tenant al que el usuario pertenece.
   * Si no viene por header/subdominio, es requerido aqu\u00ed.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  tenantSlug!: string;
}
