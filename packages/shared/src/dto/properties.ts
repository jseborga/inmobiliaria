/**
 * Schemas Zod para DTOs de Properties.
 *
 * Estos schemas se mantienen en sync con los DTOs de class-validator del API
 * (apps/api/src/modules/properties/dto/*). Los reusa el frontend para validar
 * formularios antes de pegarle al backend.
 */

import { z } from 'zod';
import { Currency, PropertyOperation, PropertyStatus, PropertyType } from '../enums';

const slugRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export const propertyCreateSchema = z.object({
  slug: z
    .string()
    .min(3)
    .max(80)
    .regex(slugRegex, 'Slug debe contener solo minúsculas, números y guiones')
    .optional(),
  title: z.string().min(3).max(180),
  description: z.string().max(5000).optional().nullable(),
  operation: z.nativeEnum(PropertyOperation),
  type: z.nativeEnum(PropertyType),
  status: z.nativeEnum(PropertyStatus).optional(),
  price: z.coerce.number().min(0).max(9_999_999_999.99),
  currency: z.nativeEnum(Currency).optional(),
  areaSqm: z.coerce.number().min(0).max(9_999_999).optional().nullable(),
  bedrooms: z.coerce.number().int().min(0).max(50).optional().nullable(),
  bathrooms: z.coerce.number().int().min(0).max(50).optional().nullable(),
  parkingSpaces: z.coerce.number().int().min(0).max(50).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  zone: z.string().max(120).optional().nullable(),
  address: z.string().max(250).optional().nullable(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  // Acepta string vacío como "no definido" (limpieza desde el form admin) y
  // valida URL si trae contenido. La transformación a undefined se hace en el
  // caller (sanitize()) antes de mandar al API.
  videoUrl: z
    .union([z.literal(''), z.string().url('URL inválida').max(500)])
    .optional()
    .nullable(),
  tour360Url: z
    .union([z.literal(''), z.string().url('URL inválida').max(500)])
    .optional()
    .nullable(),
});
export type PropertyCreateInput = z.infer<typeof propertyCreateSchema>;

export const propertyUpdateSchema = propertyCreateSchema.partial();
export type PropertyUpdateInput = z.infer<typeof propertyUpdateSchema>;

export const propertyFilterSchema = z.object({
  status: z.nativeEnum(PropertyStatus).optional(),
  operation: z.nativeEnum(PropertyOperation).optional(),
  type: z.nativeEnum(PropertyType).optional(),
  currency: z.nativeEnum(Currency).optional(),
  city: z.string().max(120).optional(),
  zone: z.string().max(120).optional(),
  q: z.string().max(120).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  bedrooms: z.coerce.number().int().min(0).optional(),
  bathrooms: z.coerce.number().int().min(0).optional(),
  nearLat: z.coerce.number().min(-90).max(90).optional(),
  nearLng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(0.1).max(500).optional(),
  take: z.coerce.number().int().min(1).max(100).default(20).optional(),
  skip: z.coerce.number().int().min(0).default(0).optional(),
});
export type PropertyFilterInput = z.infer<typeof propertyFilterSchema>;

export const confirmImageSchema = z.object({
  r2Key: z.string().min(1).max(500),
  publicUrl: z.string().url(),
  order: z.coerce.number().int().min(0).optional(),
  width: z.coerce.number().int().min(0).optional(),
  height: z.coerce.number().int().min(0).optional(),
});
export type ConfirmImageInput = z.infer<typeof confirmImageSchema>;
