'use client';

import { useState } from 'react';
import { Save, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { AIUsageMonthlySummary, TenantAISettingsView } from '@inmobiliaria/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateTenantAISettingsByPlatform } from '@/lib/actions/ai-settings';
import { cn } from '@/lib/utils';

interface Props {
  tenantId: string;
  settings: TenantAISettingsView;
  usage: AIUsageMonthlySummary | null;
}

const MODES = [
  { value: 'DISABLED', label: 'Sin IA', tone: 'muted' },
  { value: 'PLATFORM', label: 'Plan con IA', tone: 'primary' },
  { value: 'OWN', label: 'Sus propias keys', tone: 'success' },
] as const;

export function TenantAISection({ tenantId, settings, usage }: Props) {
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'DISABLED' | 'PLATFORM' | 'OWN'>(settings.mode);
  const [provider, setProvider] = useState(settings.provider ?? '');
  const [model, setModel] = useState(settings.model ?? '');
  const [limit, setLimit] = useState(
    settings.monthlyTokenLimit != null ? String(settings.monthlyTokenLimit) : '',
  );

  async function save() {
    setBusy(true);
    try {
      const r = await updateTenantAISettingsByPlatform(tenantId, {
        mode,
        provider: provider ? (provider as 'claude' | 'openai' | 'openrouter') : null,
        model: model.trim() || null,
        monthlyTokenLimit: limit.trim() ? Number(limit) : null,
      });
      if (!r.ok) {
        toast.error(r.error.message);
        return;
      }
      toast.success('Configuración IA actualizada');
    } finally {
      setBusy(false);
    }
  }

  const totalTokens =
    (usage?.totals.inputTokens ?? 0) + (usage?.totals.outputTokens ?? 0);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Default según plan: <strong>{settings.defaultByPlan}</strong>. El tenant puede overridear
        si pasa a OWN cargando sus propias keys (eso desactiva el cobro).
      </p>

      <div className="flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMode(m.value)}
            disabled={busy}
            className={cn(
              'rounded-md border px-3 py-1.5 text-sm transition-colors',
              mode === m.value
                ? 'border-primary bg-primary/10 ring-2 ring-primary'
                : 'border-input hover:bg-muted',
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'PLATFORM' ? (
        <div className="grid gap-4 border-t pt-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="ai-provider">Provider override</Label>
            <select
              id="ai-provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              disabled={busy}
            >
              <option value="">(usar default global)</option>
              <option value="claude">Claude</option>
              <option value="openai">OpenAI</option>
              <option value="openrouter">OpenRouter</option>
              <option value="mock">Mock</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-model">Modelo override</Label>
            <Input
              id="ai-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="(default del provider)"
              disabled={busy}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-limit">Límite tokens/mes</Label>
            <Input
              id="ai-limit"
              type="number"
              min={0}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder="sin tope"
              disabled={busy}
            />
          </div>
        </div>
      ) : null}

      {mode !== 'DISABLED' && usage ? (
        <div className="grid gap-3 border-t pt-4 sm:grid-cols-4">
          <Stat label="Llamadas mes" value={usage.totals.calls.toLocaleString()} />
          <Stat label="Tokens totales" value={totalTokens.toLocaleString()} />
          <Stat
            label="Cobrable (PLATFORM)"
            value={settings.monthlyTokenUsed.toLocaleString()}
          />
          <Stat
            label="Tope"
            value={
              settings.monthlyTokenLimit != null
                ? settings.monthlyTokenLimit.toLocaleString()
                : 'sin tope'
            }
          />
        </div>
      ) : null}

      <div className="flex justify-end border-t pt-4">
        <Button onClick={save} disabled={busy} size="sm">
          <Save className="mr-2 h-4 w-4" />
          {busy ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
