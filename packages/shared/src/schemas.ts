import { z } from 'zod';

/**
 * Schemas Zod reutilizables para validación en backend y frontend.
 * Solo primitivas compartidas en fase inicial; DTOs específicos viven en cada app.
 */

export const emailSchema = z.string().email().max(255);
export const passwordSchema = z
  .string()
  .min(8, 'Mínimo 8 caracteres')
  .max(128, 'Máximo 128 caracteres');

export const slugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug inválido (kebab-case)');

export const phoneSchema = z
  .string()
  .min(7)
  .max(20)
  .regex(/^\+?[0-9\s\-()]+$/, 'Teléfono inválido');
