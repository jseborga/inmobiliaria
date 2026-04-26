/**
 * Enums de dominio compartidos entre backend y frontend.
 * Mantener sincronizados con schema.prisma.
 */

export const PropertyType = {
  HOUSE: 'HOUSE',
  APARTMENT: 'APARTMENT',
  LAND: 'LAND',
  COMMERCIAL: 'COMMERCIAL',
  OFFICE: 'OFFICE',
  OTHER: 'OTHER',
} as const;
export type PropertyType = (typeof PropertyType)[keyof typeof PropertyType];

export const PropertyOperation = {
  SALE: 'SALE',
  RENT: 'RENT',
  ANTICRETICO: 'ANTICRETICO',
} as const;
export type PropertyOperation = (typeof PropertyOperation)[keyof typeof PropertyOperation];

export const Currency = {
  BOB: 'BOB',
  USD: 'USD',
} as const;
export type Currency = (typeof Currency)[keyof typeof Currency];

export const PropertyStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type PropertyStatus = (typeof PropertyStatus)[keyof typeof PropertyStatus];

export const TenantPlan = {
  FREE: 'FREE',
  PRO: 'PRO',
} as const;
export type TenantPlan = (typeof TenantPlan)[keyof typeof TenantPlan];

export const TenantStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;
export type TenantStatus = (typeof TenantStatus)[keyof typeof TenantStatus];

export const UserRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  AGENT: 'AGENT',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const LeadStatus = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  QUALIFIED: 'QUALIFIED',
  CONVERTED: 'CONVERTED',
  LOST: 'LOST',
} as const;
export type LeadStatus = (typeof LeadStatus)[keyof typeof LeadStatus];

export const LeadSource = {
  WEB: 'WEB',
  WHATSAPP: 'WHATSAPP',
  PHONE: 'PHONE',
  REFERRAL: 'REFERRAL',
  OTHER: 'OTHER',
} as const;
export type LeadSource = (typeof LeadSource)[keyof typeof LeadSource];

export const LeadActivityKind = {
  NOTE: 'NOTE',
  CALL: 'CALL',
  EMAIL: 'EMAIL',
  WHATSAPP: 'WHATSAPP',
  MEETING: 'MEETING',
  STATUS_CHANGE: 'STATUS_CHANGE',
  ASSIGNMENT: 'ASSIGNMENT',
  CREATED: 'CREATED',
} as const;
export type LeadActivityKind = (typeof LeadActivityKind)[keyof typeof LeadActivityKind];
