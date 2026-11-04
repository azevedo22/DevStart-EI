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

/**
 * A foto é pedida com o token e mostrada como URL local (blob:). Atrás do nginx,
 * a Content-Security-Policy tem de deixar passar blob:, senão a imagem não aparece.
 */
test('perfil: a foto carregada aparece (e continua depois de recarregar)', async ({
  page,
}) => {
  await registerNewUser(page, 'Rui Foto');

  // PNG de 64×64 desenhado no próprio browser (sem ficheiros de teste no repo).
  const png = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#1f3a5f';
    ctx.fillRect(0, 0, 64, 64);
    const blob = await new Promise<Blob>((r) =>
      c.toBlob((b) => r(b!), 'image/png'),
    );
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await page.locator('input[type="file"][accept^="image"]').setInputFiles({
    name: 'foto.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png),
  });

  const loaded = (img: HTMLImageElement) =>
    img.complete && img.naturalWidth > 0;
  const photo = page.getByRole('img', { name: 'Foto de perfil' });
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate(loaded)).toBe(true);

  await page.reload();
  await expect.poll(() => photo.evaluate(loaded)).toBe(true);
});
