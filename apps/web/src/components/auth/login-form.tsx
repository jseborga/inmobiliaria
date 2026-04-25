'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { tenantLoginSchema, type TenantLoginInput } from '@inmobiliaria/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface LoginFormProps {
  /** Pre-fill del slug si el usuario entró desde un subdominio. */
  defaultTenantSlug?: string;
  /** Path a redirigir tras login (query `next`). */
  nextPath?: string;
  /** Si el slug viene del subdominio, lo escondemos del form. */
  lockTenantSlug?: boolean;
}

export function LoginForm({
  defaultTenantSlug,
  nextPath,
  lockTenantSlug,
}: LoginFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TenantLoginInput>({
    resolver: zodResolver(tenantLoginSchema),
    defaultValues: {
      tenantSlug: defaultTenantSlug ?? '',
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: TenantLoginInput) {
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg =
          (Array.isArray(body?.message) ? body.message.join(', ') : body?.message) ||
          'Credenciales inválidas';
        toast.error(msg);
        return;
      }
      toast.success('Sesión iniciada');
      router.push((nextPath as never) ?? '/admin');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {!lockTenantSlug ? (
        <div className="space-y-1.5">
          <Label htmlFor="tenantSlug">Inmobiliaria (slug)</Label>
          <Input
            id="tenantSlug"
            autoComplete="organization"
            placeholder="acme"
            {...register('tenantSlug')}
            aria-invalid={!!errors.tenantSlug}
          />
          {errors.tenantSlug ? (
            <p className="text-xs text-destructive">{errors.tenantSlug.message}</p>
          ) : null}
        </div>
      ) : (
        <input type="hidden" {...register('tenantSlug')} />
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          {...register('email')}
          aria-invalid={!!errors.email}
        />
        {errors.email ? (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register('password')}
          aria-invalid={!!errors.password}
        />
        {errors.password ? (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        ) : null}
      </div>

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? 'Ingresando…' : 'Iniciar sesión'}
      </Button>
    </form>
  );
}
