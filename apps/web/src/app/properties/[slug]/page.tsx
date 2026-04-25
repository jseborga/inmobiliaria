import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BedDouble, Bath, Ruler, MapPin, Mail, Phone } from 'lucide-react';
import type { PropertyDto, TenantSummary } from '@inmobiliaria/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageGallery } from '@/components/properties/image-gallery';
import { LeadForm } from '@/components/leads/lead-form';
import { ApiError } from '@/lib/api';
import { getPublicApi } from '@/lib/api/public';
import {
  formatArea,
  formatPrice,
  propertyOperationLabel,
  propertyTypeLabel,
} from '@/lib/format';
import { getRequestContext } from '@/lib/tenant';

type PropertyDetail = PropertyDto & { tenant?: TenantSummary };

interface PageProps {
  params: { slug: string };
  searchParams: { tenantSlug?: string };
}

async function fetchProperty(
  slug: string,
  tenantSlug: string | undefined,
): Promise<PropertyDetail | null> {
  const api = getPublicApi({
    tenantSlug,
    tags: [`public-property:${tenantSlug ?? 'unknown'}:${slug}`],
  });
  try {
    return await api.get<PropertyDetail>(`/public/properties/${slug}`, {
      query: tenantSlug ? { tenantSlug } : undefined,
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const ctx = getRequestContext();
  const tenantSlug = searchParams.tenantSlug ?? ctx.tenantSlug ?? undefined;
  if (!tenantSlug) return { title: 'Propiedad' };
  const p = await fetchProperty(params.slug, tenantSlug).catch(() => null);
  if (!p) return { title: 'Propiedad' };
  return {
    title: p.title,
    description: p.description?.slice(0, 160) ?? `${propertyTypeLabel[p.type]} en ${propertyOperationLabel[p.operation]}`,
  };
}

export default async function PropertyDetailPage({
  params,
  searchParams,
}: PageProps) {
  const ctx = getRequestContext();
  const tenantSlug = searchParams.tenantSlug ?? ctx.tenantSlug ?? undefined;

  // Sin tenant, no podemos resolver el slug — el API tampoco. Mostramos guía
  // en vez de 404 a secas.
  if (!tenantSlug) {
    return (
      <main className="container mx-auto max-w-3xl space-y-4 px-6 py-16">
        <h1 className="text-2xl font-bold">Falta especificar la inmobiliaria</h1>
        <p className="text-muted-foreground">
          Para ver el detalle de una propiedad necesitamos saber a qué inmobiliaria
          pertenece. Volvé al{' '}
          <Link href="/properties" className="underline">
            catálogo
          </Link>{' '}
          y entrá desde una tarjeta.
        </p>
      </main>
    );
  }

  const property = await fetchProperty(params.slug, tenantSlug);
  if (!property) notFound();

  const location = [property.address, property.zone, property.city]
    .filter(Boolean)
    .join(', ');
  const tenant = property.tenant;

  return (
    <main className="container mx-auto max-w-6xl space-y-8 px-6 py-10">
      <nav className="text-sm text-muted-foreground">
        <Link href="/properties" className="hover:underline">
          Propiedades
        </Link>
        <span className="mx-2">/</span>
        <span>{property.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <ImageGallery images={property.images ?? []} alt={property.title} />

          <header className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge>{propertyOperationLabel[property.operation]}</Badge>
              <Badge variant="outline">{propertyTypeLabel[property.type]}</Badge>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{property.title}</h1>
            {location ? (
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {location}
              </p>
            ) : null}
            <p className="text-3xl font-semibold">
              {formatPrice(property.price, property.currency, property.operation)}
            </p>
          </header>

          <dl className="grid gap-3 rounded-lg border bg-card p-5 sm:grid-cols-3">
            {property.bedrooms != null ? (
              <Stat icon={<BedDouble className="h-4 w-4" />} label="Dormitorios" value={property.bedrooms} />
            ) : null}
            {property.bathrooms != null ? (
              <Stat icon={<Bath className="h-4 w-4" />} label="Baños" value={property.bathrooms} />
            ) : null}
            {formatArea(property.areaSqm) ? (
              <Stat icon={<Ruler className="h-4 w-4" />} label="Superficie" value={formatArea(property.areaSqm)!} />
            ) : null}
            {property.parkingSpaces != null ? (
              <Stat label="Parqueos" value={property.parkingSpaces} />
            ) : null}
          </dl>

          {property.description ? (
            <section className="space-y-2">
              <h2 className="text-xl font-semibold">Descripción</h2>
              <p className="whitespace-pre-line text-muted-foreground">
                {property.description}
              </p>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>¿Te interesa?</CardTitle>
              {tenant ? (
                <p className="text-sm text-muted-foreground">
                  Publicada por <span className="font-medium">{tenant.name}</span>
                </p>
              ) : null}
            </CardHeader>
            <CardContent>
              <LeadForm tenantSlug={tenantSlug} propertyId={property.id} />
            </CardContent>
          </Card>

          {tenant && (tenant.phone || tenant.email) ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contacto directo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {tenant.phone ? (
                  <a
                    href={`tel:${tenant.phone}`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <Phone className="h-4 w-4" />
                    {tenant.phone}
                  </a>
                ) : null}
                {tenant.email ? (
                  <a
                    href={`mailto:${tenant.email}`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <Mail className="h-4 w-4" />
                    {tenant.email}
                  </a>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </main>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-lg font-semibold">{value}</dd>
    </div>
  );
}
