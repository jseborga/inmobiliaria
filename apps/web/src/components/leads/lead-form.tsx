'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { publicLeadSchema, type PublicLeadInput } from '@inmobiliaria/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export interface LeadFormProps {
  /** Tenant resuelto en el server (subdominio o ?tenantSlug=) — se envía con el lead. */
  tenantSlug?: string;
  /** Property opcional asociada al lead (detalle de propiedad). */
  propertyId?: string;
  className?: string;
}

export function LeadForm({ tenantSlug, propertyId, className }: LeadFormProps) {
  const form = useForm<PublicLeadInput>({
    resolver: zodResolver(publicLeadSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      message: propertyId ? 'Hola, me interesa esta propiedad. ¿Podrían darme más información?' : '',
      tenantSlug,
      propertyId,
      source: 'WEB',
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isSubmitSuccessful },
    reset,
  } = form;

  async function onSubmit(values: PublicLeadInput) {
    // Limpiar strings vacíos que el backend prefiere como undefined.
    const payload = {
      ...values,
      email: values.email || undefined,
      phone: values.phone || undefined,
      lastName: values.lastName || undefined,
      message: values.message || undefined,
    };

    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg =
        (Array.isArray(body?.message) ? body.message.join(', ') : body?.message) ||
        body?.error ||
        'No pudimos enviar tu mensaje.';
      toast.error(msg);
      return;
    }

    toast.success('¡Mensaje enviado! Un asesor te contactará pronto.');
    reset({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      message: '',
      tenantSlug,
      propertyId,
      source: 'WEB',
    });
  }

  if (isSubmitSuccessful && !form.formState.isDirty) {
    // Mensaje persistente tras envío exitoso (además del toast).
    return (
      <div className={cn('rounded-lg border bg-emerald-50 p-6 text-emerald-900', className)}>
        <p className="font-medium">¡Mensaje enviado!</p>
        <p className="text-sm">
          Recibimos tus datos y un asesor te contactará pronto.
        </p>
        <Button
          variant="link"
          className="mt-2 h-auto p-0 text-emerald-900"
          onClick={() => reset()}
        >
          Enviar otra consulta
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={cn('space-y-4', className)}
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">Nombre *</Label>
          <Input id="firstName" {...register('firstName')} aria-invalid={!!errors.firstName} />
          {errors.firstName ? (
            <p className="text-xs text-destructive">{errors.firstName.message}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">Apellido</Label>
          <Input id="lastName" {...register('lastName')} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" inputMode="email" {...register('email')} aria-invalid={!!errors.email} />
          {errors.email ? (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Teléfono</Label>
          <Input id="phone" inputMode="tel" placeholder="+591 7..." {...register('phone')} aria-invalid={!!errors.phone} />
          {errors.phone ? (
            <p className="text-xs text-destructive">{errors.phone.message}</p>
          ) : null}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Debes proporcionar al menos email o teléfono.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="message">Mensaje</Label>
        <Textarea
          id="message"
          rows={4}
          {...register('message')}
          aria-invalid={!!errors.message}
        />
        {errors.message ? (
          <p className="text-xs text-destructive">{errors.message.message}</p>
        ) : null}
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Enviando…' : 'Enviar consulta'}
      </Button>
    </form>
  );
}
