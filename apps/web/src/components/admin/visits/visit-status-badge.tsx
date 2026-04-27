import type { VisitStatus } from '@inmobiliaria/shared';
import { cn } from '@/lib/utils';

const STYLES: Record<VisitStatus, { label: string; cls: string }> = {
  REQUESTED: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-900' },
  CONFIRMED: { label: 'Confirmada', cls: 'bg-emerald-100 text-emerald-900' },
  COMPLETED: { label: 'Realizada', cls: 'bg-blue-100 text-blue-900' },
  CANCELLED: { label: 'Cancelada', cls: 'bg-slate-200 text-slate-700' },
  NO_SHOW: { label: 'No vino', cls: 'bg-red-100 text-red-900' },
};

export function VisitStatusBadge({
  status,
  className,
}: {
  status: VisitStatus;
  className?: string;
}) {
  const cfg = STYLES[status];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        cfg.cls,
        className,
      )}
    >
      {cfg.label}
    </span>
  );
}
