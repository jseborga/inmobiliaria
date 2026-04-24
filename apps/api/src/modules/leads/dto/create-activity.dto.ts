import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { LeadActivityKind } from '@prisma/client';

/**
 * Kinds permitidos para registro manual desde el admin.
 * Los kinds automáticos (STATUS_CHANGE, ASSIGNMENT, CREATED) los emite el
 * service como efecto colateral y no aceptan input directo desde el cliente.
 */
export const USER_ACTIVITY_KINDS: readonly LeadActivityKind[] = [
  LeadActivityKind.NOTE,
  LeadActivityKind.CALL,
  LeadActivityKind.EMAIL,
  LeadActivityKind.WHATSAPP,
  LeadActivityKind.MEETING,
];

export class CreateActivityDto {
  @IsEnum(LeadActivityKind)
  kind!: LeadActivityKind;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  body?: string;
}
