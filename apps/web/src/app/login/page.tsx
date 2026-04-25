import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm } from '@/components/auth/login-form';
import { getCurrentUser } from '@/lib/auth/session';
import { getRequestContext } from '@/lib/tenant';

export const metadata: Metadata = {
  title: 'Iniciar sesión',
  description: 'Acceso al panel de gestión.',
};

interface PageProps {
  searchParams: { next?: string };
}

export default async function LoginPage({ searchParams }: PageProps) {
  // Si ya hay sesión válida, mandamos al admin (o al `next` indicado).
  const me = await getCurrentUser();
  if (me) {
    redirect((searchParams.next as never) ?? '/admin');
  }

  const ctx = getRequestContext();
  const tenantSlug = ctx.tenantSlug ?? undefined;
  const lockTenantSlug = ctx.context === 'tenant' && !!tenantSlug;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">Iniciar sesión</CardTitle>
          <p className="text-sm text-muted-foreground">
            {lockTenantSlug
              ? <>Estás ingresando como inmobiliaria <span className="font-medium">{tenantSlug}</span>.</>
              : 'Ingresá con tu cuenta de inmobiliaria.'}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <LoginForm
            defaultTenantSlug={tenantSlug}
            lockTenantSlug={lockTenantSlug}
            nextPath={searchParams.next}
          />
          <p className="text-xs text-muted-foreground">
            ¿No tenés cuenta?{' '}
            <Link href="/" className="underline">
              Volvé al inicio
            </Link>
            . El alta de inmobiliarias es solo por invitación.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
