import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { PropertyStatus, type PropertyDto } from '@inmobiliaria/shared';
import { Badge } from '@/components/ui/badge';
import { PropertyForm } from '@/components/admin/properties/property-form';
import { PropertyImages } from '@/components/admin/properties/property-images';
import { PropertyStatusActions } from '@/components/admin/properties/property-status-actions';
import { ApiError } from '@/lib/api';
import { getServerApi } from '@/lib/api/server';
import { requireUser } from '@/lib/auth/session';

interface PageProps {
  params: { id: string };
}

const STATUS_BADGE: Record<
  PropertyStatus,
  { variant: 'default' | 'success' | 'warning' | 'secondary'; label: string }
> = {
  DRAFT: { variant: 'warning', label: 'Borrador' },
  PUBLISHED: { variant: 'success', label: 'Publicada' },
  ARCHIVED: { variant: 'secondary', label: 'Archivada' },
};

async function fetchProperty(id: string): Promise<PropertyDto | null> {
  try {
    const api = getServerApi({ cache: 'no-store' });
    return await api.get<PropertyDto>(`/properties/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const p = await fetchProperty(params.id).catch(() => null);
  return { title: p ? `${p.title} — Admin` : 'Propiedad' };
}

export default async function EditPropertyPage({ params }: PageProps) {
  await requireUser(`/admin/properties/${params.id}/edit`);
  const property = await fetchProperty(params.id);
  if (!property) notFound();

  const status = STATUS_BADGE[property.status];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/admin/properties"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ChevronLeft className="h-4 w-4" />
        Volver al listado
      </Link>

      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{property.title}</h1>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          slug <span className="font-mono">{property.slug}</span>
        </p>
      </header>

      <PropertyStatusActions property={property} />

      <PropertyImages propertyId={property.id} images={property.images ?? []} />

      <PropertyForm property={property} />
    </div>
  );
}
