import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** Marca un handler/controller como p\u00fablico (bypass del JwtAuthGuard global). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
