/**
 * Seed: crea el primer super-admin de plataforma.
 *
 * Uso:
 *   SUPER_ADMIN_EMAIL=admin@miapp.com \
 *   SUPER_ADMIN_PASSWORD="..." \
 *   SUPER_ADMIN_FIRST_NAME="Ana" \
 *   SUPER_ADMIN_LAST_NAME="Pérez" \
 *   pnpm --filter @inmobiliaria/api prisma:seed
 *
 * Idempotente: si ya existe un admin con ese email, no hace nada.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

async function main() {
  const email = requireEnv('SUPER_ADMIN_EMAIL').toLowerCase();
  const password = requireEnv('SUPER_ADMIN_PASSWORD');
  const firstName = process.env.SUPER_ADMIN_FIRST_NAME ?? 'Platform';
  const lastName = process.env.SUPER_ADMIN_LAST_NAME ?? 'Admin';

  if (password.length < 12) {
    throw new Error('SUPER_ADMIN_PASSWORD debe tener al menos 12 caracteres');
  }

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.platformAdmin.findUnique({ where: { email } });
    if (existing) {
      console.log(`[seed] PlatformAdmin ya existe: ${email} (id=${existing.id})`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const admin = await prisma.platformAdmin.create({
      data: { email, passwordHash, firstName, lastName },
      select: { id: true, email: true },
    });
    console.log(`[seed] PlatformAdmin creado: ${admin.email} (id=${admin.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val || !val.trim()) {
    throw new Error(`Variable de entorno requerida: ${key}`);
  }
  return val;
}

main().catch((err) => {
  console.error('[seed] Error:', err);
  process.exit(1);
});
