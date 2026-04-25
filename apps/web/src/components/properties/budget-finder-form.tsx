'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Sparkles } from 'lucide-react';
import {
  Currency,
  PropertyOperation,
  PropertyType,
} from '@inmobiliaria/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { propertyOperationLabel, propertyTypeLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Form simple (sin pasos) que arma una URL de búsqueda con presupuesto.
 *
 * Decisión: NO usamos zod aquí porque los inputs son chicos y la validación
 * que importa la hace el server (`/properties` luego). Un input min y un
 * required en el button cubren el 90%.
 *
 * Submit → redirect a `/properties?view=map&fit=1&budget=...&maxPrice=...`
 *   - `fit=1` activa visualización con markers coloreados y badges
 *   - `budget` se conserva para calcular el ratio de fit
 *   - `maxPrice` excluye lo que está sobre el presupuesto
 */
export function BudgetFinderForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [operation, setOperation] = useState<PropertyOperation>(PropertyOperation.SALE);
  const [type, setType] = useState<PropertyType | ''>('');
  const [budget, setBudget] = useState<string>('');
  const [currency, setCurrency] = useState<Currency>(Currency.USD);
  const [city, setCity] = useState<string>('');
  const [bedrooms, setBedrooms] = useState<string>('');

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const budgetNum = Number(budget);
    if (!Number.isFinite(budgetNum) || budgetNum <= 0) return;

    const params = new URLSearchParams({
      view: 'map',
      fit: '1',
      budget: String(budgetNum),
      maxPrice: String(budgetNum),
      currency,
      operation,
    });
    if (type) params.set('type', type);
    if (city.trim()) params.set('city', city.trim());
    if (bedrooms) params.set('bedrooms', bedrooms);

    startTransition(() => {
      router.push(`/properties?${params.toString()}` as never);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-6 rounded-lg border bg-card p-6 shadow-sm"
    >
      <Section
        step="1"
        title="¿Qué tipo de operación buscás?"
      >
        <div className="grid gap-2 sm:grid-cols-3">
          {Object.values(PropertyOperation).map((op) => (
            <Pill
              key={op}
              active={operation === op}
              onClick={() => setOperation(op)}
            >
              {propertyOperationLabel[op]}
            </Pill>
          ))}
        </div>
      </Section>

      <Section step="2" title="¿Qué tipo de propiedad?">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Pill active={type === ''} onClick={() => setType('')}>
            Cualquiera
          </Pill>
          {Object.values(PropertyType).map((t) => (
            <Pill key={t} active={type === t} onClick={() => setType(t)}>
              {propertyTypeLabel[t]}
            </Pill>
          ))}
        </div>
      </Section>

      <Section step="3" title="¿Cuál es tu presupuesto máximo?">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="budget" className="sr-only">Presupuesto</Label>
            <Input
              id="budget"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              required
              placeholder="150000"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="text-lg"
            />
          </div>
          <div className="flex gap-1 rounded-md border bg-background p-1">
            {Object.values(Currency).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={cn(
                  'rounded px-3 py-1.5 text-sm font-medium transition-colors',
                  currency === c
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent',
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {currency === Currency.USD
            ? 'En dólares. Ej: 150000 (USD ciento cincuenta mil).'
            : 'En bolivianos. Ej: 1500000 (Bs un millón quinientos mil).'}
        </p>
      </Section>

      <Section step="4" title="Filtros opcionales">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="city">Ciudad o zona</Label>
            <Input
              id="city"
              placeholder="Santa Cruz, La Paz, Cochabamba..."
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bedrooms">Dormitorios mínimos</Label>
            <Input
              id="bedrooms"
              type="number"
              min={0}
              placeholder="2"
              value={bedrooms}
              onChange={(e) => setBedrooms(e.target.value)}
            />
          </div>
        </div>
      </Section>

      <Button
        type="submit"
        disabled={pending || !budget}
        size="lg"
        className="w-full"
      >
        <Sparkles className="mr-2 h-4 w-4" />
        {pending ? 'Buscando…' : 'Ver lo que está a mi alcance'}
      </Button>
    </form>
  );
}

function Section({
  step,
  title,
  children,
}: {
  step: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {step}
        </span>
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md border px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-input bg-background hover:bg-accent hover:text-accent-foreground',
      )}
    >
      {children}
    </button>
  );
}
