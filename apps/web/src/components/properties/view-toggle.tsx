'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { LayoutGrid, Map as MapIcon, Columns2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ViewMode = 'list' | 'split' | 'map';

interface ViewToggleProps {
  current: ViewMode;
}

/**
 * Toggle Lista | Split | Mapa que conserva los demás searchParams al cambiar
 * de vista (filtros, paginación). Server-rendered URL → no necesita estado JS.
 *
 * - `list`  → solo cards en grilla (default).
 * - `split` → cards a la izquierda + mapa a la derecha (desktop). Mobile cae a list.
 * - `map`   → solo mapa fullwidth.
 */
export function ViewToggle({ current }: ViewToggleProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function buildHref(view: ViewMode): string {
    const next = new URLSearchParams(searchParams);
    if (view === 'list') next.delete('view');
    else next.set('view', view);
    const qs = next.toString();
    return `${pathname}${qs ? `?${qs}` : ''}`;
  }

  return (
    <div
      role="tablist"
      aria-label="Vista del catálogo"
      className="inline-flex rounded-md border bg-card p-1"
    >
      <Tab href={buildHref('list')} active={current === 'list'} icon={<LayoutGrid className="h-4 w-4" />}>
        Lista
      </Tab>
      <Tab href={buildHref('split')} active={current === 'split'} icon={<Columns2 className="h-4 w-4" />}>
        Split
      </Tab>
      <Tab href={buildHref('map')} active={current === 'map'} icon={<MapIcon className="h-4 w-4" />}>
        Mapa
      </Tab>
    </div>
  );
}

function Tab({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href as never}
      role="tab"
      aria-selected={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
