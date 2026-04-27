import { MessageCircle } from 'lucide-react';
import { WhatsappSettingsForm } from '@/components/admin/settings/whatsapp-settings-form';
import { getMyWhatsappIntegration } from '@/lib/actions/whatsapp';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'WhatsApp' };

export default async function WhatsappSettingsPage() {
  const settings = await getMyWhatsappIntegration();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <MessageCircle className="h-5 w-5 text-primary" />
          WhatsApp (Evolution API)
        </h1>
        <p className="text-sm text-muted-foreground">
          Conectá tu instancia para que el sistema mande OTPs y notificaciones a los visitantes
          por WhatsApp. Sin esto, los códigos de verificación de visitas quedan en logs (modo
          prueba).
        </p>
      </header>

      <WhatsappSettingsForm initial={settings} />
    </div>
  );
}
