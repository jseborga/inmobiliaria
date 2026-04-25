'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { deleteLeadAndRedirect } from '@/lib/actions/leads';

export function LeadDeleteButton({ leadId }: { leadId: string }) {
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm('¿Eliminar este lead? Se borran también las actividades.')) return;
    setBusy(true);
    try {
      await deleteLeadAndRedirect(leadId);
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="destructive" size="sm" onClick={remove} disabled={busy}>
      <Trash2 className="mr-2 h-4 w-4" />
      {busy ? 'Eliminando…' : 'Eliminar'}
    </Button>
  );
}
