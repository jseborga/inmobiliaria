import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Mail, Phone } from 'lucide-react';
import type { LeadDto } from '@inmobiliaria/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LeadActivityForm } from '@/components/admin/leads/lead-activity-form';
import { LeadDeleteButton } from '@/components/admin/leads/lead-delete-button';
import { LeadStatusSelect } from '@/components/admin/leads/lead-status-select';
import { LeadTimeline } from '@/components/admin/leads/lead-timeline';
import { ApiError } from '@/lib/api';
import { getServerApi } from '@/lib/api/server';
import { fetchTenantUsers } from '@/lib/api/users';
import { requireUser } from '@/lib/auth/session';
import { leadSourceLabel } from '@/lib/format';

interface PageProps {
  params: { id: string };
}

async function fetchLead(id: string): Promise<LeadDto | null> {
  try {
    const api = getServerApi({ cache: 'no-store' });
    return await api.get<LeadDto>(`/leads/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const lead = await fetchLead(params.id).catch(() => null);
  if (!lead) return { title: 'Lead' };
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ');
  return { title: name || 'Lead' };
}

export default async function LeadDetailPage({ params }: PageProps) {
  await requireUser(`/admin/leads/${params.id}`);
  const [lead, users] = await Promise.all([
    fetchLead(params.id),
    fetchTenantUsers(),
  ]);
  if (!lead) notFound();

  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Sin nombre';
  const activities = (lead.activities ?? []).slice().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/admin/leads"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ChevronLeft className="h-4 w-4" />
        Volver al listado
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{fullName}</h1>
          <p className="text-sm text-muted-foreground">
            Origen: {leadSourceLabel[lead.source]}
          </p>
        </div>
        <LeadDeleteButton leadId={lead.id} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <LeadStatusSelect lead={lead} users={users} />

          <LeadActivityForm leadId={lead.id} />

          <section className="space-y-3">
            <h2 className="text-base font-semibold">Timeline</h2>
            <LeadTimeline activities={activities} />
          </section>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contacto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {lead.email ? (
                <a
                  href={`mailto:${lead.email}`}
                  className="flex items-center gap-2 hover:underline"
                >
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {lead.email}
                </a>
              ) : null}
              {lead.phone ? (
                <a
                  href={`tel:${lead.phone}`}
                  className="flex items-center gap-2 hover:underline"
                >
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {lead.phone}
                </a>
              ) : null}
              {!lead.email && !lead.phone ? (
                <p className="text-muted-foreground">Sin datos de contacto</p>
              ) : null}
            </CardContent>
          </Card>

          {lead.message ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Mensaje original</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm">{lead.message}</p>
              </CardContent>
            </Card>
          ) : null}

          {lead.property ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Propiedad</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <Link
                  href={`/admin/properties/${lead.property.id}/edit` as never}
                  className="font-medium hover:underline"
                >
                  {lead.property.title}
                </Link>
                <p className="text-xs text-muted-foreground">{lead.property.slug}</p>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
