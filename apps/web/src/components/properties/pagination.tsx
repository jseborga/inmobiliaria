import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface PaginationProps {
  total: number;
  take: number;
  skip: number;
  /** SearchParams actuales para conservar filtros al cambiar de página. */
  searchParams: Record<string, string | string[] | undefined>;
}

export function Pagination({ total, take, skip, searchParams }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / take));
  const currentPage = Math.floor(skip / take) + 1;
  if (totalPages <= 1) return null;

  function buildHref(page: number): string {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v === undefined) continue;
      if (Array.isArray(v)) v.forEach((x) => next.append(k, x));
      else next.set(k, v);
    }
    if (page <= 1) next.delete('skip');
    else next.set('skip', String((page - 1) * take));
    const qs = next.toString();
    return qs ? `?${qs}` : '?';
  }

  const prev = currentPage > 1 ? buildHref(currentPage - 1) : null;
  const next = currentPage < totalPages ? buildHref(currentPage + 1) : null;

  return (
    <nav className="flex items-center justify-between gap-4 pt-2" aria-label="Paginación">
      <p className="text-sm text-muted-foreground">
        Página {currentPage} de {totalPages} · {total} resultado{total === 1 ? '' : 's'}
      </p>
      <div className="flex gap-2">
        <Button asChild={!!prev} variant="outline" disabled={!prev}>
          {prev ? <Link href={prev as never}>Anterior</Link> : <span>Anterior</span>}
        </Button>
        <Button asChild={!!next} variant="outline" disabled={!next}>
          {next ? <Link href={next as never}>Siguiente</Link> : <span>Siguiente</span>}
        </Button>
      </div>
    </nav>
  );
}
