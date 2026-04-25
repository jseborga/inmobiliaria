import { defineConfig, devices } from '@playwright/test';

/**
 * Config Playwright para apps/web.
 *
 * - `webServer` levanta `pnpm dev` automáticamente si no hay uno corriendo.
 * - Asume que la API ya está corriendo en localhost:3001 (la levanta
 *   docker-compose o `pnpm --filter @inmobiliaria/api dev`).
 * - Usamos `lvh.me` para subdominios reales en dev (resuelve a 127.0.0.1
 *   sin tocar /etc/hosts). Override con PLAYWRIGHT_BASE_URL si hace falta.
 */

const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://lvh.me:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_NO_SERVER
    ? undefined
    : {
        command: 'pnpm dev',
        url: `http://localhost:${PORT}`,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
        env: {
          NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api',
          NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? `lvh.me:${PORT}`,
        },
      },
});
