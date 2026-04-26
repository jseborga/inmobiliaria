'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { generatePropertyDescription } from '@/lib/actions/ai';

interface Props {
  propertyId: string | undefined;
  /** Callback con la descripción generada. El form decide si reemplaza o no. */
  onGenerated: (text: string) => void;
  /** Si hay texto actual en la descripción, mostramos confirm antes de pisar. */
  hasExistingText: boolean;
}

const TONES = [
  { value: 'commercial', label: 'Comercial' },
  { value: 'family', label: 'Familiar' },
  { value: 'investor', label: 'Inversionista' },
  { value: 'luxury', label: 'Premium' },
] as const;

export function AIDescriptionButton({ propertyId, onGenerated, hasExistingText }: Props) {
  const [busy, setBusy] = useState(false);
  const [tone, setTone] = useState<(typeof TONES)[number]['value']>('commercial');

  async function generate() {
    if (!propertyId) {
      toast.error('Guardá la propiedad primero para que la IA pueda usar sus datos.');
      return;
    }
    if (
      hasExistingText &&
      !confirm('Ya hay texto en la descripción. ¿Reemplazar con la sugerencia de la IA?')
    ) {
      return;
    }
    setBusy(true);
    try {
      const r = await generatePropertyDescription({ propertyId, tone });
      if (!r.ok) {
        toast.error(r.error.message);
        return;
      }
      onGenerated(r.data.description);
      const tokens = r.data.usage?.outputTokens;
      toast.success(
        `Sugerencia generada (${r.data.provider}/${r.data.model})${
          tokens ? ` · ${tokens} tokens` : ''
        }`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={tone}
        onChange={(e) => setTone(e.target.value as typeof tone)}
        disabled={busy}
        className="h-9 rounded-md border border-input bg-background px-2 text-xs"
        aria-label="Tono"
      >
        {TONES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={generate}
        disabled={busy || !propertyId}
        title={!propertyId ? 'Guardá la propiedad primero' : 'Generar con IA'}
      >
        {busy ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
        )}
        {busy ? 'Generando…' : 'Sugerir con IA'}
      </Button>
    </div>
  );
}
