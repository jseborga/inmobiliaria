'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  TenantPlan,
  updateTenantSchema,
  type TenantDetail,
  type UpdateTenantInput,
} from '@inmobiliaria/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateTenantAction } from '@/lib/actions/platform-tenants';

interface EditTenantFormProps {
  tenant: TenantDetail;
}

export function EditTenantForm({ tenant }: EditTenantFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<UpdateTenantInput>({
    resolver: zodResolver(updateTenantSchema),
    defaultValues: {
      name: tenant.name,
      plan: tenant.plan as TenantPlan,
      city: tenant.city ?? '',
      address: tenant.address ?? '',
      phone: tenant.phone ?? '',
      contactEmail: tenant.contactEmail ?? '',
    },
  });

  async function onSubmit(values: UpdateTenantInput) {
    setSubmitting(true);
    try {
      const res = await updateTenantAction(tenant.id, values);
      if (!res.ok) {
        if (res.error.fieldErrors) {
          for (const [field, msg] of Object.entries(res.error.fieldErrors)) {
            setError(field as keyof UpdateTenantInput, { message: msg });
          }
        }
        toast.error(res.error.message);
        return;
      }
      toast.success('Cambios guardados');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label="Nombre" error={errors.name?.message}>
          <Input id="name" {...register('name')} />
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

        <Field id="city" label="Ciudad" error={errors.city?.message}>
          <Input id="city" {...register('city')} />
        </Field>

        <Field id="phone" label="Teléfono" error={errors.phone?.message}>
          <Input id="phone" {...register('phone')} />
        </Field>

        <Field id="contactEmail" label="Email de contacto" error={errors.contactEmail?.message}>
          <Input id="contactEmail" type="email" {...register('contactEmail')} />
        </Field>

        <div className="sm:col-span-2">
          <Field id="address" label="Dirección" error={errors.address?.message}>
            <Input id="address" {...register('address')} />
          </Field>
        </div>
      </div>

      <div>
        <Button type="submit" disabled={submitting || !isDirty}>
          {submitting ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
