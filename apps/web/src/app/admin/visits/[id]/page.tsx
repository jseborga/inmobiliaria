import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar, MapPin, Mail, Phone, MessageSquare, Building2 } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VisitStatusBadge } from '@/components/admin/visits/visit-status-badge';
import { VisitStatusActions } from '@/components/admin/visits/visit-status-actions';
import { getVisit } from '@/lib/actions/visits';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Detalle visita' };

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' });
}

export default async function VisitDetailPage({ params }: { params: { id: string } }) {
  let visit;
  try {
    visit = await getVisit(params.id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const fullAssignee = visit.assignedTo
    ? [visit.assignedTo.firstName, visit.assignedTo.lastName].filter(Boolean).join(' ') ||
      visit.assignedTo.email
    : null;

  const propertyAddress = [visit.property.address, visit.property.zone, visit.property.city]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/admin/visits"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Volver al listado
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight">
            Visita
            <VisitStatusBadge status={visit.status} />
          </h1>
          <p className="text-sm text-muted-foreground">
            <Calendar className="mr-1 inline h-3 w-3" />
            {fmt(visit.scheduledAt)} · {visit.durationMinutes} min
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acciones</CardTitle>
        </CardHeader>
        <CardContent>
          <VisitStatusActions visitId={visit.id} current={visit.status} />
          {visit.cancelReason ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Motivo cancelación: <em>{visit.cancelReason}</em>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Visitante</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">{visit.visitorName}</p>
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <Phone className="h-3.5 w-3.5" />
              {visit.visitorPhone}
              {visit.phoneVerifiedAt ? (
                <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-900">
                  verificado
                </span>
              ) : null}
            </p>
            {visit.visitorEmail ? (
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                <a href={`mailto:${visit.visitorEmail}`} className="hover:underline">
                  {visit.visitorEmail}
                </a>
              </p>
            ) : null}
            {visit.notes ? (
              <p className="flex items-start gap-1.5 border-t pt-2 text-muted-foreground">
                <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-pre-line">{visit.notes}</span>
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Propiedad y agente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Link
              href={`/admin/properties/${visit.property.id}/edit` as never}
              className="flex items-center gap-1.5 font-medium hover:underline"
            >
              <Building2 className="h-3.5 w-3.5" />
              {visit.property.title}
            </Link>
            {propertyAddress ? (
              <p className="flex items-start gap-1.5 text-muted-foreground">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {propertyAddress}
              </p>
            ) : null}
            <div className="border-t pt-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Agente</p>
              <p className="mt-0.5">{fullAssignee ?? 'Sin asignar'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {visit.lead ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lead asociado</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <Link
              href={`/admin/leads/${visit.lead.id}` as never}
              className="text-primary hover:underline"
            >
              Ver en CRM →
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Auditoría</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-xs text-muted-foreground">
          <p>Creada: {fmt(visit.createdAt)}</p>
          <p>Última actualización: {fmt(visit.updatedAt)}</p>
          <p>
            Teléfono verificado:{' '}
            {visit.phoneVerifiedAt ? fmt(visit.phoneVerifiedAt) : 'no (visita manual)'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
