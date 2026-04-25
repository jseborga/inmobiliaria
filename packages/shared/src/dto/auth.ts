/**
 * Schemas Zod para Auth (login tenant + super-admin).
 */

import { z } from 'zod';
import { emailSchema, passwordSchema, slugSchema } from '../schemas';

export const tenantLoginSchema = z.object({
  tenantSlug: slugSchema,
  email: emailSchema,
  password: passwordSchema,
});
export type TenantLoginInput = z.infer<typeof tenantLoginSchema>;

export const platformLoginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
export type PlatformLoginInput = z.infer<typeof platformLoginSchema>;
