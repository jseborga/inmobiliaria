import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Building2, ChevronLeft, FileText, Sparkles, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EditTenantForm } from '@/components/platform-admin/edit-tenant-form';
import { ResetPasswordButton } from '@/components/platform-admin/reset-password-button';
import { TenantActions } from '@/components/platform-admin/tenant-actions';
import { TenantAISection } from '@/components/platform-admin/tenant-ai-section';
import { ApiError } from '@/lib/api';
import { getPlatformApi } from '@/lib/api/platform';
import { requirePlatformAdmin } from '@/lib/auth/platform-session';
import {
  getPlatformTenantAISettings,
  getPlatformTenantAIUsage,
} from '@/lib/actions/ai-settings';
import type { TenantDetail } from '@inmobiliaria/shared';

export const metadata: Metadata = {
  title: 'Detalle de inmobiliaria',
};

interface PageProps {
  params: { id: string };
}

export default async function TenantDetailPage({ params }: PageProps) {
  await requirePlatformAdmin(`/platform-admin/tenants/${params.id}`);

  const api = getPlatformApi({ cache: 'no-store' });
  let tenant: TenantDetail;
  try {
    tenant = await api.get<TenantDetail>(`/platform-admin/tenants/${params.id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  // Config IA + uso del mes (carga independiente del tenant detail).
  const [aiSettings, aiUsage] = await Promise.all([
    getPlatformTenantAISettings(params.id).catch(() => null),
    getPlatformTenantAIUsage(params.id),
  ]);

  return (
    <main className="container mx-auto max-w-5xl space-y-6 px-6 py-10">
      <Link
        href={'/platform-admin' as never}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        Volver al listado
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{tenant.name}</h1>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                tenant.status === 'ACTIVE'
                  ? 'bg-emerald-100 text-emerald-900'
                  : 'bg-amber-100 text-amber-900'
              }`}
            >
              {tenant.status}
            </span>
            <span className="rounded-full border px-2 py-0.5 text-xs">
              Plan {tenant.plan}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Slug: <code className="font-mono">{tenant.slug}</code> · Creada{' '}
            {new Date(tenant.createdAt).toLocaleDateString('es-BO')}
          </p>
        </div>

        <TenantActions tenant={tenant} />
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={<Users className="h-5 w-5" />} label="Usuarios" value={tenant.counts.users} />
        <StatCard
          icon={<Building2 className="h-5 w-5" />}
          label="Propiedades"
          value={tenant.counts.properties}
        />
        <StatCard
          icon={<FileText className="h-5 w-5" />}
          label="Leads"
          value={tenant.counts.leads}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos de la inmobiliaria</CardTitle>
        </CardHeader>
        <CardContent>
          <EditTenantForm tenant={tenant} />
        </CardContent>
      </Card>

      {aiSettings ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Plan IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TenantAISection tenantId={tenant.id} settings={aiSettings} usage={aiUsage} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Usuarios ({tenant.users.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <Th>Nombre</Th>
                  <Th>Email</Th>
                  <Th>Rol</Th>
                  <Th>Estado</Th>
                  <Th>Último login</Th>
                  <Th>Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {tenant.users.map((u) => (
                  <tr key={u.id} className="border-b last:border-b-0">
                    <Td className="font-medium">
                      {u.firstName}
                      {u.lastName ? ` ${u.lastName}` : ''}
                    </Td>
                    <Td className="text-muted-foreground">{u.email}</Td>
                    <Td>
                      <span className="rounded-full border px-2 py-0.5 text-xs">{u.role}</span>
                    </Td>
                    <Td>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {u.status}
                      </span>
                    </Td>
                    <Td className="text-muted-foreground">
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleString('es-BO')
                        : 'Nunca'}
                    </Td>
                    <Td>
                      <ResetPasswordButton
                        tenantId={tenant.id}
                        userId={u.id}
                        userEmail={u.email}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div className="rounded-md bg-muted p-2 text-muted-foreground">{icon}</div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 text-left font-medium">{children}</th>;
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className ?? ''}`}>{children}</td>;
}
