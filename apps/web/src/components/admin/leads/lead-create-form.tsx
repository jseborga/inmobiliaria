'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  LeadSource,
  LeadStatus,
  adminLeadCreateSchema,
  type AdminLeadCreateInput,
  type UserSummary,
} from '@inmobiliaria/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createLead } from '@/lib/actions/leads';
import { leadSourceLabel, leadStatusLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

interface LeadCreateFormProps {
  users: UserSummary[];
  /** Id del usuario actual, para preseleccionar en "Asignado a". */
  currentUserId?: string;
}

export function LeadCreateForm({ users, currentUserId }: LeadCreateFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<AdminLeadCreateInput>({
    resolver: zodResolver(adminLeadCreateSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      message: '',
      // Para registros manuales del admin, el default razonable es PHONE
      // (lead que entró por llamada). El usuario puede cambiar a otro.
      source: LeadSource.PHONE,
      status: LeadStatus.NEW,
      assignedUserId: currentUserId ?? '',
    },
  });

  async function onSubmit(values: AdminLeadCreateInput) {
    setServerError(null);
    const result = await createLead(values);
    if (!result.ok) {
      setServerError(result.error.message);
      if (result.error.fieldErrors) {
        for (const [path, msg] of Object.entries(result.error.fieldErrors)) {
          setError(path as keyof AdminLeadCreateInput, { type: 'server', message: msg });
        }
      }
      toast.error(result.error.message);
      return;
    }
    toast.success('Lead creado');
    router.push(`/admin/leads/${result.data.id}` as never);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {serverError ? (
        <p className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {serverError}
        </p>
      ) : null}

      <Section title="Contacto">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre *" name="firstName" register={register} error={errors.firstName?.message} />
          <Field label="Apellido" name="lastName" register={register} error={errors.lastName?.message} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Email" name="email" type="email" register={register} error={errors.email?.message} />
          <Field label="Teléfono" name="phone" placeholder="+591 7..." register={register} error={errors.phone?.message} />
        </div>
        <p className="text-xs text-muted-foreground">
          Necesitás al menos email o teléfono.
        </p>
      </Section>

      <Section title="Detalle">
        <div className="space-y-1.5">
          <Label htmlFor="message">Mensaje</Label>
          <Textarea id="message" rows={4} {...register('message')} />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <SelectField
            label="Origen"
            name="source"
            register={register}
            options={Object.values(LeadSource).map((s) => ({ value: s, label: leadSourceLabel[s] }))}
          />
          <SelectField
            label="Estado"
            name="status"
            register={register}
            options={Object.values(LeadStatus).map((s) => ({ value: s, label: leadStatusLabel[s] }))}
          />
          <SelectField
            label="Asignado a"
            name="assignedUserId"
            register={register}
            options={[
              { value: '', label: 'Sin asignar' },
              ...users.map((u) => ({
                value: u.id,
                label: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
              })),
            ]}
          />
        </div>
      </Section>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creando…' : 'Crear lead'}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-lg border bg-card p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  name,
  register,
  error,
  ...rest
}: {
  label: string;
  name: keyof AdminLeadCreateInput;
  register: ReturnType<typeof useForm<AdminLeadCreateInput>>['register'];
  error?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name'>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name as string}>{label}</Label>
      <Input id={name as string} {...register(name)} {...rest} aria-invalid={!!error} />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function SelectField({
  label,
  name,
  register,
  options,
}: {
  label: string;
  name: keyof AdminLeadCreateInput;
  register: ReturnType<typeof useForm<AdminLeadCreateInput>>['register'];
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name as string}>{label}</Label>
      <select
        id={name as string}
        {...register(name)}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
