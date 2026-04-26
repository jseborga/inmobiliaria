/**
 * Schema y tipos para administración de tenants (super-admin only).
 */

import { z } from 'zod';
import { TenantPlan } from '../enums';
import { emailSchema, passwordSchema, phoneSchema, slugSchema } from '../schemas';

export const createTenantSchema = z.object({
  // Datos de la inmobiliaria.
  slug: slugSchema,
  name: z.string().min(2).max(120),
  plan: z.nativeEnum(TenantPlan).optional(),
  phone: phoneSchema.optional(),
  contactEmail: emailSchema.optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(80).optional(),

  // Datos del usuario OWNER inicial.
  ownerEmail: emailSchema,
  ownerPassword: passwordSchema,
  ownerFirstName: z.string().min(1).max(60),
  ownerLastName: z.string().min(1).max(60),
});
export type CreateTenantInput = z.infer<typeof createTenantSchema>;

export interface TenantListItem {
  id: string;
  slug: string;
  name: string;
  status: string;
  plan: string;
  city?: string | null;
  createdAt: string;
  _count?: { users?: number };
}
