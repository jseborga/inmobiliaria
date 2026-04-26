/**
 * Seed de demo: crea un tenant + OWNER + propiedades publicadas para
 * que el catálogo público tenga algo para mostrar y se pueda loguear
 * al panel sin pasar por el platform-admin.
 *
 * Idempotente: si el tenant `demo` ya existe, no toca nada.
 *
 * Uso:
 *   RUN_DEMO_SEED_ON_BOOT=1 (en el contenedor) → corre en boot.
 *   o manualmente:
 *     node prisma/dist/seed-demo.js
 *
 * Credenciales por defecto (overridables por env):
 *   slug:  demo
 *   email: demo@inmobiliaria.test
 *   pass:  DemoOwner12345!
 */
import { Prisma, PrismaClient, PropertyOperation, PropertyStatus, PropertyType, Currency, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

const TENANT_SLUG = (process.env.DEMO_TENANT_SLUG ?? 'demo').toLowerCase();
const TENANT_NAME = process.env.DEMO_TENANT_NAME ?? 'Demo Inmobiliaria';
const OWNER_EMAIL = (process.env.DEMO_OWNER_EMAIL ?? 'demo@inmobiliaria.test').toLowerCase();
const OWNER_PASSWORD = process.env.DEMO_OWNER_PASSWORD ?? 'DemoOwner12345!';
const OWNER_FIRST = process.env.DEMO_OWNER_FIRST_NAME ?? 'Demo';
const OWNER_LAST = process.env.DEMO_OWNER_LAST_NAME ?? 'Owner';

interface SeedProperty {
  slug: string;
  title: string;
  description: string;
  operation: PropertyOperation;
  type: PropertyType;
  price: number;
  currency: Currency;
  areaSqm?: number;
  bedrooms?: number;
  bathrooms?: number;
  parkingSpaces?: number;
  city: string;
  zone: string;
  address: string;
  latitude: number;
  longitude: number;
}

const PROPERTIES: SeedProperty[] = [
  {
    slug: 'casa-3-hab-calacoto',
    title: 'Casa de 3 habitaciones en Calacoto',
    description: 'Amplia casa familiar a estrenar, jardín privado, garage doble. Cerca de colegios y supermercados.',
    operation: PropertyOperation.SALE,
    type: PropertyType.HOUSE,
    price: 220000,
    currency: Currency.USD,
    areaSqm: 280,
    bedrooms: 3,
    bathrooms: 3,
    parkingSpaces: 2,
    city: 'La Paz',
    zone: 'Calacoto',
    address: 'Calle 15 esq. Av. Costanera',
    latitude: -16.5384,
    longitude: -68.0779,
  },
  {
    slug: 'depto-2-hab-sopocachi',
    title: 'Departamento 2 hab en Sopocachi',
    description: 'Luminoso depto en edificio con ascensor. Ideal pareja o profesional. Vista a la ciudad.',
    operation: PropertyOperation.RENT,
    type: PropertyType.APARTMENT,
    price: 4500,
    currency: Currency.BOB,
    areaSqm: 95,
    bedrooms: 2,
    bathrooms: 2,
    parkingSpaces: 1,
    city: 'La Paz',
    zone: 'Sopocachi',
    address: 'Av. Ecuador 2345',
    latitude: -16.5040,
    longitude: -68.1290,
  },
  {
    slug: 'casa-moderna-equipetrol',
    title: 'Casa moderna en Equipetrol Norte',
    description: 'Diseño contemporáneo, piscina, quincho, dormitorio en suite. Barrio cerrado con seguridad 24h.',
    operation: PropertyOperation.SALE,
    type: PropertyType.HOUSE,
    price: 385000,
    currency: Currency.USD,
    areaSqm: 420,
    bedrooms: 4,
    bathrooms: 4,
    parkingSpaces: 3,
    city: 'Santa Cruz',
    zone: 'Equipetrol Norte',
    address: 'Calle Los Cusis 120',
    latitude: -17.7634,
    longitude: -63.1858,
  },
  {
    slug: 'loft-las-palmas',
    title: 'Loft moderno en Las Palmas',
    description: 'Espacio abierto, mezzanine, totalmente amoblado. Listo para mudarse.',
    operation: PropertyOperation.RENT,
    type: PropertyType.APARTMENT,
    price: 850,
    currency: Currency.USD,
    areaSqm: 75,
    bedrooms: 1,
    bathrooms: 1,
    parkingSpaces: 1,
    city: 'Santa Cruz',
    zone: 'Las Palmas',
    address: 'Av. Banzer 4to anillo',
    latitude: -17.7459,
    longitude: -63.1612,
  },
  {
    slug: 'terreno-zona-sur-cbba',
    title: 'Terreno 600 m² en zona sur',
    description: 'Lote plano apto construcción, todos los servicios, calle asfaltada.',
    operation: PropertyOperation.SALE,
    type: PropertyType.LAND,
    price: 75000,
    currency: Currency.USD,
    areaSqm: 600,
    city: 'Cochabamba',
    zone: 'Zona Sur',
    address: 'Av. Petrolera Km 6',
    latitude: -17.4359,
    longitude: -66.1745,
  },
  {
    slug: 'casa-familiar-cala-cala',
    title: 'Casa familiar en Cala Cala',
    description: 'Tradicional casa de dos plantas, patio central, sala de estudio. Excelente ubicación.',
    operation: PropertyOperation.SALE,
    type: PropertyType.HOUSE,
    price: 1250000,
    currency: Currency.BOB,
    areaSqm: 320,
    bedrooms: 4,
    bathrooms: 3,
    parkingSpaces: 2,
    city: 'Cochabamba',
    zone: 'Cala Cala',
    address: 'C. Hamiraya 458',
    latitude: -17.3786,
    longitude: -66.1532,
  },
  {
    slug: 'anticretico-san-pedro',
    title: 'Anticrético depto 2 hab en San Pedro',
    description: 'Depto en buen estado, edificio céntrico, cerca de la Plaza San Pedro.',
    operation: PropertyOperation.ANTICRETICO,
    type: PropertyType.APARTMENT,
    price: 35000,
    currency: Currency.USD,
    areaSqm: 80,
    bedrooms: 2,
    bathrooms: 1,
    city: 'La Paz',
    zone: 'San Pedro',
    address: 'C. Colombia 789',
    latitude: -16.5102,
    longitude: -68.1395,
  },
  {
    slug: 'oficina-centro-lpz',
    title: 'Oficina A en pleno centro paceño',
    description: 'Piso 8, dos ambientes + sala de reunión, baño privado, ascensor.',
    operation: PropertyOperation.RENT,
    type: PropertyType.OFFICE,
    price: 1200,
    currency: Currency.USD,
    areaSqm: 110,
    bathrooms: 1,
    parkingSpaces: 1,
    city: 'La Paz',
    zone: 'Centro',
    address: 'Av. 16 de Julio 1490',
    latitude: -16.4998,
    longitude: -68.1336,
  },
];

async function main() {
  if (OWNER_PASSWORD.length < 12) {
    throw new Error('DEMO_OWNER_PASSWORD debe tener al menos 12 caracteres');
  }

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.tenant.findUnique({
      where: { slug: TENANT_SLUG },
      select: { id: true, name: true },
    });
    if (existing) {
      console.log(`[seed-demo] Tenant ya existe: ${TENANT_SLUG} (id=${existing.id}) — skip`);
      return;
    }

    const passwordHash = await bcrypt.hash(OWNER_PASSWORD, BCRYPT_ROUNDS);

    const tenant = await prisma.tenant.create({
      data: {
        slug: TENANT_SLUG,
        name: TENANT_NAME,
        city: 'La Paz',
        email: OWNER_EMAIL,
        users: {
          create: {
            email: OWNER_EMAIL,
            passwordHash,
            firstName: OWNER_FIRST,
            lastName: OWNER_LAST,
            role: UserRole.OWNER,
          },
        },
      },
      select: { id: true, slug: true, users: { select: { id: true } } },
    });
    const ownerId = tenant.users[0]!.id;
    console.log(`[seed-demo] Tenant creado: ${tenant.slug} (id=${tenant.id})`);
    console.log(`[seed-demo] OWNER: ${OWNER_EMAIL} / ${OWNER_PASSWORD}`);

    const now = new Date();
    for (const p of PROPERTIES) {
      await prisma.property.create({
        data: {
          tenantId: tenant.id,
          slug: p.slug,
          title: p.title,
          description: p.description,
          operation: p.operation,
          type: p.type,
          status: PropertyStatus.PUBLISHED,
          publishedAt: now,
          price: new Prisma.Decimal(p.price),
          currency: p.currency,
          areaSqm: p.areaSqm !== undefined ? new Prisma.Decimal(p.areaSqm) : null,
          bedrooms: p.bedrooms,
          bathrooms: p.bathrooms,
          parkingSpaces: p.parkingSpaces,
          city: p.city,
          zone: p.zone,
          address: p.address,
          latitude: new Prisma.Decimal(p.latitude),
          longitude: new Prisma.Decimal(p.longitude),
          createdById: ownerId,
        },
      });
    }
    console.log(`[seed-demo] ${PROPERTIES.length} propiedades publicadas.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[seed-demo] Error:', err);
  process.exit(1);
});
