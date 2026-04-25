import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BudgetFinderForm } from '@/components/properties/budget-finder-form';

export const metadata: Metadata = {
  title: 'Encontrá tu próxima propiedad',
  description: 'Buscador por presupuesto: te mostramos qué propiedades están a tu alcance.',
};

export default function FinderPage() {
  return (
    <main className="container mx-auto max-w-3xl space-y-8 px-6 py-12">
      <Link
        href="/properties"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al catálogo
      </Link>

      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          ¿Qué propiedades están a tu alcance?
        </h1>
        <p className="text-muted-foreground">
          Decinos qué buscás y cuánto querés invertir. Te mostramos las opciones
          ordenadas por ajuste a tu presupuesto, en lista y en mapa.
        </p>
      </header>

      <BudgetFinderForm />

      <p className="text-xs text-muted-foreground">
        Las propiedades se comparan en su moneda original — no convertimos BOB
        a USD ni viceversa. Si tu presupuesto es en USD, los resultados se
        filtran sólo entre publicaciones en USD (y lo mismo con BOB).
      </p>
    </main>
  );
}
