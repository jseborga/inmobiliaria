'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import {
  PropertyOperation,
  PropertyStatus,
  PropertyType,
} from '@inmobiliaria/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  propertyOperationLabel,
  propertyTypeLabel,
} from '@/lib/format';

const STATUS_LABEL: Record<PropertyStatus, string> = {
  DRAFT: 'Borrador',
  PUBLISHED: 'Publicada',
  ARCHIVED: 'Archivada',
};

export interface PropertiesFilterValues {
  q?: string;
  status?: string;
  operation?: string;
  type?: string;
}

export function PropertiesFilterBar({
  initial,
}: {
  initial: PropertiesFilterValues;
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
      className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[2fr_1fr_1fr_1fr_auto]"
    >
      <Input
        name="q"
        placeholder="Buscar por título, ciudad, zona…"
        defaultValue={initial.q ?? ''}
      />
      <Select name="status" defaultValue={initial.status} placeholder="Estado">
        {(Object.keys(STATUS_LABEL) as PropertyStatus[]).map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </Select>
      <Select name="operation" defaultValue={initial.operation} placeholder="Operación">
        {Object.values(PropertyOperation).map((s) => (
          <option key={s} value={s}>
            {propertyOperationLabel[s]}
          </option>
        ))}
      </Select>
      <Select name="type" defaultValue={initial.type} placeholder="Tipo">
        {Object.values(PropertyType).map((s) => (
          <option key={s} value={s}>
            {propertyTypeLabel[s]}
          </option>
        ))}
      </Select>
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
