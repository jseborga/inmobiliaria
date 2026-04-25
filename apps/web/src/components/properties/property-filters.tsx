'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import {
  Currency,
  PropertyOperation,
  PropertyType,
} from '@inmobiliaria/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  propertyOperationLabel,
  propertyTypeLabel,
} from '@/lib/format';

/**
 * Form de filtros del listado público. Sincroniza con la URL — los Server
 * Components leen `searchParams` y rehacen la consulta al backend.
 *
 * Decisión: usamos <select> nativo en vez del Select de shadcn/Radix para
 * que el form funcione 100% con FormData (submit normal) y no dependa del
 * estado JS — la URL es la fuente de verdad.
 */

type Option = { value: string; label: string };

const operationOptions: Option[] = Object.values(PropertyOperation).map((v) => ({
  value: v,
  label: propertyOperationLabel[v],
}));
const typeOptions: Option[] = Object.values(PropertyType).map((v) => ({
  value: v,
  label: propertyTypeLabel[v],
}));
const currencyOptions: Option[] = Object.values(Currency).map((v) => ({
  value: v,
  label: v,
}));

export interface PropertyFiltersValues {
  q?: string;
  operation?: string;
  type?: string;
  currency?: string;
  city?: string;
  minPrice?: string;
  maxPrice?: string;
  bedrooms?: string;
  bathrooms?: string;
}

export function PropertyFilters({
  initial,
}: {
  initial: PropertyFiltersValues;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function applyForm(form: HTMLFormElement) {
    const fd = new FormData(form);
    const next = new URLSearchParams();
    for (const [k, v] of fd.entries()) {
      const value = String(v).trim();
      if (value) next.set(k, value);
    }
    // Reset paginación en cualquier cambio de filtros.
    next.delete('skip');
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `?${qs}` : '?');
    });
  }

  function reset() {
    startTransition(() => {
      router.push('?');
    });
  }

  const hasFilters = Array.from(searchParams.keys()).some((k) => k !== 'take');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        applyForm(e.currentTarget);
      }}
      className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-2 lg:grid-cols-4"
    >
      <Field label="Búsqueda libre" name="q" defaultValue={initial.q} placeholder="Casa con piscina, Equipetrol..." />

      <SelectField
        label="Operación"
        name="operation"
        defaultValue={initial.operation}
        options={operationOptions}
      />

      <SelectField
        label="Tipo"
        name="type"
        defaultValue={initial.type}
        options={typeOptions}
      />

      <Field label="Ciudad" name="city" defaultValue={initial.city} placeholder="Santa Cruz" />

      <SelectField
        label="Moneda"
        name="currency"
        defaultValue={initial.currency}
        options={currencyOptions}
      />

      <Field
        label="Precio min."
        name="minPrice"
        type="number"
        min={0}
        defaultValue={initial.minPrice}
      />

      <Field
        label="Precio max."
        name="maxPrice"
        type="number"
        min={0}
        defaultValue={initial.maxPrice}
      />

      <div className="grid grid-cols-2 gap-2">
        <Field
          label="Dorm."
          name="bedrooms"
          type="number"
          min={0}
          defaultValue={initial.bedrooms}
        />
        <Field
          label="Baños"
          name="bathrooms"
          type="number"
          min={0}
          defaultValue={initial.bathrooms}
        />
      </div>

      <div className="col-span-full flex justify-end gap-2 pt-2">
        {hasFilters ? (
          <Button type="button" variant="ghost" onClick={reset} disabled={pending}>
            Limpiar
          </Button>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? 'Aplicando…' : 'Aplicar filtros'}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  ...rest
}: {
  label: string;
  name: string;
  defaultValue?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={defaultValue ?? ''} {...rest} />
    </div>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: Option[];
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue ?? ''}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
