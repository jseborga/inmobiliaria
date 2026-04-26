'use client';

import { useState } from 'react';
import { Save, KeyRound, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type { PlatformAISettingsView } from '@inmobiliaria/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  updatePlatformAISettings,
  type UpdatePlatformAISettingsInput,
} from '@/lib/actions/ai-settings';
import { cn } from '@/lib/utils';

interface Props {
  initial: PlatformAISettingsView;
}

const PROVIDERS = [
  { value: 'claude', label: 'Claude (Anthropic)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'openrouter', label: 'OpenRouter (multi-modelo)' },
  { value: 'mock', label: 'Mock (testing, sin costo)' },
] as const;

export function PlatformAISettingsForm({ initial }: Props) {
  const [busy, setBusy] = useState(false);
  const [defaultProvider, setDefaultProvider] = useState(initial.defaultProvider ?? 'mock');
  const [defaultModel, setDefaultModel] = useState(initial.defaultModel ?? '');
  const [embProvider, setEmbProvider] = useState(initial.embeddingsProvider ?? 'openai');
  const [embModel, setEmbModel] = useState(initial.embeddingsModel ?? 'text-embedding-3-small');

  // Inputs de keys: vacío = no tocar; "__delete__" = borrar; valor real = guardar.
  const [claudeKey, setClaudeKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [embeddingsKey, setEmbeddingsKey] = useState('');

  async function save() {
    if (!initial.cipherReady) {
      toast.error('Falta AI_KEYS_SECRET en el env. No se pueden guardar keys hasta resolverlo.');
      return;
    }
    setBusy(true);
    try {
      const payload: UpdatePlatformAISettingsInput = {
        defaultProvider: defaultProvider as 'claude' | 'openai' | 'openrouter' | 'mock',
        defaultModel: defaultModel.trim() || null,
        embeddingsProvider: embProvider.trim() || null,
        embeddingsModel: embModel.trim() || null,
      };
      // Solo tocar keys cuando el campo tiene contenido nuevo.
      if (claudeKey.trim()) payload.claudeKey = claudeKey.trim();
      if (openaiKey.trim()) payload.openaiKey = openaiKey.trim();
      if (openrouterKey.trim()) payload.openrouterKey = openrouterKey.trim();
      if (embeddingsKey.trim()) payload.embeddingsKey = embeddingsKey.trim();

      const r = await updatePlatformAISettings(payload);
      if (!r.ok) {
        toast.error(r.error.message);
        return;
      }
      toast.success('Configuración guardada');
      // Limpiar inputs de keys (ya guardadas)
      setClaudeKey('');
      setOpenaiKey('');
      setOpenrouterKey('');
      setEmbeddingsKey('');
    } finally {
      setBusy(false);
    }
  }

  async function deleteKey(field: 'claudeKey' | 'openaiKey' | 'openrouterKey' | 'embeddingsKey') {
    if (!confirm('¿Eliminar esta API key? Las inmobiliarias en modo PLATFORM dejarán de poder usarla.')) {
      return;
    }
    setBusy(true);
    try {
      const r = await updatePlatformAISettings({ [field]: null });
      if (!r.ok) toast.error(r.error.message);
      else toast.success('Key eliminada');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {!initial.cipherReady ? (
        <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Falta AI_KEYS_SECRET</p>
            <p className="mt-1 text-xs">
              El sistema no puede encriptar/desencriptar keys hasta que setees{' '}
              <code className="rounded bg-red-100 px-1 py-0.5">AI_KEYS_SECRET</code> en el env del API.
              Generala con <code className="rounded bg-red-100 px-1 py-0.5">openssl rand -base64 32</code>.
            </p>
          </div>
        </div>
      ) : null}

      <section className="space-y-4 rounded-lg border bg-card p-5">
        <h2 className="text-base font-semibold">Provider y modelo default</h2>
        <p className="text-xs text-muted-foreground">
          Lo que se usa por defecto cuando una inmobiliaria está en modo PLATFORM y no
          tiene override propio.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="defaultProvider">Provider</Label>
            <select
              id="defaultProvider"
              value={defaultProvider}
              onChange={(e) => setDefaultProvider(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              disabled={busy}
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="defaultModel">Modelo (opcional)</Label>
            <Input
              id="defaultModel"
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
              placeholder="claude-haiku-4-5-20251001"
              disabled={busy}
            />
            <p className="text-xs text-muted-foreground">
              Vacío usa el default del provider. Para OpenRouter, podés poner cualquier modelo (ej.{' '}
              <code>meta-llama/llama-3.3-70b-instruct</code>).
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-5">
        <h2 className="text-base font-semibold">API keys (encriptadas en DB)</h2>
        <p className="text-xs text-muted-foreground">
          Solo lo que escribas se guarda. Dejá vacío para no tocar la key existente. Usá el botón
          eliminar para borrar.
        </p>
        <KeyField
          id="claudeKey"
          label="Claude (Anthropic) — sk-ant-..."
          masked={initial.claudeKeyMasked}
          value={claudeKey}
          onChange={setClaudeKey}
          onDelete={() => deleteKey('claudeKey')}
          disabled={busy || !initial.cipherReady}
        />
        <KeyField
          id="openaiKey"
          label="OpenAI — sk-..."
          masked={initial.openaiKeyMasked}
          value={openaiKey}
          onChange={setOpenaiKey}
          onDelete={() => deleteKey('openaiKey')}
          disabled={busy || !initial.cipherReady}
        />
        <KeyField
          id="openrouterKey"
          label="OpenRouter — sk-or-..."
          masked={initial.openrouterKeyMasked}
          value={openrouterKey}
          onChange={setOpenrouterKey}
          onDelete={() => deleteKey('openrouterKey')}
          disabled={busy || !initial.cipherReady}
        />
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-5">
        <h2 className="text-base font-semibold">Embeddings (RAG)</h2>
        <p className="text-xs text-muted-foreground">
          Para la búsqueda semántica. Recomendado: <strong>OpenAI · text-embedding-3-small</strong>{' '}
          ($0.02/M tokens, estable).
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="embProvider">Provider</Label>
            <select
              id="embProvider"
              value={embProvider}
              onChange={(e) => setEmbProvider(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              disabled={busy}
            >
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="embModel">Modelo</Label>
            <Input
              id="embModel"
              value={embModel}
              onChange={(e) => setEmbModel(e.target.value)}
              placeholder="text-embedding-3-small"
              disabled={busy}
            />
          </div>
        </div>
        <KeyField
          id="embeddingsKey"
          label="API key de embeddings"
          masked={initial.embeddingsKeyMasked}
          value={embeddingsKey}
          onChange={setEmbeddingsKey}
          onDelete={() => deleteKey('embeddingsKey')}
          disabled={busy || !initial.cipherReady}
        />
      </section>

      <div className="flex items-center justify-end gap-2">
        <Button onClick={save} disabled={busy}>
          <Save className="mr-2 h-4 w-4" />
          {busy ? 'Guardando…' : 'Guardar configuración'}
        </Button>
      </div>
    </div>
  );
}

function KeyField({
  id,
  label,
  masked,
  value,
  onChange,
  onDelete,
  disabled,
}: {
  id: string;
  label: string;
  masked: string | null;
  value: string;
  onChange: (v: string) => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {masked ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 font-mono text-xs text-emerald-900',
            )}
          >
            <KeyRound className="h-3 w-3" />
            {masked}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">no cargada</span>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          id={id}
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={masked ? '(dejá vacío para no tocar)' : 'pegá la key acá'}
          disabled={disabled}
        />
        {masked ? (
          <Button type="button" variant="outline" size="sm" onClick={onDelete} disabled={disabled}>
            Eliminar
          </Button>
        ) : null}
      </div>
    </div>
  );
}
