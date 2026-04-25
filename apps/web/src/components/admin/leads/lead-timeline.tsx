import {
  Pencil,
  Phone,
  Mail,
  MessageSquare,
  Users,
  Sparkles,
  ArrowRightCircle,
  UserCheck,
} from 'lucide-react';
import {
  LeadActivityKind,
  type LeadActivityDto,
} from '@inmobiliaria/shared';
import { cn } from '@/lib/utils';

const ICONS: Record<LeadActivityKind, typeof Pencil> = {
  NOTE: Pencil,
  CALL: Phone,
  EMAIL: Mail,
  WHATSAPP: MessageSquare,
  MEETING: Users,
  CREATED: Sparkles,
  STATUS_CHANGE: ArrowRightCircle,
  ASSIGNMENT: UserCheck,
};

const LABEL: Record<LeadActivityKind, string> = {
  NOTE: 'Nota',
  CALL: 'Llamada',
  EMAIL: 'Email',
  WHATSAPP: 'WhatsApp',
  MEETING: 'Reunión',
  CREATED: 'Lead creado',
  STATUS_CHANGE: 'Cambio de estado',
  ASSIGNMENT: 'Asignación',
};

const SYSTEM_KINDS = new Set<LeadActivityKind>([
  LeadActivityKind.CREATED,
  LeadActivityKind.STATUS_CHANGE,
  LeadActivityKind.ASSIGNMENT,
]);

const dateFmt = new Intl.DateTimeFormat('es-BO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

interface LeadTimelineProps {
  activities: LeadActivityDto[];
}

/**
 * Timeline ordenado descendente (más reciente arriba).
 *
 * Distinguimos visualmente las actividades automáticas (CREATED,
 * STATUS_CHANGE, ASSIGNMENT) de las manuales: las del sistema usan
 * un estilo más sobrio y muestran el metadata estructurado.
 */
export function LeadTimeline({ activities }: LeadTimelineProps) {
  if (activities.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Sin actividad todavía.
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {activities.map((a) => {
        const Icon = ICONS[a.kind];
        const isSystem = SYSTEM_KINDS.has(a.kind);
        const author = a.author
          ? [a.author.firstName, a.author.lastName].filter(Boolean).join(' ') ||
            a.author.email
          : null;

        return (
          <li
            key={a.id}
            className={cn(
              'rounded-lg border bg-card p-4',
              isSystem && 'border-dashed bg-muted/30',
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'mt-0.5 rounded-full p-1.5',
                  isSystem ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <header className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {LABEL[a.kind]}
                  </span>
                  <time dateTime={a.createdAt}>{dateFmt.format(new Date(a.createdAt))}</time>
                </header>

                {a.body ? (
                  <p className="whitespace-pre-line text-sm">{a.body}</p>
                ) : null}

                {renderMetadata(a)}

                {author ? (
                  <p className="text-xs text-muted-foreground">por {author}</p>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function renderMetadata(a: LeadActivityDto): React.ReactNode {
  if (!a.metadata || typeof a.metadata !== 'object') return null;
  if (a.kind === LeadActivityKind.STATUS_CHANGE) {
    const m = a.metadata as { from?: string; to?: string };
    if (m.from && m.to) {
      return (
        <p className="text-xs text-muted-foreground">
          {m.from} → <span className="font-medium text-foreground">{m.to}</span>
        </p>
      );
    }
  }
  if (a.kind === LeadActivityKind.ASSIGNMENT) {
    const m = a.metadata as { from?: string | null; to?: string | null };
    return (
      <p className="text-xs text-muted-foreground">
        {m.from ? `de ${m.from}` : 'sin asignar'} →{' '}
        <span className="font-medium text-foreground">
          {m.to ?? 'sin asignar'}
        </span>
      </p>
    );
  }
  return null;
}
