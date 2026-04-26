'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pause, Play, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { TenantDetail } from '@inmobiliaria/shared';
import { Button } from '@/components/ui/button';
import {
  deleteTenantAction,
  setTenantStatusAction,
} from '@/lib/actions/platform-tenants';

interface TenantActionsProps {
  tenant: TenantDetail;
}

export function TenantActions({ tenant }: TenantActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<'suspend' | 'reactivate' | 'delete' | null>(null);

  const isSuspended = tenant.status === 'SUSPENDED';

  async function toggleStatus() {
    const action = isSuspended ? 'reactivate' : 'suspend';
    setPending(action);
    try {
      const res = await setTenantStatusAction(tenant.id, action);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(isSuspended ? 'Inmobiliaria reactivada' : 'Inmobiliaria suspendida');
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function onDelete() {
    const confirmText = `eliminar ${tenant.slug}`;
    const answer = window.prompt(
      `Esto borra la inmobiliaria y TODOS sus datos (usuarios, propiedades, leads, fotos). Operación irrecuperable.\n\n` +
        `Para confirmar, escribí exactamente:\n\n${confirmText}`,
    );
    if (answer !== confirmText) {
      toast.message('Eliminación cancelada');
      return;
    }
    setPending('delete');
    try {
      const res = await deleteTenantAction(tenant.id);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Inmobiliaria ${tenant.name} eliminada`);
      router.push('/platform-admin' as never);
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant={isSuspended ? 'default' : 'outline'}
        size="sm"
        onClick={toggleStatus}
        disabled={pending !== null}
      >
        {isSuspended ? (
          <>
            <Play className="mr-2 h-4 w-4" />
            {pending === 'reactivate' ? 'Reactivando…' : 'Reactivar'}
          </>
        ) : (
          <>
            <Pause className="mr-2 h-4 w-4" />
            {pending === 'suspend' ? 'Suspendiendo…' : 'Suspender'}
          </>
        )}
      </Button>

      <Button
        variant="destructive"
        size="sm"
        onClick={onDelete}
        disabled={pending !== null}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        {pending === 'delete' ? 'Eliminando…' : 'Eliminar'}
      </Button>
    </div>
  );
}
