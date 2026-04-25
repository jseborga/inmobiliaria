import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getRequestContext } from '@/lib/tenant';

export default function HomePage() {
  const { context, tenantSlug } = getRequestContext();
  const isTenantSite = context === 'tenant' && !!tenantSlug;
  const headline = isTenantSite
    ? 'Encontrá tu próximo hogar'
    : 'Marketplace inmobiliario';
  const subheadline = isTenantSite
    ? 'Explorá nuestro catálogo de propiedades en venta, alquiler y anticrético.'
    : 'Descubrí propiedades publicadas por las mejores inmobiliarias del país.';

  return (
    <main className="container mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">{headline}</h1>
        <p className="text-lg text-muted-foreground">{subheadline}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-emerald-300 bg-emerald-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-700" />
              Buscar por presupuesto
            </CardTitle>
            <CardDescription className="text-emerald-900/70">
              Decinos cuánto querés invertir y te mostramos qué está a tu alcance, en lista y mapa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/properties/finder">Empezar</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isTenantSite ? 'Nuestras propiedades' : 'Catálogo'}</CardTitle>
            <CardDescription>
              {isTenantSite
                ? 'Filtrá por operación, tipo, ubicación y precio.'
                : 'Buscá entre todas las inmobiliarias, en lista o mapa.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/properties">Ver propiedades</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Soy inmobiliaria</CardTitle>
            <CardDescription>Panel de gestión de propiedades y leads.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/login">Iniciar sesión</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
