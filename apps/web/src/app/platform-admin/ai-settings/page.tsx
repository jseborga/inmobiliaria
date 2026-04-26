import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { PlatformAISettingsForm } from '@/components/platform-admin/platform-ai-settings-form';
import { getPlatformAISettings } from '@/lib/actions/ai-settings';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Configuración de IA' };

export default async function PlatformAISettingsPage() {
  const settings = await getPlatformAISettings();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/platform-admin"
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Volver al panel
      </Link>
      <header className="mb-6 space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Sparkles className="h-5 w-5 text-primary" />
          Configuración global de IA
        </h1>
        <p className="text-sm text-muted-foreground">
          Las inmobiliarias en modo <strong>PLATFORM</strong> usan estas keys (lo que se les
          factura). Las que están en modo <strong>OWN</strong> traen las suyas y no consumen
          créditos. Las del plan <strong>FREE</strong> no tienen IA por default.
        </p>
      </header>

      <PlatformAISettingsForm initial={settings} />
    </main>
  );
}
