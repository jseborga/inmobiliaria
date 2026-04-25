import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { LeadCreateForm } from '@/components/admin/leads/lead-create-form';
import { fetchTenantUsers } from '@/lib/api/users';
import { requireUser } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Nuevo lead' };

export default async function NewLeadPage() {
  const me = await requireUser('/admin/leads/new');
  const users = await fetchTenantUsers();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/admin/leads"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ChevronLeft className="h-4 w-4" />
        Volver al listado
      </Link>

      <header>
        <h1 className="text-2xl font-bold tracking-tight">Nuevo lead</h1>
        <p className="text-muted-foreground">
          Registrá un contacto entrante (llamada, walk-in, referido).
        </p>
      </header>

      <LeadCreateForm users={users} currentUserId={me.id} />
    </div>
  );
}
