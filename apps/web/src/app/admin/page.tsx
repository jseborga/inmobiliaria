import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, Users, ArrowRight } from 'lucide-react';
import type { LeadDto, PaginatedResponse, PropertyDto } from '@inmobiliaria/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api';
import { getServerApi } from '@/lib/api/server';
import { requireUser } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Dashboard' };

async function safeCount<T>(
  fn: () => Promise<PaginatedResponse<T>>,
): Promise<{ total: number; ok: boolean }> {
  try {
    const r = await fn();
    return { total: r.total, ok: true };
  } catch (err) {
    if (err instanceof ApiError) return { total: 0, ok: false };
    throw err;
  }
}

export default async function AdminDashboardPage() {
  const user = await requireUser('/admin');
  const api = getServerApi({ cache: 'no-store' });

  const [properties, published, leadsTotal, leadsNew] = await Promise.all([
    safeCount<PropertyDto>(() =>
      api.get<PaginatedResponse<PropertyDto>>('/properties', { query: { take: 1 } }),
    ),
    safeCount<PropertyDto>(() =>
      api.get<PaginatedResponse<PropertyDto>>('/properties', {
        query: { take: 1, status: 'PUBLISHED' },
      }),
    ),
    safeCount<LeadDto>(() =>
      api.get<PaginatedResponse<LeadDto>>('/leads', { query: { take: 1 } }),
    ),
    safeCount<LeadDto>(() =>
      api.get<PaginatedResponse<LeadDto>>('/leads', {
        query: { take: 1, status: 'NEW' },
      }),
    ),
  ]);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          Hola, {user.firstName}
        </h1>
        <p className="text-muted-foreground">
          Resumen rápido de {user.tenant.name}.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Building2 className="h-4 w-4" />}
          label="Propiedades"
          value={properties.total}
          hint="totales"
        />
        <StatCard
          icon={<Building2 className="h-4 w-4" />}
          label="Publicadas"
          value={published.total}
          hint="visibles en marketplace"
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Leads"
          value={leadsTotal.total}
          hint="totales"
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Leads nuevos"
          value={leadsNew.total}
          hint="sin contactar"
          highlight={leadsNew.total > 0}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ShortcutCard
          title="Gestionar propiedades"
          description="Crear, publicar, editar fotos."
          href="/admin/properties"
        />
        <ShortcutCard
          title="Atender leads"
          description="Contactos del marketplace y manuales."
          href="/admin/leads"
        />
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? 'border-primary/40' : undefined}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
        {hint ? (
          <p className="text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ShortcutCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        <Button asChild variant="outline" size="sm">
          <Link href={href as never}>
            Ir <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
