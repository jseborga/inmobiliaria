import {
  Currency,
  PropertyOperation,
  PropertyType,
  type LeadSource,
  type LeadStatus,
} from '@inmobiliaria/shared';

/**
 * Formato de precios y etiquetas legibles.
 *
 * Bolivia usa "Bs" como símbolo coloquial (ISO BOB), "$us" para USD.
 * Para anticrético solemos mostrar "anticrético" en minúsculas porque es
 * una operación, no un precio "por mes".
 */

const NF = new Intl.NumberFormat('es-BO', {
  maximumFractionDigits: 0,
});

export function formatPrice(
  price: string | number,
  currency: Currency,
  operation?: PropertyOperation,
): string {
  const n = typeof price === 'string' ? Number(price) : price;
  if (!Number.isFinite(n)) return '—';
  const symbol = currency === Currency.USD ? '$us' : 'Bs';
  const base = `${symbol} ${NF.format(n)}`;
  if (operation === PropertyOperation.RENT) return `${base} / mes`;
  return base;
}

export function formatArea(areaSqm?: string | number | null): string | null {
  if (areaSqm === null || areaSqm === undefined) return null;
  const n = typeof areaSqm === 'string' ? Number(areaSqm) : areaSqm;
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${NF.format(n)} m²`;
}

export const propertyTypeLabel: Record<PropertyType, string> = {
  HOUSE: 'Casa',
  APARTMENT: 'Departamento',
  LAND: 'Terreno',
  COMMERCIAL: 'Comercial',
  OFFICE: 'Oficina',
  OTHER: 'Otro',
};

export const propertyOperationLabel: Record<PropertyOperation, string> = {
  SALE: 'Venta',
  RENT: 'Alquiler',
  ANTICRETICO: 'Anticrético',
};

export const leadStatusLabel: Record<LeadStatus, string> = {
  NEW: 'Nuevo',
  CONTACTED: 'Contactado',
  QUALIFIED: 'Calificado',
  CONVERTED: 'Convertido',
  LOST: 'Perdido',
};

export const leadSourceLabel: Record<LeadSource, string> = {
  WEB: 'Web',
  WHATSAPP: 'WhatsApp',
  PHONE: 'Teléfono',
  REFERRAL: 'Referido',
  OTHER: 'Otro',
};
