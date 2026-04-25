'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { ImagePlus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { PropertyImageDto } from '@inmobiliaria/shared';
import { Button } from '@/components/ui/button';
import {
  confirmPropertyImage,
  deletePropertyImage,
  presignPropertyImage,
} from '@/lib/actions/property-images';
import { cn } from '@/lib/utils';

interface PropertyImagesProps {
  propertyId: string;
  images: PropertyImageDto[];
}

const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif';
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Sube imágenes vía el flow de 3 pasos:
 *   1. server action `presignPropertyImage` → uploadUrl + publicUrl
 *   2. fetch directo PUT al storage (R2 o mock)
 *   3. server action `confirmPropertyImage` para persistir en DB
 *
 * Mantiene un estado optimista por archivo (uploading / done / failed)
 * para mostrar feedback inmediato sin esperar al revalidate.
 */
export function PropertyImages({ propertyId, images }: PropertyImagesProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ name: string; state: 'uploading' | 'failed' }[]>([]);
  const [, startTransition] = useTransition();

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    const initialProgress = Array.from(files).map((f) => ({ name: f.name, state: 'uploading' as const }));
    setProgress(initialProgress);

    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name}: excede 10 MB`);
          markFailed(file.name);
          continue;
        }
        const presign = await presignPropertyImage(propertyId, file.type, file.size);
        if (!presign.ok) {
          toast.error(`${file.name}: ${presign.error.message}`);
          markFailed(file.name);
          continue;
        }
        const put = await fetch(presign.data.uploadUrl, {
          method: presign.data.method,
          headers: presign.data.headers,
          body: file,
        });
        if (!put.ok) {
          toast.error(`${file.name}: subida falló (${put.status})`);
          markFailed(file.name);
          continue;
        }
        const dims = await readImageDimensions(file);
        const confirm = await confirmPropertyImage(propertyId, {
          r2Key: presign.data.r2Key,
          publicUrl: presign.data.publicUrl,
          ...(dims ? { width: dims.width, height: dims.height } : {}),
        });
        if (!confirm.ok) {
          toast.error(`${file.name}: ${confirm.error.message}`);
          markFailed(file.name);
          continue;
        }
      }
      // Una vez procesadas todas, refrescamos para que aparezcan persistidas.
      startTransition(() => router.refresh());
      // Damos un toast de cierre solo si subimos al menos una.
      if (initialProgress.some((p) => p.state === 'uploading')) {
        toast.success('Fotos subidas');
      }
    } finally {
      setBusy(false);
      setProgress((prev) => prev.filter((p) => p.state !== 'uploading'));
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function markFailed(name: string) {
    setProgress((prev) => prev.map((p) => (p.name === name ? { ...p, state: 'failed' } : p)));
  }

  async function handleDelete(imageId: string) {
    if (!confirm('¿Eliminar esta foto?')) return;
    const r = await deletePropertyImage(propertyId, imageId);
    if (!r.ok) {
      toast.error(r.error.message);
      return;
    }
    toast.success('Foto eliminada');
    startTransition(() => router.refresh());
  }

  return (
    <section className="space-y-4 rounded-lg border bg-card p-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Fotos</h2>
          <p className="text-xs text-muted-foreground">
            JPG, PNG, WebP o AVIF. Máximo 10 MB por imagen.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
          {busy ? 'Subiendo…' : 'Agregar fotos'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </header>

      {progress.length > 0 ? (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {progress.map((p) => (
            <li key={p.name} className={cn(p.state === 'failed' && 'text-destructive')}>
              {p.name} — {p.state === 'uploading' ? 'subiendo…' : 'falló'}
            </li>
          ))}
        </ul>
      ) : null}

      {images.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Aún no agregaste fotos.
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((img) => (
            <li key={img.id} className="group relative overflow-hidden rounded-md border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.publicUrl}
                alt=""
                className="aspect-[4/3] w-full object-cover"
              />
              <button
                type="button"
                onClick={() => handleDelete(img.id)}
                className="absolute right-2 top-2 rounded-md bg-destructive/90 p-1.5 text-destructive-foreground opacity-0 transition-opacity hover:bg-destructive group-hover:opacity-100"
                aria-label="Eliminar foto"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Lee dimensiones del archivo en cliente (best-effort; null si falla). */
async function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
