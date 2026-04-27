import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarCheck, MessageSquare, Phone } from 'lucide-react';
import type { VisitStatus } from '@inmobiliaria/shared';
import { Card, CardContent } from '@/components/ui/card';
import { VisitStatusBadge } from '@/components/admin/visits/visit-status-badge';
import { listVisits } from '@/lib/actions/visits';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Visitas' };
export const dynamic = 'force-dynamic';

const STATUS_FILTERS: { value: VisitStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Todas' },
  { value: 'REQUESTED', label: 'Pendientes' },
  { value: 'CONFIRMED', label: 'Confirmadas' },
  { value: 'COMPLETED', label: 'Realizadas' },
  { value: 'CANCELLED', label: 'Canceladas' },
  { value: 'NO_SHOW', label: 'No vinieron' },
];

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function AdminVisitsPage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  const status = searchParams?.status as VisitStatus | undefined;
  const data = await listVisits({ status, take: 100 });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <CalendarCheck className="h-6 w-6" />
            Visitas
          </h1>
          <p className="text-muted-foreground">
            Solicitudes de visita presencial. Las pendientes esperan tu confirmación.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((f) => {
          const href =
            f.value === 'ALL' ? '/admin/visits' : `/admin/visits?status=${f.value}`;
          const active = (status ?? 'ALL') === f.value;
          return (
            <Link
              key={f.value}
              href={href as never}
              className={cn(
                'rounded-md border px-3 py-1 text-xs transition-colors',
                active
                  ? 'border-primary bg-primary/10 font-medium'
                  : 'border-muted-foreground/20 hover:bg-muted',
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {data.items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <CalendarCheck className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {status
                ? 'No hay visitas en este estado.'
                : 'Aún no recibiste solicitudes de visita. Cuando alguien complete el booking en el detalle público de una propiedad, aparecerá acá.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Fecha y hora</th>
                <th className="px-4 py-2">Visitante</th>
                <th className="px-4 py-2">Propiedad</th>
                <th className="px-4 py-2">Asignado</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2">Solicitada</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.items.map((v) => {
                const assignee = v.assignedTo
                  ? [v.assignedTo.firstName, v.assignedTo.lastName]
                      .filter(Boolean)
                      .join(' ') || v.assignedTo.email
                  : '—';
                return (
                  <tr key={v.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/visits/${v.id}` as never}
                        className="font-medium hover:underline"
                      >
                        {fmtDateTime(v.scheduledAt)}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {v.durationMinutes} min
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{v.visitorName}</p>
                      <p className="text-xs text-muted-foreground">
                        <Phone className="mr-1 inline h-3 w-3" />
                        {v.visitorPhone}
                        {v.phoneVerifiedAt ? (
                          <span className="ml-1 text-emerald-700">✓ verificado</span>
                        ) : null}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/properties/${v.property.id}/edit` as never}
                        className="hover:underline"
                      >
                        {v.property.title}
                      </Link>
                      {v.notes ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          <MessageSquare className="mr-1 inline h-3 w-3" />
                          {v.notes}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{assignee}</td>
                    <td className="px-4 py-3">
                      <VisitStatusBadge status={v.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {fmtDateTime(v.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
