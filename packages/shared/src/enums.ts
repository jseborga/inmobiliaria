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
} as const;
export type PropertyType = (typeof PropertyType)[keyof typeof PropertyType];

export const OperationType = {
  SALE: 'SALE',
  RENT: 'RENT',
  ANTICRETICO: 'ANTICRETICO',
} as const;
export type OperationType = (typeof OperationType)[keyof typeof OperationType];

export const Currency = {
  BOB: 'BOB',
  USD: 'USD',
} as const;
export type Currency = (typeof Currency)[keyof typeof Currency];

export const PropertyStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  RESERVED: 'RESERVED',
  SOLD: 'SOLD',
  ARCHIVED: 'ARCHIVED',
} as const;
export type PropertyStatus = (typeof PropertyStatus)[keyof typeof PropertyStatus];

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
} as const;
export type LeadSource = (typeof LeadSource)[keyof typeof LeadSource];
