import { expect, Page } from '@playwright/test';

/** Regista uma conta nova (email único) e espera pela página de perfil. */
export async function registerNewUser(
  page: Page,
  name = 'Teste E2E',
): Promise<{ email: string; password: string }> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = 'teste-e2e-2026';

  await page.goto('/register');
  await page.getByLabel('Nome').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Criar conta' }).click();

  await expect(page).toHaveURL(/\/profile/);
  return { email, password };
}
