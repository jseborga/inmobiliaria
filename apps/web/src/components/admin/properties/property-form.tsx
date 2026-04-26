'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  Currency,
  PropertyOperation,
  PropertyType,
  propertyCreateSchema,
  type PropertyCreateInput,
  type PropertyDto,
} from '@inmobiliaria/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LocationPicker } from '@/components/map/location-picker';
import {
  createProperty,
  updateProperty,
} from '@/lib/actions/properties';
import {
  propertyOperationLabel,
  propertyTypeLabel,
} from '@/lib/format';
import { cn } from '@/lib/utils';

interface PropertyFormProps {
  /** Si está, el form edita; si no, crea. */
  property?: PropertyDto;
}

/**
 * Form de propiedad reusado por /admin/properties/new y /[id]/edit.
 *
 * Validación cliente con `propertyCreateSchema`. En modo edit, los mismos
 * campos son aceptados como `propertyUpdateSchema` (todos opcionales) por
 * el server action.
 */
export function PropertyForm({ property }: PropertyFormProps) {
  const router = useRouter();
  const isEdit = !!property;
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    watch,
    setValue,
  } = useForm<PropertyCreateInput>({
    resolver: zodResolver(propertyCreateSchema),
    defaultValues: property
      ? {
          slug: property.slug,
          title: property.title,
          description: property.description ?? '',
          operation: property.operation,
          type: property.type,
          price: Number(property.price),
          currency: property.currency,
          areaSqm: property.areaSqm != null ? Number(property.areaSqm) : undefined,
          bedrooms: property.bedrooms ?? undefined,
          bathrooms: property.bathrooms ?? undefined,
          parkingSpaces: property.parkingSpaces ?? undefined,
          city: property.city ?? '',
          zone: property.zone ?? '',
          address: property.address ?? '',
          latitude: property.latitude != null ? Number(property.latitude) : undefined,
          longitude: property.longitude != null ? Number(property.longitude) : undefined,
          videoUrl: property.videoUrl ?? '',
          tour360Url: property.tour360Url ?? '',
        }
      : {
          operation: PropertyOperation.SALE,
          type: PropertyType.HOUSE,
          currency: Currency.BOB,
        },
  });

  // Subscribimos lat/lng para que el LocationPicker se mantenga en sync con
  // ediciones manuales en los inputs de texto, y viceversa (set vía setValue).
  const watchedLat = watch('latitude');
  const watchedLng = watch('longitude');

  async function onSubmit(values: PropertyCreateInput) {
    setServerError(null);
    const result = isEdit
      ? await updateProperty(property!.id, values)
      : await createProperty(values);

    if (!result.ok) {
      setServerError(result.error.message);
      if (result.error.fieldErrors) {
        for (const [path, msg] of Object.entries(result.error.fieldErrors)) {
          setError(path as keyof PropertyCreateInput, { type: 'server', message: msg });
        }
      }
      toast.error(result.error.message);
      return;
    }

    toast.success(isEdit ? 'Cambios guardados' : 'Propiedad creada');
    if (isEdit) {
      router.refresh();
    } else {
      router.push(`/admin/properties/${result.data.id}/edit` as never);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {serverError ? (
        <p className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {serverError}
        </p>
      ) : null}

      <Section title="Datos principales">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Título *" name="title" error={errors.title?.message} register={register} />
          <Field
            label="Slug (opcional, se autogenera)"
            name="slug"
            placeholder="casa-en-equipetrol"
            error={errors.slug?.message}
            register={register}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Descripción</Label>
          <Textarea id="description" rows={5} {...register('description')} />
          {errors.description?.message ? (
            <p className="text-xs text-destructive">{errors.description.message}</p>
          ) : null}
        </div>
      </Section>

      <Section title="Operación y precio">
        <div className="grid gap-4 md:grid-cols-3">
          <SelectField
            label="Operación *"
            name="operation"
            register={register}
            options={Object.values(PropertyOperation).map((v) => ({
              value: v,
              label: propertyOperationLabel[v],
            }))}
          />
          <SelectField
            label="Tipo *"
            name="type"
            register={register}
            options={Object.values(PropertyType).map((v) => ({
              value: v,
              label: propertyTypeLabel[v],
            }))}
          />
          <SelectField
            label="Moneda"
            name="currency"
            register={register}
            options={Object.values(Currency).map((v) => ({ value: v, label: v }))}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Precio *"
            name="price"
            type="number"
            step="0.01"
            min={0}
            register={register}
            error={errors.price?.message}
          />
          <Field
            label="Superficie (m²)"
            name="areaSqm"
            type="number"
            step="0.01"
            min={0}
            register={register}
            error={errors.areaSqm?.message}
          />
        </div>
      </Section>

      <Section title="Distribución">
        <div className="grid gap-4 md:grid-cols-3">
          <Field
            label="Dormitorios"
            name="bedrooms"
            type="number"
            min={0}
            register={register}
            error={errors.bedrooms?.message}
          />
          <Field
            label="Baños"
            name="bathrooms"
            type="number"
            min={0}
            register={register}
            error={errors.bathrooms?.message}
          />
          <Field
            label="Parqueos"
            name="parkingSpaces"
            type="number"
            min={0}
            register={register}
            error={errors.parkingSpaces?.message}
          />
        </div>
      </Section>

      <Section title="Ubicación">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Ciudad" name="city" register={register} error={errors.city?.message} />
          <Field label="Zona" name="zone" register={register} error={errors.zone?.message} />
        </div>
        <Field label="Dirección" name="address" register={register} error={errors.address?.message} />

        <div className="space-y-2">
          <Label>Ubicación en el mapa</Label>
          <LocationPicker
            value={{
              lat: typeof watchedLat === 'number' && Number.isFinite(watchedLat) ? watchedLat : null,
              lng: typeof watchedLng === 'number' && Number.isFinite(watchedLng) ? watchedLng : null,
            }}
            onChange={(lat, lng) => {
              // setValue con shouldDirty para que RHF marque el form como modificado.
              // valueAsNumber:true ya lo manejan los inputs; acá pasamos el valor directo.
              setValue('latitude', lat ?? undefined, {
                shouldDirty: true,
                shouldValidate: true,
              });
              setValue('longitude', lng ?? undefined, {
                shouldDirty: true,
                shouldValidate: true,
              });
            }}
          />
          <p className="text-xs text-muted-foreground">
            También podés pegar las coordenadas directamente abajo (formato decimal, ej. de Google Maps).
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Latitud"
            name="latitude"
            type="number"
            step="0.000001"
            register={register}
            error={errors.latitude?.message}
          />
          <Field
            label="Longitud"
            name="longitude"
            type="number"
            step="0.000001"
            register={register}
            error={errors.longitude?.message}
          />
        </div>
      </Section>

      <Section title="Multimedia (videos y tour 360)">
        <p className="text-xs text-muted-foreground">
          Pegá links públicos. Aceptamos YouTube, Vimeo, Matterport, Kuula y similares.
          El video y el tour aparecen en la vista pública de la propiedad.
        </p>
        <Field
          label="Video (YouTube, Vimeo)"
          name="videoUrl"
          placeholder="https://www.youtube.com/watch?v=..."
          register={register}
          error={errors.videoUrl?.message}
        />
        <Field
          label="Tour 360 (Matterport, Kuula)"
          name="tour360Url"
          placeholder="https://my.matterport.com/show/?m=..."
          register={register}
          error={errors.tour360Url?.message}
        />
      </Section>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear propiedad'}
        </Button>
      </div>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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
  name: keyof PropertyCreateInput;
  register: ReturnType<typeof useForm<PropertyCreateInput>>['register'];
  error?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name'>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name as string}>{label}</Label>
      <Input
        id={name as string}
        {...register(name, rest.type === 'number' ? { valueAsNumber: true } : {})}
        {...rest}
        aria-invalid={!!error}
      />
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
  name: keyof PropertyCreateInput;
  register: ReturnType<typeof useForm<PropertyCreateInput>>['register'];
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
