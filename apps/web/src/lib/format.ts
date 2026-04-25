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

/**
 * Formato corto para markers de mapa: 150k, 3.5M.
 * No incluye símbolo de moneda (lo decide el caller).
 */
export function formatPriceShort(price: string | number): string {
  const n = typeof price === 'string' ? Number(price) : price;
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (abs >= 1_000) {
    return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`;
  }
  return NF.format(n);
}

/**
 * Clasifica una propiedad respecto al presupuesto del usuario.
 *   ratio ≤ 0.7  → 'comfort'  (verde, cómodo)
 *   0.7 < ratio ≤ 1.0 → 'tight'    (amarillo, justo)
 *   ratio > 1.0  → 'over'     (excluida, no debería aparecer)
 *
 * Asume que ambos están en la misma moneda — la API no convierte BOB↔USD.
 */
export type BudgetFit = 'comfort' | 'tight' | 'over';

export function budgetFit(price: string | number, budget: number): BudgetFit {
  const n = typeof price === 'string' ? Number(price) : price;
  if (!Number.isFinite(n) || !Number.isFinite(budget) || budget <= 0) return 'comfort';
  const ratio = n / budget;
  if (ratio <= 0.7) return 'comfort';
  if (ratio <= 1.0) return 'tight';
  return 'over';
}

export const budgetFitLabel: Record<BudgetFit, string> = {
  comfort: 'Cómodo',
  tight: 'Justo',
  over: 'Sobre presupuesto',
};

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
