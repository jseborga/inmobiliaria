import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, Pencil } from 'lucide-react';
import {
  PropertyStatus,
  type PaginatedResponse,
  type PropertyDto,
} from '@inmobiliaria/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Pagination } from '@/components/properties/pagination';
import {
  PropertiesFilterBar,
  type PropertiesFilterValues,
} from '@/components/admin/properties/properties-filter-bar';
import { ApiError } from '@/lib/api';
import { getServerApi } from '@/lib/api/server';
import { requireUser } from '@/lib/auth/session';
import {
  formatPrice,
  propertyOperationLabel,
  propertyTypeLabel,
} from '@/lib/format';

export const metadata: Metadata = { title: 'Propiedades' };

const TAKE = 20;
const FILTER_KEYS = ['q', 'status', 'operation', 'type'] as const;

type SearchParams = Record<string, string | string[] | undefined>;

const STATUS_BADGE: Record<
  PropertyStatus,
  { variant: 'default' | 'secondary' | 'success' | 'warning' | 'outline'; label: string }
> = {
  DRAFT: { variant: 'warning', label: 'Borrador' },
  PUBLISHED: { variant: 'success', label: 'Publicada' },
  ARCHIVED: { variant: 'secondary', label: 'Archivada' },
};

function pickFilters(sp: SearchParams): PropertiesFilterValues {
  const out: PropertiesFilterValues = {};
  for (const k of FILTER_KEYS) {
    const v = sp[k];
    if (typeof v === 'string' && v) out[k] = v;
  }
  return out;
}

function pickQuery(sp: SearchParams) {
  const q: Record<string, string | number> = {};
  for (const k of FILTER_KEYS) {
    const v = sp[k];
    if (typeof v === 'string' && v) q[k] = v;
  }
  const skip = Number(sp.skip ?? 0);
  q.skip = Number.isFinite(skip) && skip >= 0 ? skip : 0;
  q.take = TAKE;
  return q;
}

export default async function AdminPropertiesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireUser('/admin/properties');
  const api = getServerApi({ cache: 'no-store' });

  let data: PaginatedResponse<PropertyDto>;
  try {
    data = await api.get<PaginatedResponse<PropertyDto>>('/properties', {
      query: pickQuery(searchParams),
    });
  } catch (err) {
    const msg = err instanceof ApiError ? err.displayMessage : 'Error al cargar';
    return (
      <div className="space-y-4">
        <Header />
        <p className="rounded border border-destructive bg-destructive/10 p-4 text-destructive">
          {msg}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header />
      <PropertiesFilterBar initial={pickFilters(searchParams)} />

      {data.items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          Aún no tenés propiedades. Empezá creando una nueva.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Operación</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-16 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((p) => {
                const status = STATUS_BADGE[p.status];
                const location = [p.zone, p.city].filter(Boolean).join(', ');
                return (
                  <TableRow key={p.id}>
                    <TableCell className="max-w-[280px]">
                      <Link
                        href={`/admin/properties/${p.id}/edit` as never}
                        className="block truncate font-medium hover:underline"
                      >
                        {p.title}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">{p.slug}</p>
                    </TableCell>
                    <TableCell>{propertyOperationLabel[p.operation]}</TableCell>
                    <TableCell>{propertyTypeLabel[p.type]}</TableCell>
                    <TableCell>{formatPrice(p.price, p.currency, p.operation)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {location || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link
                          href={`/admin/properties/${p.id}/edit` as never}
                          aria-label={`Editar ${p.title}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Pagination
        total={data.total}
        take={TAKE}
        skip={Number(searchParams.skip ?? 0)}
        searchParams={searchParams}
      />
    </div>
  );
}

function Header() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Propiedades</h1>
        <p className="text-muted-foreground">Gestioná tu catálogo y publicá nuevas propiedades.</p>
      </div>
      <Button asChild>
        <Link href="/admin/properties/new">
          <Plus className="mr-2 h-4 w-4" />
          Nueva propiedad
        </Link>
      </Button>
    </header>
  );
}
