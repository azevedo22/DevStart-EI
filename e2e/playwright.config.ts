import { defineConfig, devices } from '@playwright/test';

/**
 * Testes ponta a ponta: um browser a usar a aplicação inteira já arrancada
 * (frontend, nginx, gateway, serviços, PostgreSQL e Redis), como uma pessoa.
 *
 *   docker compose --profile app up -d --wait
 *   npm run e2e                              # http://localhost:8080
 *   E2E_BASE_URL=https://o-teu-dominio npm run e2e
 */
export default defineConfig({
  testDir: './tests',
  // Cada teste cria a sua própria conta: podem correr em paralelo.
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  // Na CI, uma segunda tentativa grava um trace para se perceber o que falhou.
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI']
    ? [['list'], ['html', { open: 'never', outputFolder: 'report' }]]
    : 'list',
  outputDir: 'results',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:8080',
    locale: 'pt-PT',
    timezoneId: 'Europe/Lisbon',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
