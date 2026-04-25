'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Send, Archive, Undo2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PropertyStatus, type PropertyDto } from '@inmobiliaria/shared';
import { Button } from '@/components/ui/button';
import {
  deletePropertyAndRedirect,
  setPropertyStatus,
} from '@/lib/actions/properties';

export function PropertyStatusActions({ property }: { property: PropertyDto }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function changeStatus(next: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED', label: string) {
    setBusy(next);
    try {
      const r = await setPropertyStatus(property.id, next);
      if (!r.ok) {
        toast.error(r.error.message);
        return;
      }
      toast.success(label);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!confirm('¿Eliminar la propiedad? Se borran también las fotos.')) return;
    setBusy('delete');
    try {
      await deletePropertyAndRedirect(property.id);
      // si llegamos acá fue redirect; nada que hacer
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {property.status !== PropertyStatus.PUBLISHED ? (
        <Button
          type="button"
          variant="default"
          onClick={() => changeStatus('PUBLISHED', 'Propiedad publicada')}
          disabled={busy !== null}
        >
          <Send className="mr-2 h-4 w-4" />
          {busy === 'PUBLISHED' ? 'Publicando…' : 'Publicar'}
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => changeStatus('DRAFT', 'Movida a borrador')}
          disabled={busy !== null}
        >
          <Undo2 className="mr-2 h-4 w-4" />
          Despublicar
        </Button>
      )}

      {property.status !== PropertyStatus.ARCHIVED ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => changeStatus('ARCHIVED', 'Propiedad archivada')}
          disabled={busy !== null}
        >
          <Archive className="mr-2 h-4 w-4" />
          Archivar
        </Button>
      ) : null}

      <Button
        type="button"
        variant="destructive"
        onClick={remove}
        disabled={busy !== null}
        className="ml-auto"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        {busy === 'delete' ? 'Eliminando…' : 'Eliminar'}
      </Button>
    </div>
  );
}
