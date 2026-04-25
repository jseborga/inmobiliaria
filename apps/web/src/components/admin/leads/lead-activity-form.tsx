'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  LeadActivityKind,
  leadActivityCreateSchema,
  type LeadActivityCreateInput,
} from '@inmobiliaria/shared';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { addLeadActivity } from '@/lib/actions/leads';
import { cn } from '@/lib/utils';

const ACTIVITY_LABEL: Record<LeadActivityKind, string> = {
  NOTE: 'Nota',
  CALL: 'Llamada',
  EMAIL: 'Email',
  WHATSAPP: 'WhatsApp',
  MEETING: 'Reunión',
  STATUS_CHANGE: 'Cambio de estado',
  ASSIGNMENT: 'Asignación',
  CREATED: 'Creado',
};

/** Solo los kinds manuales — los automáticos los emite el API. */
const MANUAL_KINDS: LeadActivityKind[] = [
  LeadActivityKind.NOTE,
  LeadActivityKind.CALL,
  LeadActivityKind.EMAIL,
  LeadActivityKind.WHATSAPP,
  LeadActivityKind.MEETING,
];

export function LeadActivityForm({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LeadActivityCreateInput>({
    resolver: zodResolver(leadActivityCreateSchema),
    defaultValues: { kind: LeadActivityKind.NOTE, body: '' },
  });

  async function onSubmit(values: LeadActivityCreateInput) {
    setServerError(null);
    const r = await addLeadActivity(leadId, values);
    if (!r.ok) {
      setServerError(r.error.message);
      toast.error(r.error.message);
      return;
    }
    toast.success('Actividad registrada');
    reset({ kind: values.kind, body: '' });
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-3 rounded-lg border bg-card p-4"
      noValidate
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold">Registrar actividad</h3>
        <select
          {...register('kind')}
          className={cn(
            'h-9 rounded-md border border-input bg-background px-3 text-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          {MANUAL_KINDS.map((k) => (
            <option key={k} value={k}>
              {ACTIVITY_LABEL[k]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="body" className="sr-only">
          Detalle
        </Label>
        <Textarea
          id="body"
          rows={3}
          placeholder="Detalle de la conversación, próximos pasos…"
          {...register('body')}
          aria-invalid={!!errors.body}
        />
        {errors.body?.message ? (
          <p className="text-xs text-destructive">{errors.body.message}</p>
        ) : null}
      </div>

      {serverError ? (
        <p className="text-xs text-destructive">{serverError}</p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : 'Registrar'}
        </Button>
      </div>
    </form>
  );
}
