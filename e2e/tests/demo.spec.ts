import { expect, test } from '@playwright/test';

/**
 * A porta de entrada de quem avalia o projeto: "Experimentar sem registo" cria
 * uma conta de demonstração e os serviços preenchem-na por eventos (Redis).
 */
test('demonstração: entra sem registo, com dados de exemplo, e termina', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Experimentar sem registo' }).click();

  await expect(page).toHaveURL(/\/skill-gap/);
  await expect(page.getByText('Conta de demonstração')).toBeVisible();

  // O quadro chega preenchido pelo tracker-service (evento user.demo-created).
  await page.goto('/applications');
  await expect(
    page.getByRole('button', { name: /Abrir .* em Nimbus Software/ }),
  ).toBeVisible();

  // Terminar apaga a conta e volta ao início, sem sessão.
  await page.getByRole('button', { name: 'Terminar demonstração' }).click();
  await expect(page.getByText(/A demonstração terminou/)).toBeVisible();
  await page.goto('/applications');
  await expect(page).toHaveURL(/\/login/);
});
