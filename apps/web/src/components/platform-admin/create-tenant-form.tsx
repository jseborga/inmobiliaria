'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  TenantPlan,
  createTenantSchema,
  type CreateTenantInput,
} from '@inmobiliaria/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createTenantAction } from '@/lib/actions/platform-tenants';

export function CreateTenantForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CreateTenantInput>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: {
      slug: '',
      name: '',
      plan: TenantPlan.FREE,
      ownerEmail: '',
      ownerPassword: '',
      ownerFirstName: '',
      ownerLastName: '',
    },
  });

  async function onSubmit(values: CreateTenantInput) {
    setSubmitting(true);
    try {
      const res = await createTenantAction(values);
      if (!res.ok) {
        if (res.error.fieldErrors) {
          for (const [field, msg] of Object.entries(res.error.fieldErrors)) {
            setError(field as keyof CreateTenantInput, { message: msg });
          }
        }
        toast.error(res.error.message);
        return;
      }
      toast.success(`Inmobiliaria "${res.data.tenant.name}" creada`);
      router.push('/platform-admin' as never);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-muted-foreground">
          Datos de la inmobiliaria
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="slug" label="Slug (URL-safe)" placeholder="remax-lp" error={errors.slug?.message}>
            <Input id="slug" {...register('slug')} aria-invalid={!!errors.slug} />
          </Field>

          <Field id="name" label="Nombre" placeholder="Remax La Paz" error={errors.name?.message}>
            <Input id="name" {...register('name')} aria-invalid={!!errors.name} />
          </Field>

          <Field id="plan" label="Plan" error={errors.plan?.message}>
            <select
              id="plan"
              {...register('plan')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value={TenantPlan.FREE}>FREE</option>
              <option value={TenantPlan.PRO}>PRO</option>
            </select>
          </Field>

          <Field id="city" label="Ciudad (opcional)" error={errors.city?.message}>
            <Input id="city" {...register('city')} />
          </Field>

          <Field id="phone" label="Teléfono (opcional)" placeholder="+591 70000000" error={errors.phone?.message}>
            <Input id="phone" {...register('phone')} />
          </Field>

          <Field id="contactEmail" label="Email de contacto (opcional)" error={errors.contactEmail?.message}>
            <Input id="contactEmail" type="email" {...register('contactEmail')} />
          </Field>

          <div className="sm:col-span-2">
            <Field id="address" label="Dirección (opcional)" error={errors.address?.message}>
              <Input id="address" {...register('address')} />
            </Field>
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-lg border bg-muted/30 p-4">
        <legend className="-ml-2 px-2 text-sm font-semibold text-muted-foreground">
          Usuario OWNER inicial (la persona que va a administrar la inmobiliaria)
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="ownerFirstName" label="Nombre" error={errors.ownerFirstName?.message}>
            <Input id="ownerFirstName" {...register('ownerFirstName')} aria-invalid={!!errors.ownerFirstName} />
          </Field>

          <Field id="ownerLastName" label="Apellido" error={errors.ownerLastName?.message}>
            <Input id="ownerLastName" {...register('ownerLastName')} aria-invalid={!!errors.ownerLastName} />
          </Field>

          <Field id="ownerEmail" label="Email" error={errors.ownerEmail?.message}>
            <Input id="ownerEmail" type="email" {...register('ownerEmail')} aria-invalid={!!errors.ownerEmail} />
          </Field>

          <Field
            id="ownerPassword"
            label="Contraseña inicial"
            hint="Mínimo 8 caracteres. Pásasela al dueño después."
            error={errors.ownerPassword?.message}
          >
            <Input
              id="ownerPassword"
              type="text"
              autoComplete="off"
              {...register('ownerPassword')}
              aria-invalid={!!errors.ownerPassword}
            />
          </Field>
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creando…' : 'Crear inmobiliaria'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push('/platform-admin' as never)}
          disabled={submitting}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
  placeholder,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  placeholder?: string;
}) {
  void placeholder;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
