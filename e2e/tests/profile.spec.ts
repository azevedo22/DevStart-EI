import { expect, test } from '@playwright/test';
import { registerNewUser } from './helpers';

/** O perfil é o ponto de partida de uma conta nova. */
test('perfil: editar o título profissional e continua lá depois de recarregar', async ({
  page,
}) => {
  await registerNewUser(page, 'Ana Teste');
  await expect(page.getByText('Ainda sem título profissional')).toBeVisible();

  await page.getByRole('button', { name: 'Editar' }).first().click();
  await page
    .getByLabel('Título profissional')
    .fill('Recém-licenciada em Engenharia Informática');
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(
    page.getByText('Recém-licenciada em Engenharia Informática'),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText('Recém-licenciada em Engenharia Informática'),
  ).toBeVisible();
});
