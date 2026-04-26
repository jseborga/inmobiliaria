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

export const updateTenantSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  plan: z.nativeEnum(TenantPlan).optional(),
  phone: phoneSchema.optional().or(z.literal('')),
  contactEmail: emailSchema.optional().or(z.literal('')),
  address: z.string().max(200).optional(),
  city: z.string().max(80).optional(),
});
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;

export const resetUserPasswordSchema = z.object({
  newPassword: passwordSchema,
});
export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordSchema>;

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

export interface TenantUserItem {
  id: string;
  email: string;
  firstName: string;
  lastName?: string | null;
  role: string;
  status: string;
  lastLoginAt?: string | null;
  createdAt: string;
}

export interface TenantDetail {
  id: string;
  slug: string;
  name: string;
  plan: string;
  status: string;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  contactEmail?: string | null;
  createdAt: string;
  counts: { users: number; properties: number; leads: number };
  users: TenantUserItem[];
}
