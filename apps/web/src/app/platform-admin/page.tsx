import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { PaginatedResponse, TenantListItem } from '@inmobiliaria/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PlatformLogoutButton } from '@/components/platform-admin/logout-button';
import { getPlatformApi } from '@/lib/api/platform';
import { requirePlatformAdmin } from '@/lib/auth/platform-session';
import { ApiError } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Super-admin · Inmobiliarias',
};

export default async function PlatformDashboardPage() {
  const admin = await requirePlatformAdmin('/platform-admin');
  const api = getPlatformApi({ cache: 'no-store' });

  let tenants: TenantListItem[] = [];
  let errorMsg: string | null = null;
  try {
    const data = await api.get<PaginatedResponse<TenantListItem>>(
      '/platform-admin/tenants',
      { query: { take: 100 } },
    );
    tenants = data.items;
  } catch (err) {
    errorMsg = err instanceof ApiError ? err.displayMessage : 'Error al listar inmobiliarias';
  }

  return (
    <main className="container mx-auto max-w-6xl space-y-6 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inmobiliarias</h1>
          <p className="text-sm text-muted-foreground">
            Sesión: <span className="font-medium">{admin.email}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href={'/platform-admin/tenants/new' as never}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva inmobiliaria
            </Link>
          </Button>
          <PlatformLogoutButton />
        </div>
      </header>

      {errorMsg ? (
        <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {errorMsg}
        </div>
      ) : tenants.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Todavía no creaste ninguna inmobiliaria.
            </p>
            <Button asChild className="mt-4">
              <Link href={'/platform-admin/tenants/new' as never}>
                <Plus className="mr-2 h-4 w-4" />
                Crear la primera
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <Th>Slug</Th>
                  <Th>Nombre</Th>
                  <Th>Plan</Th>
                  <Th>Estado</Th>
                  <Th>Ciudad</Th>
                  <Th>Usuarios</Th>
                  <Th>Creada</Th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr
                    key={t.id}
                    className="cursor-pointer border-b last:border-b-0 hover:bg-muted/40"
                  >
                    <RowLink href={`/platform-admin/tenants/${t.id}`} className="font-mono text-xs">
                      {t.slug}
                    </RowLink>
                    <RowLink href={`/platform-admin/tenants/${t.id}`} className="font-medium">
                      {t.name}
                    </RowLink>
                    <RowLink href={`/platform-admin/tenants/${t.id}`}>
                      <span className="rounded-full border px-2 py-0.5 text-xs">
                        {t.plan}
                      </span>
                    </RowLink>
                    <RowLink href={`/platform-admin/tenants/${t.id}`}>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          t.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {t.status}
                      </span>
                    </RowLink>
                    <RowLink href={`/platform-admin/tenants/${t.id}`} className="text-muted-foreground">
                      {t.city ?? '—'}
                    </RowLink>
                    <RowLink
                      href={`/platform-admin/tenants/${t.id}`}
                      className="text-muted-foreground tabular-nums"
                    >
                      {t._count?.users ?? 0}
                    </RowLink>
                    <RowLink href={`/platform-admin/tenants/${t.id}`} className="text-muted-foreground">
                      {new Date(t.createdAt).toLocaleDateString('es-BO')}
                    </RowLink>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 text-left font-medium">{children}</th>;
}

/**
 * Celda con link interno. Usar `<a>` envolviendo el contenido para que toda
 * la celda sea clickeable (mejor UX que solo el texto).
 */
function RowLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <td className="p-0">
      <Link
        href={href as never}
        className={`block px-4 py-3 ${className ?? ''}`}
      >
        {children}
      </Link>
    </td>
  );
}
