import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import {
  LeadStatus,
  type LeadDto,
  type PaginatedResponse,
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
  LeadsFilterBar,
  type LeadsFilterValues,
} from '@/components/admin/leads/leads-filter-bar';
import { ApiError } from '@/lib/api';
import { getServerApi } from '@/lib/api/server';
import { requireUser } from '@/lib/auth/session';
import { leadSourceLabel, leadStatusLabel } from '@/lib/format';

export const metadata: Metadata = { title: 'Leads' };

const TAKE = 20;
const FILTER_KEYS = ['q', 'status', 'source', 'mine'] as const;

const STATUS_BADGE: Record<
  LeadStatus,
  { variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'; label: string }
> = {
  NEW: { variant: 'default', label: leadStatusLabel.NEW },
  CONTACTED: { variant: 'warning', label: leadStatusLabel.CONTACTED },
  QUALIFIED: { variant: 'success', label: leadStatusLabel.QUALIFIED },
  CONVERTED: { variant: 'success', label: leadStatusLabel.CONVERTED },
  LOST: { variant: 'secondary', label: leadStatusLabel.LOST },
};

type SearchParams = Record<string, string | string[] | undefined>;

function pickFilters(sp: SearchParams): LeadsFilterValues {
  const out: LeadsFilterValues = {};
  for (const k of FILTER_KEYS) {
    const v = sp[k];
    if (typeof v === 'string' && v) out[k] = v;
  }
  return out;
}

function pickQuery(sp: SearchParams) {
  const q: Record<string, string | number> = {};
  for (const k of FILTER_KEYS) {
    if (k === 'mine') continue; // se traduce abajo
    const v = sp[k];
    if (typeof v === 'string' && v) q[k] = v;
  }
  // `mine=1` (UI) → `assignedUserId=me` (API).
  if (sp.mine === '1') q.assignedUserId = 'me';
  const skip = Number(sp.skip ?? 0);
  q.skip = Number.isFinite(skip) && skip >= 0 ? skip : 0;
  q.take = TAKE;
  return q;
}

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireUser('/admin/leads');
  const api = getServerApi({ cache: 'no-store' });

  let data: PaginatedResponse<LeadDto>;
  try {
    data = await api.get<PaginatedResponse<LeadDto>>('/leads', {
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

  const dateFmt = new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="space-y-6">
      <Header />
      <LeadsFilterBar initial={pickFilters(searchParams)} />

      {data.items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          No hay leads que coincidan con los filtros.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contacto</TableHead>
                <TableHead>Propiedad</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Asignado</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Recibido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((lead) => {
                const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || '—';
                const status = STATUS_BADGE[lead.status];
                const assignee = lead.assignedUser
                  ? [lead.assignedUser.firstName, lead.assignedUser.lastName].filter(Boolean).join(' ') ||
                    lead.assignedUser.email
                  : '—';
                return (
                  <TableRow key={lead.id}>
                    <TableCell className="max-w-[260px]">
                      <Link
                        href={`/admin/leads/${lead.id}` as never}
                        className="block truncate font-medium hover:underline"
                      >
                        {fullName}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {lead.email ?? lead.phone ?? 'sin contacto'}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate">
                      {lead.property ? (
                        <Link
                          href={`/admin/properties/${lead.property.id}/edit` as never}
                          className="hover:underline"
                          title={lead.property.title}
                        >
                          {lead.property.title}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{leadSourceLabel[lead.source]}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{assignee}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {dateFmt.format(new Date(lead.createdAt))}
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
        <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
        <p className="text-muted-foreground">
          Contactos del marketplace y registros manuales del equipo.
        </p>
      </div>
      <Button asChild>
        <Link href="/admin/leads/new">
          <Plus className="mr-2 h-4 w-4" />
          Lead manual
        </Link>
      </Button>
    </header>
  );
}
