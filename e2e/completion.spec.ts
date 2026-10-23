import { test, expect, type Page } from './fixtures';

async function createList(page: Page, name = 'Compra teste') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova lista', exact: true }).click();
  await page.getByLabel('Nome da lista', { exact: true }).fill(name);
  await page.getByLabel('Orçamento da compra (R$)', { exact: true }).fill('8');
  await page.getByRole('button', { name: 'Criar lista', exact: true }).click();
  await page.getByRole('link', { name: `Abrir lista ${name}`, exact: true }).click();
  return page.url();
}
async function enterCategory(page: Page) {
  await page
    .getByRole('link')
    .filter({ has: page.getByRole('heading', { name: 'Essenciais', exact: true }) })
    .click();
}
async function addItem(page: Page, name: string) {
  const input = page.getByRole('textbox', { name: 'Adicionar item', exact: true });
  await input.fill(name);
  await input.press('Enter');
  await expect(input).toHaveValue('');
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}
async function seed(page: Page) {
  const overview = await createList(page);
  await enterCategory(page);
  await addItem(page, 'Café');
  await addItem(page, 'Feijão');
  await page.getByRole('checkbox', { name: 'Marcar Café como comprado' }).click();
  const form = page.getByRole('form', { name: 'Valores de Café' });
  await form.getByLabel('Preço por un (R$)', { exact: true }).fill('20');
  await form.getByLabel('Quantidade', { exact: true }).fill('0,5');
  await form.getByLabel('Unidade', { exact: true }).selectOption('kg');
  await form.getByRole('button', { name: 'Salvar valores', exact: true }).click();
  await expect(form).toHaveCount(0);
  const category = page.url();
  await page.getByRole('link', { name: 'Compra teste', exact: true }).click();
  return { overview, category };
}
async function openReview(page: Page) {
  await page.getByRole('button', { name: 'Finalizar compra', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Finalizar compra', exact: true });
  await expect(dialog.getByLabel('Total para finalizar', { exact: true })).toBeVisible();
  return dialog;
}
async function finish(page: Page) {
  const dialog = await openReview(page);
  await dialog.getByRole('button', { name: 'Confirmar finalização', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Compra finalizada', { exact: true })).toBeVisible();
}
async function exportBackup(page: Page) {
  await page.getByRole('link', { name: 'Dados e aplicativo', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar backup' }).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString());
}

test('finish, consult, reopen, correct and copy the same purchase on a narrow screen', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const { overview } = await seed(page);
  const dialog = await openReview(page);
  await expect(dialog.getByLabel('Total para finalizar', { exact: true })).toContainText('10,00');
  await expect(dialog.getByText('Comprados: 1 · Não comprados: 1', { exact: true })).toBeVisible();
  await expect(dialog.getByText(/Os produtos não comprados continuarão/)).toBeVisible();
  await expect(dialog.getByLabel('Saldo do orçamento', { exact: true })).toContainText(
    /Ultrapassou em.*2,00/,
  );
  await dialog.getByLabel(/Mercado/).fill('Mercado A');
  await dialog.getByLabel('Data da compra', { exact: true }).fill('2026-10-20');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await info.attach('review-mobile', { body: await page.screenshot(), contentType: 'image/png' });
  await dialog.getByRole('button', { name: 'Confirmar finalização', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Compra finalizada', { exact: true })).toBeVisible();
  await expect(page.getByText(/Mercado A/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ajustar orçamento', exact: true })).toHaveCount(0);
  await enterCategory(page);
  await expect(page.getByRole('checkbox')).toHaveCount(2);
  for (const box of await page.getByRole('checkbox').all()) await expect(box).toBeDisabled();
  await expect(page.getByRole('textbox', { name: 'Adicionar item', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Editar Café', exact: true })).toHaveCount(0);
  await expect(page.getByText('Não comprado', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Comparar', exact: true }).click();
  await page.getByRole('button', { name: 'Fechar comparador', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link', { name: 'Compra teste', exact: true }).click();
  await page.getByRole('button', { name: 'Reabrir compra', exact: true }).click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByText('Compra finalizada', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reabrir compra', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar reabertura', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Finalizar compra', exact: true })).toBeVisible();
  await enterCategory(page);
  await page.getByRole('button', { name: 'Editar Café', exact: true }).click();
  await page.getByLabel('Preço por kg (R$)', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Salvar item', exact: true }).click();
  await page.getByRole('link', { name: 'Compra teste', exact: true }).click();
  const corrected = await openReview(page);
  await expect(corrected.getByLabel(/Mercado/)).toHaveValue('Mercado A');
  await expect(corrected.getByLabel('Data da compra', { exact: true })).toHaveValue('2026-10-20');
  await corrected.getByRole('button', { name: 'Confirmar finalização', exact: true }).click();
  await expect(page.getByLabel('Total da lista', { exact: true })).toContainText('5,00');
  await page.getByRole('link', { name: 'Vértice, minhas listas', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Abrir lista Compra teste', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Finalizadas', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Abrir lista Compra teste', exact: true }),
  ).toContainText('5,00');
  await page.getByRole('button', { name: 'Copiar lista Compra teste', exact: true }).click();
  await page.getByLabel('Nome da lista', { exact: true }).fill('Próxima compra');
  await page.getByLabel('Orçamento da compra (R$)', { exact: true }).fill('');
  const prompts: string[] = [];
  page.on('dialog', async (d) => {
    prompts.push(d.message());
    await d.dismiss();
  });
  await page.getByRole('button', { name: 'Criar cópia', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Próxima compra', exact: true })).toBeVisible();
  expect(page.url()).not.toBe(overview);
  expect(prompts).toEqual([]);
  await expect(page.getByLabel('Total da lista', { exact: true })).toContainText('0,00');
  await expect(page.getByText('Sem orçamento definido', { exact: true })).toBeVisible();
  await enterCategory(page);
  for (const box of await page.getByRole('checkbox').all()) {
    await expect(box).not.toBeChecked();
    await expect(box).toBeEnabled();
  }
  await page.getByRole('button', { name: 'Editar Café', exact: true }).click();
  await expect(page.getByLabel('Quantidade', { exact: true })).toHaveValue('0,5');
  await expect(page.getByLabel('Unidade', { exact: true })).toHaveValue('kg');
  await expect(page.getByLabel('Preço por kg (R$)', { exact: true })).toHaveValue('0');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  const backup = await exportBackup(page);
  expect(backup.version).toBe(5);
  expect(backup.lists).toHaveLength(2);
  expect(backup.lists.filter((l: { status: string }) => l.status === 'completed')).toHaveLength(1);
  expect(backup.items).toHaveLength(4);
});

test('rejects empty/unpriced completion and cancellation preserves the active list', async ({
  page,
}) => {
  await createList(page);
  const empty = await openReview(page);
  await expect(
    empty.getByRole('button', { name: 'Confirmar finalização', exact: true }),
  ).toBeDisabled();
  await empty.getByRole('button', { name: 'Continuar comprando', exact: true }).click();
  await enterCategory(page);
  await addItem(page, 'Sem preço');
  await page.getByRole('checkbox', { name: 'Marcar Sem preço como comprado' }).click();
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('link', { name: 'Compra teste', exact: true }).click();
  const unpriced = await openReview(page);
  await expect(unpriced.getByRole('alert')).toContainText('Sem preço · Essenciais');
  await expect(
    unpriced.getByRole('button', { name: 'Confirmar finalização', exact: true }),
  ).toBeDisabled();
  await unpriced.getByRole('button', { name: 'Continuar comprando', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Finalizar compra', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Reabrir compra', exact: true })).toHaveCount(0);
});

test('concurrent review changes require confirmation and another tab keeps its unsaved price', async ({
  page,
  context,
}) => {
  const { category } = await seed(page);
  const second = await context.newPage();
  await second.goto(category);
  const metadata = await context.newPage();
  await metadata.goto('/');
  await metadata.getByRole('button', { name: 'Editar lista Compra teste', exact: true }).click();
  await metadata.getByLabel('Nome da lista', { exact: true }).fill('Rascunho preservado');
  const review = await openReview(page);
  await second.getByRole('button', { name: 'Editar Café', exact: true }).click();
  await second.getByLabel('Preço por kg (R$)', { exact: true }).fill('30');
  await second.getByRole('button', { name: 'Salvar item', exact: true }).click();
  await expect(review.getByLabel('Total para finalizar', { exact: true })).toContainText('15,00');
  await review.getByRole('button', { name: 'Conferir resumo atualizado', exact: true }).click();
  await expect(
    review.getByRole('button', { name: 'Confirmar finalização', exact: true }),
  ).toBeVisible();
  const checked = second.getByRole('checkbox', { name: 'Marcar Café como comprado' });
  await checked.click();
  await expect(checked).not.toBeChecked();
  await checked.click();
  await expect(checked).toBeChecked();
  const form = second.getByRole('form', { name: 'Valores de Café' });
  await form.getByLabel('Preço por kg (R$)', { exact: true }).fill('99');
  // Checkbox toggles are real writes; acknowledge their new revision first.
  await expect(
    review.getByRole('button', { name: 'Conferir resumo atualizado', exact: true }),
  ).toBeVisible();
  await review.getByRole('button', { name: 'Conferir resumo atualizado', exact: true }).click();
  await review.getByRole('button', { name: 'Confirmar finalização', exact: true }).click();
  await expect(page.getByText('Compra finalizada', { exact: true })).toBeVisible();
  await expect(form.getByLabel('Preço por kg (R$)', { exact: true })).toHaveValue('99');
  await expect(form.getByRole('button', { name: 'Salvar valores', exact: true })).toBeDisabled();
  await expect(form.getByText(/Seus valores digitados continuam aqui/)).toBeVisible();
  await expect(second.getByRole('checkbox', { name: 'Marcar Café como comprado' })).toBeDisabled();
  await expect(page.getByLabel('Total da lista', { exact: true })).toContainText('15,00');
  await expect(metadata.getByLabel('Nome da lista', { exact: true })).toHaveValue(
    'Rascunho preservado',
  );
  await expect(metadata.getByLabel('Nome da lista', { exact: true })).toHaveAttribute(
    'readonly',
    '',
  );
  await expect(
    metadata.getByRole('button', { name: 'Salvar alterações', exact: true }),
  ).toBeDisabled();
});

test('copies an active list from its overview without overwriting the source', async ({ page }) => {
  const { overview } = await seed(page);
  await page.getByRole('button', { name: 'Copiar lista', exact: true }).click();
  await expect(page.getByLabel('Nome da lista', { exact: true })).toHaveValue(
    'Compra teste — cópia',
  );
  await page.getByRole('button', { name: 'Criar cópia', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Compra teste — cópia', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Total da lista', { exact: true })).toContainText('0,00');
  await page.goto(overview);
  await expect(page.getByLabel('Total da lista', { exact: true })).toContainText('10,00');
  await expect(page.getByRole('button', { name: 'Finalizar compra', exact: true })).toBeVisible();
});

test('finalizes and copies offline, survives reload and restores the latest backup', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Offline service worker lifecycle is tested in Chromium.');
  const { overview } = await seed(page);
  await expect(page.getByText('Pronto para usar offline', { exact: true })).toBeVisible();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await finish(page);
  await page.reload();
  await expect(page.getByText('Compra finalizada', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Copiar lista', exact: true }).click();
  await page.getByRole('button', { name: 'Criar cópia', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Compra teste — cópia', exact: true }),
  ).toBeVisible();
  const copyUrl = page.url();
  await page.reload();
  await expect(page.getByLabel('Total da lista', { exact: true })).toContainText('0,00');
  expect(
    await page.evaluate(() =>
      fetch('/online.txt?completion-proof=1', { cache: 'no-store' }).then(
        () => true,
        () => false,
      ),
    ),
  ).toBe(false);
  const backup = await exportBackup(page);
  expect(backup.version).toBe(5);
  expect(backup.lists.map((l: { status: string }) => l.status).sort()).toEqual([
    'active',
    'completed',
  ]);
  await page.getByLabel('Arquivo de backup').setInputFiles({
    name: 'v4.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.getByRole('button', { name: 'Substituir e restaurar', exact: true }).click();
  await expect(page.getByText('Backup restaurado.', { exact: true })).toBeVisible();
  await page.goto(overview);
  await expect(page.getByText('Compra finalizada', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Total da lista', { exact: true })).toContainText('10,00');
  await page.goto(copyUrl);
  await expect(page.getByRole('button', { name: 'Finalizar compra', exact: true })).toBeVisible();
});
