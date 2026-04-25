import Link from 'next/link';
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{isTenantSite ? 'Nuestras propiedades' : 'Catálogo'}</CardTitle>
            <CardDescription>
              {isTenantSite
                ? 'Filtrá por operación, tipo, ubicación y precio.'
                : 'Buscá entre todas las inmobiliarias.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
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
