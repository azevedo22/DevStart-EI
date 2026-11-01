import { expect, test } from '@playwright/test';
import { registerNewUser } from './helpers';

/** O fluxo principal: registar uma candidatura e acompanhá-la no Kanban. */
test('candidaturas: criar, mudar de coluna e continua lá depois de recarregar', async ({
  page,
}) => {
  await registerNewUser(page);
  await page.goto('/applications');

  await page.getByRole('button', { name: 'Nova candidatura' }).click();
  const form = page.getByRole('dialog');
  await form.getByLabel('Empresa').fill('Lumen Cloud');
  await form.getByLabel('Título da vaga').fill('Junior Backend Developer');
  await form.getByRole('button', { name: 'Adicionar ao quadro' }).click();
  await expect(form).toBeHidden();

  const card = page.getByRole('button', {
    name: 'Abrir Junior Backend Developer em Lumen Cloud',
  });
  // Cada coluna do quadro tem o nome do estado (aria-label).
  const column = (name: string) => page.getByLabel(name, { exact: true });
  await expect(
    column('Candidatado').getByRole('button', { name: /Lumen Cloud/ }),
  ).toBeVisible();

  // Mudar de coluna pelo detalhe (a alternativa ao arrastar, acessível por teclado).
  await card.click();
  await page.getByLabel('Coluna').selectOption({ label: 'Teste Técnico' });
  await page.keyboard.press('Escape');

  await expect(
    column('Teste Técnico').getByRole('button', { name: /Lumen Cloud/ }),
  ).toBeVisible();

  // Gravado no servidor, não só no ecrã.
  await page.reload();
  await expect(
    column('Teste Técnico').getByRole('button', { name: /Lumen Cloud/ }),
  ).toBeVisible();
  await expect(
    column('Candidatado').getByRole('button', { name: /Lumen Cloud/ }),
  ).toHaveCount(0);
});
