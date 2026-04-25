'use client';

import { useState } from 'react';
import { ImageIcon } from 'lucide-react';
import type { PropertyImageDto } from '@inmobiliaria/shared';
import { cn } from '@/lib/utils';

export function ImageGallery({
  images,
  alt,
}: {
  images: PropertyImageDto[];
  alt: string;
}) {
  const [active, setActive] = useState(0);

  if (!images.length) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-lg border bg-muted text-muted-foreground">
        <div className="flex flex-col items-center gap-2 text-sm">
          <ImageIcon className="h-8 w-8" />
          Sin fotos
        </div>
      </div>
    );
  }

  const current = images[Math.min(active, images.length - 1)] ?? images[0]!;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={current.id}
          src={current.publicUrl}
          alt={alt}
          className="aspect-[4/3] w-full object-cover"
        />
      </div>
      {images.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Foto ${i + 1}`}
              aria-current={i === active}
              className={cn(
                'h-20 w-28 shrink-0 overflow-hidden rounded-md border-2 transition-opacity',
                i === active ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100',
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.publicUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
