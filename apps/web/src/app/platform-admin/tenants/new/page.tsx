import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreateTenantForm } from '@/components/platform-admin/create-tenant-form';
import { requirePlatformAdmin } from '@/lib/auth/platform-session';

export const metadata: Metadata = {
  title: 'Nueva inmobiliaria',
};

export default async function NewTenantPage() {
  await requirePlatformAdmin('/platform-admin/tenants/new');

  return (
    <main className="container mx-auto max-w-3xl space-y-6 px-6 py-10">
      <Link
        href={'/platform-admin' as never}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        Volver al listado
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Crear inmobiliaria</CardTitle>
          <p className="text-sm text-muted-foreground">
            Crea la inmobiliaria y el usuario OWNER inicial en una sola operación.
            La OWNER puede después invitar a más usuarios desde su panel.
          </p>
        </CardHeader>
        <CardContent>
          <CreateTenantForm />
        </CardContent>
      </Card>
    </main>
  );
}
