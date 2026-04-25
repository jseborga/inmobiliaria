/**
 * Shapes de respuesta de la API que consume el frontend.
 *
 * Mantener en sync con los `select`/`include` de Prisma usados en
 * apps/api/src/modules/{properties,leads,auth}.
 */

import type {
  Currency,
  LeadActivityKind,
  LeadSource,
  LeadStatus,
  PropertyOperation,
  PropertyStatus,
  PropertyType,
  UserRole,
} from './enums';

export interface TenantSummary {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface PropertyImageDto {
  id: string;
  propertyId: string;
  r2Key: string;
  publicUrl: string;
  order: number;
  width?: number | null;
  height?: number | null;
}

export interface PropertyDto {
  id: string;
  tenantId: string;
  slug: string;
  title: string;
  description?: string | null;
  operation: PropertyOperation;
  type: PropertyType;
  status: PropertyStatus;
  /** Devuelto como string desde la API (Prisma.Decimal serializado). */
  price: string;
  currency: Currency;
  areaSqm?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  parkingSpaces?: number | null;
  city?: string | null;
  zone?: string | null;
  address?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  publishedAt?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Solo en respuesta geoespacial. */
  distanceMeters?: number;
  images: PropertyImageDto[];
  tenant?: TenantSummary;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  take: number;
  skip: number;
}

export interface MeResponse {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName?: string | null;
  role: UserRole;
  tenant: TenantSummary;
}

export interface LoginResponse {
  accessToken: string;
  user: MeResponse;
}

export interface UserSummary {
  id: string;
  firstName: string;
  lastName?: string | null;
  email: string;
  role: UserRole;
}

export interface LeadActivityDto {
  id: string;
  leadId: string;
  kind: LeadActivityKind;
  body?: string | null;
  metadata?: Record<string, unknown> | null;
  authorUserId?: string | null;
  author?: UserSummary | null;
  createdAt: string;
}

export interface LeadDto {
  id: string;
  tenantId: string;
  propertyId?: string | null;
  property?: Pick<PropertyDto, 'id' | 'slug' | 'title'> | null;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  message?: string | null;
  status: LeadStatus;
  source: LeadSource;
  assignedUserId?: string | null;
  assignedUser?: UserSummary | null;
  createdAt: string;
  updatedAt: string;
  activities?: LeadActivityDto[];
}

export interface PresignResponse {
  uploadUrl: string;
  r2Key: string;
  publicUrl: string;
  /** Headers que el cliente debe enviar en el PUT. */
  headers?: Record<string, string>;
}
