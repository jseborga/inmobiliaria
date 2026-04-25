import type { Metadata } from 'next';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import {
  Currency,
  type PaginatedResponse,
  type PropertyDto,
} from '@inmobiliaria/shared';
import { Button } from '@/components/ui/button';
import { PropertyCard } from '@/components/properties/property-card';
import {
  PropertyFilters,
  type PropertyFiltersValues,
} from '@/components/properties/property-filters';
import { Pagination } from '@/components/properties/pagination';
import { ViewToggle } from '@/components/properties/view-toggle';
import { PropertyMapView } from '@/components/map/property-map-view';
import { ApiError } from '@/lib/api';
import { getPublicApi } from '@/lib/api/public';
import { getRequestContext } from '@/lib/tenant';

export const metadata: Metadata = {
  title: 'Propiedades',
  description: 'Encuentra propiedades en venta, alquiler o anticrético.',
};

const TAKE_DEFAULT = 12;

const FILTER_KEYS = [
  'q',
  'operation',
  'type',
  'currency',
  'city',
  'minPrice',
  'maxPrice',
  'bedrooms',
  'bathrooms',
] as const;

type SearchParams = Record<string, string | string[] | undefined>;

function pickFilters(searchParams: SearchParams): PropertyFiltersValues {
  const out: PropertyFiltersValues = {};
  for (const k of FILTER_KEYS) {
    const v = searchParams[k];
    if (typeof v === 'string' && v.length > 0) out[k] = v;
  }
  return out;
}

/**
 * En modo mapa subimos `take` para que la vista no quede partida en páginas
 * de 12 markers (que sería raro de UX). Igual está acotado a 100 por la API.
 */
const MAP_TAKE = 80;

function pickQuery(searchParams: SearchParams, view: 'list' | 'map') {
  const q: Record<string, string | number> = {};
  for (const k of FILTER_KEYS) {
    const v = searchParams[k];
    if (typeof v === 'string' && v.length > 0) q[k] = v;
  }

  // Geo filters (sólo aplica modo mapa, vienen de POI/cerca de mí).
  for (const k of ['nearLat', 'nearLng', 'radiusKm'] as const) {
    const v = searchParams[k];
    if (typeof v === 'string' && v.length > 0) q[k] = v;
  }

  const skip = Number(searchParams.skip ?? 0);
  const requestedTake = Number(searchParams.take ?? (view === 'map' ? MAP_TAKE : TAKE_DEFAULT));
  q.skip = Number.isFinite(skip) && skip >= 0 ? skip : 0;
  q.take =
    Number.isFinite(requestedTake) && requestedTake > 0 && requestedTake <= 100
      ? requestedTake
      : view === 'map'
        ? MAP_TAKE
        : TAKE_DEFAULT;
  return q;
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const ctx = getRequestContext();
  const tenantSlug = ctx.tenantSlug;
  const isMarketplace = ctx.context === 'marketplace';
  const view: 'list' | 'map' = searchParams.view === 'map' ? 'map' : 'list';

  // Modo presupuesto: ?fit=1&budget=...&currency=... — activa visualización
  // (markers coloreados + badges en cards). Los filtros normales (maxPrice,
  // currency, etc.) ya filtran lo que está fuera del presupuesto.
  const fitMode = searchParams.fit === '1';
  const budgetAmount = Number(searchParams.budget);
  const budgetCurrencyRaw = typeof searchParams.currency === 'string' ? searchParams.currency : '';
  const budgetCurrency = (Object.values(Currency) as string[]).includes(budgetCurrencyRaw)
    ? (budgetCurrencyRaw as Currency)
    : Currency.USD;
  const budget =
    fitMode && Number.isFinite(budgetAmount) && budgetAmount > 0
      ? { amount: budgetAmount, currency: budgetCurrency }
      : null;

  const api = getPublicApi({ tags: ['public-properties'] });
  const filters = pickFilters(searchParams);
  const query = pickQuery(searchParams, view);

  let data: PaginatedResponse<PropertyDto>;
  try {
    data = await api.get<PaginatedResponse<PropertyDto>>(
      '/public/properties',
      { query },
    );
  } catch (err) {
    const msg = err instanceof ApiError ? err.displayMessage : 'Error al cargar propiedades';
    return (
      <main className="container mx-auto max-w-7xl px-6 py-10">
        <p className="rounded-md border border-destructive bg-destructive/10 p-4 text-destructive">
          No pudimos cargar el catálogo: {msg}
        </p>
      </main>
    );
  }

  const skip = Number(query.skip);
  const take = Number(query.take);

  return (
    <main className="container mx-auto max-w-7xl space-y-8 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          {isMarketplace ? 'Marketplace' : 'Propiedades'}
        </h1>
        <p className="text-muted-foreground">
          {isMarketplace
            ? 'Catálogo global de propiedades publicadas por todas las inmobiliarias.'
            : tenantSlug
              ? `Propiedades publicadas por esta inmobiliaria.`
              : 'Propiedades publicadas.'}
        </p>
      </header>

      <PropertyFilters initial={filters} />

      {budget ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" />
              <strong>{data.total}</strong> propiedad{data.total === 1 ? '' : 'es'} dentro de tu
              presupuesto de{' '}
              <strong>
                {budget.currency === Currency.USD ? '$us' : 'Bs'}{' '}
                {budget.amount.toLocaleString('es-BO')}
              </strong>
              .
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/properties/finder">Ajustar búsqueda</Link>
            </Button>
          </div>
          <p className="mt-1 text-xs text-emerald-800/80">
            Verde = cómodo (≤ 70% del presupuesto). Amarillo = justo (70–100%).
          </p>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {data.total} resultado{data.total === 1 ? '' : 's'}
        </p>
        <div className="flex items-center gap-3">
          {!budget ? (
            <Button asChild size="sm" variant="ghost">
              <Link href="/properties/finder">
                <Sparkles className="mr-1 h-4 w-4" />
                Buscar por presupuesto
              </Link>
            </Button>
          ) : null}
          <ViewToggle current={view} />
        </div>
      </div>

      {data.items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          No encontramos propiedades con esos filtros.
        </div>
      ) : view === 'map' ? (
        <PropertyMapView
          properties={data.items}
          crossTenant={isMarketplace}
          budget={budget}
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.items.map((p) => (
            <PropertyCard
              key={p.id}
              property={p}
              crossTenant={isMarketplace}
              budget={budget}
            />
          ))}
        </div>
      )}

      {view === 'list' ? (
        <Pagination
          total={data.total}
          take={take}
          skip={skip}
          searchParams={searchParams}
        />
      ) : null}
    </main>
  );
}
