import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getRequestContext } from '@/lib/tenant';

export default function HomePage() {
  const { context, tenantSlug } = getRequestContext();

  return (
    <main className="container mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">Inmobiliaria</h1>
        <p className="text-lg text-muted-foreground">
          Marketplace multi-tenant. Fase 5.0: fundaciones del web listas.
        </p>
        <p className="text-sm text-muted-foreground">
          Contexto detectado: <span className="font-mono">{context}</span>
          {tenantSlug ? <> · tenant <span className="font-mono">{tenantSlug}</span></> : null}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Marketplace</CardTitle>
            <CardDescription>Explora propiedades publicadas (próximamente).</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/properties">Ver propiedades</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Admin</CardTitle>
            <CardDescription>Panel de gestión para tu inmobiliaria.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/login">Iniciar sesión</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
