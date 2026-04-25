'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  LeadStatus,
  type LeadDto,
  type UserSummary,
} from '@inmobiliaria/shared';
import { Label } from '@/components/ui/label';
import { updateLead } from '@/lib/actions/leads';
import { leadStatusLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

interface LeadStatusSelectProps {
  lead: LeadDto;
  users: UserSummary[];
}

/**
 * Controles inline en el header del detalle: cambiar status y asignación.
 * Cada cambio dispara una server action por separado para que el feedback
 * sea inmediato y los errores se aíslen.
 */
export function LeadStatusSelect({ lead, users }: LeadStatusSelectProps) {
  const router = useRouter();
  const [savingField, setSavingField] = useState<string | null>(null);

  async function update(patch: Partial<{ status: LeadStatus; assignedUserId: string | null }>, field: string) {
    setSavingField(field);
    const r = await updateLead(lead.id, patch);
    setSavingField(null);
    if (!r.ok) {
      toast.error(r.error.message);
      return;
    }
    toast.success('Actualizado');
    router.refresh();
  }

  return (
    <div className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="status">Estado</Label>
        <select
          id="status"
          defaultValue={lead.status}
          onChange={(e) => update({ status: e.target.value as LeadStatus }, 'status')}
          disabled={savingField !== null}
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          {Object.values(LeadStatus).map((s) => (
            <option key={s} value={s}>
              {leadStatusLabel[s]}
            </option>
          ))}
        </select>
        {savingField === 'status' ? (
          <p className="text-xs text-muted-foreground">Guardando…</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="assignedUserId">Asignado a</Label>
        <select
          id="assignedUserId"
          defaultValue={lead.assignedUserId ?? ''}
          onChange={(e) =>
            update({ assignedUserId: e.target.value || null }, 'assignedUserId')
          }
          disabled={savingField !== null}
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <option value="">Sin asignar</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {[u.firstName, u.lastName].filter(Boolean).join(' ') || u.email}
            </option>
          ))}
        </select>
        {savingField === 'assignedUserId' ? (
          <p className="text-xs text-muted-foreground">Guardando…</p>
        ) : null}
      </div>
    </div>
  );
}
