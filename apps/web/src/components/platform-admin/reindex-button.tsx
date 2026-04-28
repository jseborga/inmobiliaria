'use client';

import { useState } from 'react';
import { Database, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { reindexProperties, type EmbeddingsStats } from '@/lib/actions/ai-settings';

interface Props {
  embeddingsReady: boolean;
  stats: EmbeddingsStats | null;
}

export function ReindexButton({ embeddingsReady, stats }: Props) {
  const [busy, setBusy] = useState<'incremental' | 'full' | null>(null);

  async function run(mode: 'incremental' | 'full') {
    if (mode === 'full') {
      if (
        !confirm(
          'Reindex completo: re-genera embeddings de TODAS las propiedades, incluso las ya indexadas. Útil al cambiar de modelo. ¿Seguir?',
        )
      ) {
        return;
      }
    }
    setBusy(mode);
    try {
      const r = await reindexProperties(mode === 'incremental');
      if (!r.ok) {
        toast.error(r.error.message);
        return;
      }
      toast.success(
        `Reindex listo: ${r.data.indexed}/${r.data.total} indexadas, ${r.data.skipped} omitidas`,
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Database className="h-4 w-4" />
            Indexado semántico
          </h2>
          <p className="text-xs text-muted-foreground">
            Genera embeddings para que la búsqueda semántica funcione. Las propiedades nuevas
            se indexan automáticamente al guardarlas.
          </p>
        </div>
        <span
          className={
            embeddingsReady
              ? 'rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-900'
              : 'rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900'
          }
        >
          {embeddingsReady ? 'embeddings activos' : 'falta config'}
        </span>
      </div>

      {stats && (
        <dl className="grid grid-cols-2 gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Total</dt>
            <dd className="font-medium tabular-nums">{stats.total}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Indexadas</dt>
            <dd className="font-medium tabular-nums text-emerald-700">{stats.indexed}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Pendientes</dt>
            <dd className="font-medium tabular-nums text-amber-700">{stats.missing}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Modelo viejo</dt>
            <dd className="font-medium tabular-nums">{stats.staleModel}</dd>
          </div>
        </dl>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => run('incremental')}
          disabled={busy !== null || !embeddingsReady}
          title={embeddingsReady ? '' : 'Cargá la key de embeddings primero'}
        >
          {busy === 'incremental' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Indexar pendientes
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => run('full')}
          disabled={busy !== null || !embeddingsReady}
        >
          {busy === 'full' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Reindex completo
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        El reindex puede tardar varios minutos según el catálogo. Las propiedades quedan
        operativas durante el proceso.
      </p>
    </section>
  );
}
