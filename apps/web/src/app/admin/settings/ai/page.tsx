import { Sparkles } from 'lucide-react';
import { TenantAISettingsForm } from '@/components/admin/settings/tenant-ai-settings-form';
import { getMyTenantAIUsage, getMyTenantAISettings } from '@/lib/actions/ai-settings';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'IA y chatbot' };

export default async function TenantAISettingsPage() {
  const [settings, usage] = await Promise.all([
    getMyTenantAISettings(),
    getMyTenantAIUsage(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Sparkles className="h-5 w-5 text-primary" />
          IA y chatbot
        </h1>
        <p className="text-sm text-muted-foreground">
          Configurá cómo tu inmobiliaria usa la IA: con tus propias keys o con las del plan.
          Acá también ves el consumo del mes.
        </p>
      </header>

      <TenantAISettingsForm initial={settings} usage={usage} />
    </div>
  );
}
