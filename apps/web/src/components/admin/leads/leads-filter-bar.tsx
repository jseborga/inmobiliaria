'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { LeadSource, LeadStatus } from '@inmobiliaria/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { leadSourceLabel, leadStatusLabel } from '@/lib/format';

export interface LeadsFilterValues {
  q?: string;
  status?: string;
  source?: string;
  mine?: string;
}

export function LeadsFilterBar({
  initial,
}: {
  initial: LeadsFilterValues;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function apply(form: HTMLFormElement) {
    const fd = new FormData(form);
    const next = new URLSearchParams();
    for (const [k, v] of fd.entries()) {
      const value = String(v).trim();
      if (value) next.set(k, value);
    }
    next.delete('skip');
    const qs = next.toString();
    startTransition(() => router.push(qs ? `?${qs}` : '?'));
  }

  const hasFilters = Array.from(searchParams.keys()).some((k) => k !== 'take');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        apply(e.currentTarget);
      }}
      className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[2fr_1fr_1fr_auto_auto]"
    >
      <Input
        name="q"
        placeholder="Buscar por nombre, email, teléfono…"
        defaultValue={initial.q ?? ''}
      />
      <Select name="status" defaultValue={initial.status} placeholder="Estado">
        {Object.values(LeadStatus).map((s) => (
          <option key={s} value={s}>
            {leadStatusLabel[s]}
          </option>
        ))}
      </Select>
      <Select name="source" defaultValue={initial.source} placeholder="Origen">
        {Object.values(LeadSource).map((s) => (
          <option key={s} value={s}>
            {leadSourceLabel[s]}
          </option>
        ))}
      </Select>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="mine"
          value="1"
          defaultChecked={initial.mine === '1'}
          className="h-4 w-4 rounded border"
        />
        <span>Solo míos</span>
      </label>
      <div className="flex gap-2">
        {hasFilters ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => startTransition(() => router.push('?'))}
            disabled={pending}
          >
            Limpiar
          </Button>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? '…' : 'Filtrar'}
        </Button>
      </div>
    </form>
  );
}

function Select({
  name,
  defaultValue,
  placeholder,
  children,
}: {
  name: string;
  defaultValue?: string;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ''}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}

