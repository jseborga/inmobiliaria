import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlatformLoginForm } from '@/components/platform-admin/login-form';
import { getCurrentPlatformAdmin } from '@/lib/auth/platform-session';

export const metadata: Metadata = {
  title: 'Super-admin · Iniciar sesión',
  description: 'Acceso al panel de administración de la plataforma.',
};

interface PageProps {
  searchParams: { next?: string };
}

export default async function PlatformLoginPage({ searchParams }: PageProps) {
  const me = await getCurrentPlatformAdmin();
  if (me) {
    redirect((searchParams.next as never) ?? '/platform-admin');
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">Super-admin</CardTitle>
          <p className="text-sm text-muted-foreground">
            Acceso restringido a administradores de la plataforma.
          </p>
        </CardHeader>
        <CardContent>
          <PlatformLoginForm nextPath={searchParams.next} />
        </CardContent>
      </Card>
    </main>
  );
}
