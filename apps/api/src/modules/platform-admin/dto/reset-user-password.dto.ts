import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Payload para resetear password de un user. Solo super-admin lo puede hacer.
 */
export class ResetUserPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}
