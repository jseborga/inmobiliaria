/**
 * Seed: garantiza que exista el super-admin de plataforma con las creds
 * que están en las envs. Hace UPSERT — si ya existe, sincroniza el
 * passwordHash y status. Esto permite "rotar" la password del super-admin
 * solo cambiando `SUPER_ADMIN_PASSWORD` y redeploy.
 *
 * Uso:
 *   SUPER_ADMIN_EMAIL=admin@miapp.com \
 *   SUPER_ADMIN_PASSWORD="..." \
 *   pnpm --filter @inmobiliaria/api prisma:seed
 *
 * En docker corre automáticamente cuando RUN_SEED_ON_BOOT=1.
 */
import { PlatformAdminStatus, PrismaClient } from '@prisma/client';
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

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const prisma = new PrismaClient();
  try {
    const admin = await prisma.platformAdmin.upsert({
      where: { email },
      update: {
        passwordHash,
        firstName,
        lastName,
        status: PlatformAdminStatus.ACTIVE,
      },
      create: {
        email,
        passwordHash,
        firstName,
        lastName,
        status: PlatformAdminStatus.ACTIVE,
      },
      select: { id: true, email: true, status: true },
    });
    console.log(
      `[seed] PlatformAdmin sincronizado: ${admin.email} (id=${admin.id}, status=${admin.status})`,
    );
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
