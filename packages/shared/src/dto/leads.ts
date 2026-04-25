/**
 * Schemas Zod para DTOs de Leads (CRM).
 * Sync con apps/api/src/modules/leads/dto/*.
 */

import { z } from 'zod';
import { LeadActivityKind, LeadSource, LeadStatus } from '../enums';
import { emailSchema, phoneSchema } from '../schemas';

const baseLead = {
  firstName: z.string().min(1).max(60),
  lastName: z.string().max(60).optional().nullable(),
  email: emailSchema.optional().nullable(),
  phone: phoneSchema.optional().nullable(),
  message: z.string().max(2000).optional().nullable(),
};

/**
 * Captura pública del marketplace. Al menos uno de email o phone
 * (validado en el server, pero replicamos en el form para UX).
 */
export const publicLeadSchema = z
  .object({
    tenantSlug: z.string().min(1).max(64).optional(),
    propertyId: z.string().max(40).optional(),
    ...baseLead,
    source: z.nativeEnum(LeadSource).optional(),
  })
  .refine((d) => !!d.email || !!d.phone, {
    message: 'Debes proporcionar email o teléfono',
    path: ['email'],
  });
export type PublicLeadInput = z.infer<typeof publicLeadSchema>;

export const adminLeadCreateSchema = z
  .object({
    propertyId: z.string().max(40).optional(),
    ...baseLead,
    source: z.nativeEnum(LeadSource).optional(),
    status: z.nativeEnum(LeadStatus).optional(),
    assignedUserId: z.string().max(40).optional(),
  })
  .refine((d) => !!d.email || !!d.phone, {
    message: 'Debes proporcionar email o teléfono',
    path: ['email'],
  });
export type AdminLeadCreateInput = z.infer<typeof adminLeadCreateSchema>;

export const leadUpdateSchema = z.object({
  firstName: z.string().min(1).max(60).optional(),
  lastName: z.string().max(60).optional().nullable(),
  email: emailSchema.optional().nullable(),
  phone: phoneSchema.optional().nullable(),
  status: z.nativeEnum(LeadStatus).optional(),
  assignedUserId: z.string().max(40).optional().nullable(),
  message: z.string().max(2000).optional().nullable(),
});
export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>;

export const leadFilterSchema = z.object({
  status: z.nativeEnum(LeadStatus).optional(),
  source: z.nativeEnum(LeadSource).optional(),
  propertyId: z.string().max(40).optional(),
  assignedUserId: z.string().max(40).optional(),
  q: z.string().max(120).optional(),
  take: z.coerce.number().int().min(1).max(100).default(20).optional(),
  skip: z.coerce.number().int().min(0).default(0).optional(),
});
export type LeadFilterInput = z.infer<typeof leadFilterSchema>;

export const leadActivityCreateSchema = z.object({
  kind: z.nativeEnum(LeadActivityKind),
  body: z.string().min(1).max(2000),
});
export type LeadActivityCreateInput = z.infer<typeof leadActivityCreateSchema>;
