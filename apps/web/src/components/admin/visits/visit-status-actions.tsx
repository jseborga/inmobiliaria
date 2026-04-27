'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, Calendar, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type { VisitStatus } from '@inmobiliaria/shared';
import { Button } from '@/components/ui/button';
import { updateVisit } from '@/lib/actions/visits';

interface Props {
  visitId: string;
  current: VisitStatus;
}

const TRANSITIONS: Record<
  VisitStatus,
  Array<{ to: VisitStatus; label: string; variant: 'default' | 'outline' | 'destructive'; icon: typeof CheckCircle2 }>
> = {
  REQUESTED: [
    { to: 'CONFIRMED', label: 'Confirmar', variant: 'default', icon: CheckCircle2 },
    { to: 'CANCELLED', label: 'Cancelar', variant: 'outline', icon: XCircle },
  ],
  CONFIRMED: [
    { to: 'COMPLETED', label: 'Marcar realizada', variant: 'default', icon: CheckCircle2 },
    { to: 'NO_SHOW', label: 'No vino', variant: 'outline', icon: AlertTriangle },
    { to: 'CANCELLED', label: 'Cancelar', variant: 'outline', icon: XCircle },
  ],
  COMPLETED: [
    { to: 'CONFIRMED', label: 'Volver a confirmada', variant: 'outline', icon: Calendar },
  ],
  CANCELLED: [
    { to: 'REQUESTED', label: 'Reabrir', variant: 'outline', icon: Calendar },
  ],
  NO_SHOW: [
    { to: 'CONFIRMED', label: 'Reabrir', variant: 'outline', icon: Calendar },
  ],
};

export function VisitStatusActions({ visitId, current }: Props) {
  const [busy, setBusy] = useState(false);

  async function go(to: VisitStatus, label: string) {
    if (to === 'CANCELLED' && !confirm('¿Cancelar la visita?')) return;
    setBusy(true);
    try {
      const r = await updateVisit(visitId, { status: to });
      if (!r.ok) toast.error(r.error.message);
      else toast.success(label);
    } finally {
      setBusy(false);
    }
  }

  const options = TRANSITIONS[current] ?? [];
  if (options.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const Icon = o.icon;
        return (
          <Button
            key={o.to}
            type="button"
            size="sm"
            variant={o.variant}
            onClick={() => go(o.to, o.label)}
            disabled={busy}
          >
            <Icon className="mr-1.5 h-3.5 w-3.5" />
            {o.label}
          </Button>
        );
      })}
    </div>
  );
}
