'use client';

import { useState } from 'react';
import { Save, KeyRound, Sparkles, Lock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type { AIUsageMonthlySummary, TenantAISettingsView } from '@inmobiliaria/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateMyTenantAISettings, type UpdateTenantAIByOwnerInput } from '@/lib/actions/ai-settings';
import { cn } from '@/lib/utils';

interface Props {
  initial: TenantAISettingsView;
  usage: AIUsageMonthlySummary | null;
}

const PROVIDERS = [
  { value: 'claude', label: 'Claude (Anthropic)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'openrouter', label: 'OpenRouter' },
] as const;

export function TenantAISettingsForm({ initial, usage }: Props) {
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'PLATFORM' | 'OWN' | 'DISABLED'>(initial.mode);
  const [provider, setProvider] = useState(initial.provider ?? '');
  const [model, setModel] = useState(initial.model ?? '');
  const [claudeKey, setClaudeKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [openrouterKey, setOpenrouterKey] = useState('');

  async function save() {
    setBusy(true);
    try {
      const payload: UpdateTenantAIByOwnerInput = {
        mode,
        provider: provider ? (provider as 'claude' | 'openai' | 'openrouter') : null,
        model: model.trim() || null,
      };
      if (claudeKey.trim()) payload.claudeKey = claudeKey.trim();
      if (openaiKey.trim()) payload.openaiKey = openaiKey.trim();
      if (openrouterKey.trim()) payload.openrouterKey = openrouterKey.trim();

      const r = await updateMyTenantAISettings(payload);
      if (!r.ok) {
        toast.error(r.error.message);
        return;
      }
      toast.success('Configuración guardada');
      setClaudeKey('');
      setOpenaiKey('');
      setOpenrouterKey('');
    } finally {
      setBusy(false);
    }
  }

  async function deleteKey(field: 'claudeKey' | 'openaiKey' | 'openrouterKey') {
    if (!confirm('¿Eliminar esta API key?')) return;
    setBusy(true);
    try {
      const r = await updateMyTenantAISettings({ [field]: null });
      if (!r.ok) toast.error(r.error.message);
      else toast.success('Key eliminada');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Estado actual */}
      <ModeBadge mode={initial.mode} defaultByPlan={initial.defaultByPlan} />

      {initial.mode !== 'DISABLED' ? (
        <UsageCard
          mode={initial.mode}
          monthlyUsed={initial.monthlyTokenUsed}
          limit={initial.monthlyTokenLimit}
          usage={usage}
        />
      ) : null}

      {/* Form de configuración (solo si NO está DISABLED) */}
      {initial.mode === 'DISABLED' ? null : (
        <section className="space-y-5 rounded-lg border bg-card p-5">
          <div>
            <h2 className="text-base font-semibold">Modo de uso</h2>
            <p className="text-xs text-muted-foreground">
              Si elegís <strong>OWN</strong>, cargá tus propias API keys debajo y no se te cobra
              consumo. Si volvés a <strong>PLATFORM</strong>, usás las keys de la plataforma
              (cobrable según tu plan).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ModeOption
              active={mode === 'PLATFORM'}
              disabled={busy || initial.defaultByPlan === 'DISABLED'}
              onClick={() => setMode('PLATFORM')}
              label="Usar plataforma"
              hint="Cobrable, sin claves propias"
            />
            <ModeOption
              active={mode === 'OWN'}
              disabled={busy}
              onClick={() => setMode('OWN')}
              label="Usar mis keys"
              hint="Sin cobro de consumo"
            />
          </div>

          {mode === 'OWN' ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="provider">Provider preferido</Label>
                  <select
                    id="provider"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    disabled={busy}
                  >
                    <option value="">(usar default de la plataforma)</option>
                    {PROVIDERS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="model">Modelo (opcional)</Label>
                  <Input
                    id="model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="claude-haiku-4-5-20251001"
                    disabled={busy}
                  />
                </div>
              </div>

              <div className="space-y-3 border-t pt-4">
                <p className="text-sm font-medium">Tus API keys (encriptadas)</p>
                <KeyField
                  id="claudeKey"
                  label="Claude — sk-ant-..."
                  masked={initial.claudeKeyMasked}
                  value={claudeKey}
                  onChange={setClaudeKey}
                  onDelete={() => deleteKey('claudeKey')}
                  disabled={busy}
                />
                <KeyField
                  id="openaiKey"
                  label="OpenAI — sk-..."
                  masked={initial.openaiKeyMasked}
                  value={openaiKey}
                  onChange={setOpenaiKey}
                  onDelete={() => deleteKey('openaiKey')}
                  disabled={busy}
                />
                <KeyField
                  id="openrouterKey"
                  label="OpenRouter — sk-or-..."
                  masked={initial.openrouterKeyMasked}
                  value={openrouterKey}
                  onChange={setOpenrouterKey}
                  onDelete={() => deleteKey('openrouterKey')}
                  disabled={busy}
                />
              </div>
            </>
          ) : null}

          <div className="flex justify-end border-t pt-4">
            <Button onClick={save} disabled={busy}>
              <Save className="mr-2 h-4 w-4" />
              {busy ? 'Guardando…' : 'Guardar configuración'}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function ModeBadge({
  mode,
  defaultByPlan,
}: {
  mode: 'DISABLED' | 'PLATFORM' | 'OWN';
  defaultByPlan: 'DISABLED' | 'PLATFORM' | 'OWN';
}) {
  if (mode === 'DISABLED') {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
        <Lock className="mt-0.5 h-5 w-5 text-amber-600" />
        <div className="space-y-1">
          <p className="font-medium text-amber-900">Tu plan actual no incluye IA</p>
          <p className="text-sm text-amber-800">
            Para usar el chatbot, generación de descripciones y búsqueda semántica, contactá al
            equipo para subir a un plan con IA incluida — o pasá a modo &quot;mis keys&quot; cargando
            tus propias claves.
          </p>
        </div>
      </div>
    );
  }
  if (mode === 'OWN') {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4">
        <KeyRound className="mt-0.5 h-5 w-5 text-emerald-700" />
        <div className="space-y-1">
          <p className="font-medium text-emerald-900">Usando tus propias API keys</p>
          <p className="text-sm text-emerald-800">
            El consumo se factura directo en tu cuenta del proveedor. La plataforma no te cobra
            por uso de IA.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 rounded-lg border border-blue-300 bg-blue-50 p-4">
      <Sparkles className="mt-0.5 h-5 w-5 text-blue-700" />
      <div className="space-y-1">
        <p className="font-medium text-blue-900">Plan con IA incluida (modo plataforma)</p>
        <p className="text-sm text-blue-800">
          Estás usando las keys de la plataforma. El consumo del mes se factura según tu plan.
          Si preferís usar tus keys, pasá a modo &quot;mis keys&quot; abajo.
        </p>
      </div>
    </div>
  );
}

function ModeOption({
  active,
  disabled,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col items-start rounded-md border px-4 py-3 text-left transition-colors',
        active
          ? 'border-primary bg-primary/10 ring-2 ring-primary'
          : 'border-input hover:bg-muted',
        disabled && 'opacity-50',
      )}
    >
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}

function UsageCard({
  mode,
  monthlyUsed,
  limit,
  usage,
}: {
  mode: 'PLATFORM' | 'OWN' | 'DISABLED';
  monthlyUsed: number;
  limit: number | null;
  usage: AIUsageMonthlySummary | null;
}) {
  const totalCalls = usage?.totals.calls ?? 0;
  const totalTokens = (usage?.totals.inputTokens ?? 0) + (usage?.totals.outputTokens ?? 0);
  const overLimit = limit && monthlyUsed >= limit;

  return (
    <section className="space-y-3 rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Consumo del mes</h2>
        {mode === 'PLATFORM' && limit ? (
          <span
            className={cn(
              'text-xs',
              overLimit ? 'font-medium text-red-700' : 'text-muted-foreground',
            )}
          >
            {monthlyUsed.toLocaleString()} / {limit.toLocaleString()} tokens
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Llamadas" value={totalCalls.toLocaleString()} />
        <Stat label="Tokens totales" value={totalTokens.toLocaleString()} />
        <Stat
          label={mode === 'PLATFORM' ? 'Cobrable' : 'No cobrable'}
          value={mode === 'PLATFORM' ? monthlyUsed.toLocaleString() : '0'}
        />
      </div>

      {overLimit ? (
        <p className="flex items-center gap-1 text-xs text-red-700">
          <AlertTriangle className="h-3 w-3" />
          Llegaste al límite mensual. Contactá al equipo para ampliarlo.
        </p>
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold">{value}</p>
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
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 font-mono text-xs text-emerald-900">
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
