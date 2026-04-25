import Link from 'next/link';
import { MapPin, BedDouble, Bath, Ruler } from 'lucide-react';
import type { PropertyDto, TenantSummary } from '@inmobiliaria/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { buildTenantUrl } from '@/lib/tenant-shared';
import {
  formatArea,
  formatPrice,
  propertyOperationLabel,
  propertyTypeLabel,
} from '@/lib/format';

interface PropertyCardProps {
  property: PropertyDto & { tenant?: TenantSummary };
  /** Si está presente, los links son cross-tenant (marketplace global). */
  crossTenant?: boolean;
}

export function PropertyCard({ property, crossTenant }: PropertyCardProps) {
  const cover = property.images?.[0];
  const location = [property.zone, property.city].filter(Boolean).join(', ');
  const tenantSlug = property.tenant?.slug;
  const detailPath = `/properties/${property.slug}`;
  const href =
    crossTenant && tenantSlug
      ? buildTenantUrl(tenantSlug, detailPath)
      : detailPath;

  // Cross-tenant navega a otro subdominio → <a>. Mismo tenant → next/link.
  const Wrapper: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className,
  }) =>
    crossTenant && tenantSlug ? (
      <a href={href} className={className}>
        {children}
      </a>
    ) : (
      <Link href={detailPath as never} className={className}>
        {children}
      </Link>
    );

  return (
    <Wrapper className="group block">
      <Card className="overflow-hidden transition-shadow hover:shadow-lg">
        <div className="relative aspect-[4/3] w-full bg-muted">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover.publicUrl}
              alt={property.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Sin foto
            </div>
          )}
          <div className="absolute left-2 top-2 flex gap-2">
            <Badge variant="secondary">
              {propertyOperationLabel[property.operation]}
            </Badge>
            <Badge variant="outline" className="bg-background/80 backdrop-blur">
              {propertyTypeLabel[property.type]}
            </Badge>
          </div>
        </div>
        <CardContent className="space-y-2 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-lg font-semibold tracking-tight">
              {formatPrice(property.price, property.currency, property.operation)}
            </p>
            {property.tenant ? (
              <span className="truncate text-xs text-muted-foreground">
                {property.tenant.name}
              </span>
            ) : null}
          </div>
          <h3 className="line-clamp-2 font-medium leading-tight">
            {property.title}
          </h3>
          {location ? (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{location}</span>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3 pt-1 text-sm text-muted-foreground">
            {property.bedrooms != null ? (
              <span className="flex items-center gap-1">
                <BedDouble className="h-4 w-4" />
                {property.bedrooms}
              </span>
            ) : null}
            {property.bathrooms != null ? (
              <span className="flex items-center gap-1">
                <Bath className="h-4 w-4" />
                {property.bathrooms}
              </span>
            ) : null}
            {formatArea(property.areaSqm) ? (
              <span className="flex items-center gap-1">
                <Ruler className="h-4 w-4" />
                {formatArea(property.areaSqm)}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Wrapper>
  );
}
