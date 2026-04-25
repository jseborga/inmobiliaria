import { test, expect } from '@playwright/test';

/**
 * Smoke de Fase 5.0:
 * - La home renderiza con el theme nuevo de shadcn.
 * - El middleware resuelve correctamente el contexto:
 *   - host raíz → marketplace
 *   - subdominio → tenant
 */

test('home global muestra contexto marketplace', async ({ page, baseURL }) => {
  await page.goto(baseURL!);
  await expect(page.getByRole('heading', { name: 'Inmobiliaria' })).toBeVisible();
  await expect(page.getByText(/Contexto detectado:/)).toContainText('marketplace');
});

test('subdominio se resuelve como tenant', async ({ page, baseURL }) => {
  // Reemplaza el host raíz por uno con subdominio.
  const tenantUrl = baseURL!.replace('//', '//acme.');
  await page.goto(tenantUrl);
  await expect(page.getByText(/Contexto detectado:/)).toContainText('tenant');
  await expect(page.getByText(/tenant acme/)).toBeVisible();
});
