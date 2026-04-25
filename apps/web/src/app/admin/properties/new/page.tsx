import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { PropertyForm } from '@/components/admin/properties/property-form';
import { requireUser } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Nueva propiedad' };

export default async function NewPropertyPage() {
  await requireUser('/admin/properties/new');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/admin/properties"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ChevronLeft className="h-4 w-4" />
        Volver al listado
      </Link>

      <header>
        <h1 className="text-2xl font-bold tracking-tight">Nueva propiedad</h1>
        <p className="text-muted-foreground">
          Se crea como borrador. Después podés agregar fotos y publicarla.
        </p>
      </header>

      <PropertyForm />
    </div>
  );
}
