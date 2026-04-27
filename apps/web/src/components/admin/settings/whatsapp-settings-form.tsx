'use client';

import { useState } from 'react';
import { Bot, Copy, KeyRound, MessageCircle, RefreshCw, Save, Send } from 'lucide-react';
import { toast } from 'sonner';
import type { WhatsappIntegrationView } from '@inmobiliaria/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  testSendWhatsapp,
  updateMyWhatsappIntegration,
  type UpdateWhatsappIntegrationInput,
} from '@/lib/actions/whatsapp';

interface Props {
  initial: WhatsappIntegrationView;
}

export function WhatsappSettingsForm({ initial }: Props) {
  const [busy, setBusy] = useState(false);
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl ?? '');
  const [instance, setInstance] = useState(initial.instance ?? '');
  const [apiKey, setApiKey] = useState('');
  const [testMode, setTestMode] = useState(initial.testMode);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [botEnabled, setBotEnabled] = useState(initial.botEnabled);
  const [testPhone, setTestPhone] = useState('');
  const [hasApiKey, setHasApiKey] = useState(initial.hasApiKey);
  const [maskedKey, setMaskedKey] = useState(initial.apiKeyMasked);
  const [webhookSecret, setWebhookSecret] = useState(initial.webhookSecret);

  async function save() {
    setBusy(true);
    try {
      const payload: UpdateWhatsappIntegrationInput = {
        baseUrl: baseUrl.trim() || null,
        instance: instance.trim() || null,
        testMode,
        enabled,
        botEnabled,
      };
      if (apiKey.trim()) payload.apiKey = apiKey.trim();
      const r = await updateMyWhatsappIntegration(payload);
      if (!r.ok) {
        toast.error(r.error.message);
        return;
      }
      setApiKey('');
      setHasApiKey(r.data.hasApiKey);
      setMaskedKey(r.data.apiKeyMasked);
      setWebhookSecret(r.data.webhookSecret);
      toast.success('Configuración guardada');
    } finally {
      setBusy(false);
    }
  }

  async function deleteKey() {
    if (!confirm('¿Eliminar la API key? Los OTPs van a fallar hasta que cargues una nueva.')) {
      return;
    }
    setBusy(true);
    try {
      const r = await updateMyWhatsappIntegration({ apiKey: null });
      if (!r.ok) {
        toast.error(r.error.message);
        return;
      }
      setHasApiKey(false);
      setMaskedKey(null);
      toast.success('Key eliminada');
    } finally {
      setBusy(false);
    }
  }

  async function testSend() {
    if (!testPhone.trim()) {
      toast.error('Ingresá un teléfono para la prueba');
      return;
    }
    setBusy(true);
    try {
      const r = await testSendWhatsapp(testPhone.trim());
      if (!r.ok) {
        toast.error(r.error.message);
        return;
      }
      if (r.data.sent) {
        toast.success('Mensaje enviado por Evolution API');
      } else if (r.data.reason === 'TEST_MODE') {
        toast.info('Modo prueba activo: el mensaje quedó en logs (no se mandó por WhatsApp).');
      } else {
        toast.warning(`No se mandó: ${r.data.reason ?? 'config incompleta'}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-lg border bg-card p-5">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <MessageCircle className="h-4 w-4" />
            Conexión a Evolution API
          </h2>
          <p className="text-xs text-muted-foreground">
            Datos de tu instancia de Evolution. Los OTPs y futuras notificaciones de WhatsApp
            van por acá.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="baseUrl">Base URL</Label>
            <Input
              id="baseUrl"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://evo.tu-dominio.com"
              disabled={busy}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="instance">Instancia</Label>
            <Input
              id="instance"
              value={instance}
              onChange={(e) => setInstance(e.target.value)}
              placeholder="mi-empresa"
              disabled={busy}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="apiKey">API Key</Label>
            {maskedKey ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 font-mono text-xs text-emerald-900">
                <KeyRound className="h-3 w-3" />
                {maskedKey}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">no cargada</span>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              id="apiKey"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={maskedKey ? '(dejá vacío para no tocar)' : 'pegá la apikey de Evolution'}
              disabled={busy}
            />
            {hasApiKey ? (
              <Button type="button" variant="outline" size="sm" onClick={deleteKey} disabled={busy}>
                Eliminar
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-5">
        <h2 className="text-base font-semibold">Modo de operación</h2>
        <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/50">
          <input
            type="checkbox"
            checked={testMode}
            onChange={(e) => setTestMode(e.target.checked)}
            disabled={busy}
            className="mt-0.5"
          />
          <div>
            <p className="text-sm font-medium">Modo prueba</p>
            <p className="text-xs text-muted-foreground">
              Los mensajes (incluidos OTPs) NO se envían por WhatsApp real — quedan en logs
              del servidor. Útil para QA sin gastar la sesión de WhatsApp.
            </p>
          </div>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/50">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            disabled={busy}
            className="mt-0.5"
          />
          <div>
            <p className="text-sm font-medium">Integración habilitada</p>
            <p className="text-xs text-muted-foreground">
              Si está apagada, los mensajes de WhatsApp se omiten silenciosamente (los OTPs
              se loggean).
            </p>
          </div>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/50">
          <input
            type="checkbox"
            checked={botEnabled}
            onChange={(e) => setBotEnabled(e.target.checked)}
            disabled={busy}
            className="mt-0.5"
          />
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Bot className="h-3.5 w-3.5" />
              Bot conversacional automático
            </p>
            <p className="text-xs text-muted-foreground">
              Cuando recibís un mensaje en WhatsApp, el bot responde automáticamente usando
              IA + búsqueda de propiedades. Si está apagado, los mensajes entrantes quedan
              en el panel para que vos los respondas a mano.
            </p>
          </div>
        </label>
      </section>

      {webhookSecret ? (
        <WebhookSection
          webhookUrl={initial.webhookUrl}
          webhookSecret={webhookSecret}
        />
      ) : (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Webhook entrante todavía no configurado</p>
          <p className="mt-1 text-xs">
            Guardá la configuración (paso anterior) — el sistema genera un secret automáticamente.
          </p>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <div className="flex flex-1 gap-2">
          <Input
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            placeholder="+591 7..."
            disabled={busy}
            className="max-w-xs"
          />
          <Button type="button" variant="outline" onClick={testSend} disabled={busy}>
            <Send className="mr-1.5 h-3.5 w-3.5" />
            Probar envío
          </Button>
        </div>
        <Button onClick={save} disabled={busy}>
          <Save className="mr-2 h-4 w-4" />
          {busy ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </div>
  );
}

function WebhookSection({
  webhookUrl,
  webhookSecret,
}: {
  webhookUrl: string | null;
  webhookSecret: string;
}) {
  const [busy, setBusy] = useState(false);

  function copy(text: string, label: string) {
    void navigator.clipboard.writeText(text);
    toast.success(`${label} copiado al portapapeles`);
  }

  async function rotate() {
    if (
      !confirm(
        '¿Rotar el secret? El webhook actual deja de funcionar; tenés que actualizar Evolution con el nuevo.',
      )
    )
      return;
    setBusy(true);
    try {
      const r = await updateMyWhatsappIntegration({ rotateWebhookSecret: true });
      if (!r.ok) toast.error(r.error.message);
      else {
        toast.success('Secret regenerado');
        // El form de arriba se va a recargar con el nuevo valor en el next render
        // (revalidatePath del server action). Mientras, refrescamos la pestaña:
        location.reload();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border bg-card p-5">
      <div>
        <h2 className="text-base font-semibold">Webhook entrante (Evolution → tu sistema)</h2>
        <p className="text-xs text-muted-foreground">
          Configurá esta URL en Evolution para que los mensajes que recibís lleguen al bot.
          En Evolution: Settings → Webhook → URL.
        </p>
      </div>
      <div className="space-y-2">
        <Label className="text-xs">URL (reemplazá el {'{tenantSlug}'} por tu slug real)</Label>
        <div className="flex gap-2">
          <Input
            readOnly
            value={webhookUrl ?? '(falta API_PUBLIC_URL en el server)'}
            className="font-mono text-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => copy(webhookUrl ?? '', 'URL')}
            disabled={!webhookUrl}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Label className="text-xs">Secret (también podés mandarlo en header X-Webhook-Secret)</Label>
        <div className="flex gap-2">
          <Input readOnly value={webhookSecret} className="font-mono text-xs" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => copy(webhookSecret, 'Secret')}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={rotate} disabled={busy}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </section>
  );
}
