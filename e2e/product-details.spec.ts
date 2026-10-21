import { test, expect, type Page, type Locator } from '@playwright/test';

test.use({ hasTouch: true });
async function create(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova lista', exact: true }).click();
  await page.getByLabel('Nome da lista', { exact: true }).fill('Produtos');
  await page.getByRole('button', { name: 'Criar lista', exact: true }).click();
  await page.getByRole('link', { name: 'Abrir lista Produtos', exact: true }).click();
  const overview = page.url();
  await page.getByRole('link').filter({ has: page.getByRole('heading', { name: 'Essenciais', exact: true }) }).click();
  return { overview, category: page.url() };
}
async function add(page: Page, name: string) {
  const input = page.getByRole('textbox', { name: 'Adicionar item', exact: true });
  await input.fill(name); await input.press('Enter');
  await expect(input).toHaveValue(''); await expect(input).toBeFocused();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}
async function buy(page: Page, name: string) {
  await page.getByRole('checkbox', { name: `Marcar ${name} como comprado`, exact: true }).tap();
  const form = page.getByRole('form', { name: `Valores de ${name}`, exact: true });
  await expect(form.getByLabel('Preço por un (R$)', { exact: true })).toBeFocused();
  return form;
}
async function productFields(form: Locator, amount: string, unit: string, brand: string) {
  await form.getByLabel(/^Conteúdo por embalagem/).fill(amount);
  await form.getByLabel('Unidade do conteúdo', { exact: true }).selectOption(unit);
  await form.getByLabel(/^Marca/).fill(brand);
}
async function exportBackup(page: Page) {
  await page.getByRole('link', { name: 'Dados e aplicativo', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar backup' }).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString());
}

test('optional quick entry, automatic names, completed copies and independent clearing', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const { overview } = await create(page); await add(page, 'Café');
  let form = await buy(page, 'Café');
  await expect(form.getByLabel(/^Marca/)).toBeVisible();
  await form.getByLabel('Preço por un (R$)', { exact: true }).fill('18,90');
  await form.getByLabel('Preço por un (R$)', { exact: true }).press('Enter');
  await expect(form).toHaveCount(0);
  await page.getByRole('button', { name: 'Editar Café', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Editar item' });
  await editor.getByLabel('Quantidade', { exact: true }).fill('3');
  await productFields(editor, '500', 'g', 'Marca X');
  await expect(editor.getByLabel('Prévia do nome')).toContainText('Café · Marca X · 500 g');
  await expect(page.getByRole('heading', { name: 'Café · Marca X · 500 g', exact: true })).toHaveCount(0);
  await editor.getByRole('button', { name: 'Salvar item', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Café · Marca X · 500 g', exact: true })).toBeVisible();
  await expect(page.getByLabel('Total da categoria', { exact: true })).toContainText('56,70');
  // The same quick form reopens with metadata and still focuses/selects the price.
  const checked = page.getByRole('checkbox', { name: 'Marcar Café · Marca X · 500 g como comprado', exact: true });
  await checked.tap(); await expect(checked).not.toBeChecked();
  form = await buy(page, 'Café · Marca X · 500 g');
  await expect(form.getByLabel(/^Marca/)).toHaveValue('Marca X');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await form.getByRole('button', { name: 'Salvar valores', exact: true }).tap({ trial: true });
  await info.attach('product-details-mobile', { body: await page.screenshot(), contentType: 'image/png' });
  await form.getByRole('button', { name: 'Salvar valores', exact: true }).tap();
  await page.getByRole('link', { name: '← Produtos', exact: true }).click();
  await expect(page.getByText(/Café · Marca X · 500 g/)).toBeVisible();
  await page.getByRole('button', { name: 'Finalizar compra', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar finalização', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Copiar lista', exact: true }).click();
  await page.getByRole('button', { name: 'Criar cópia', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Produtos — cópia', exact: true })).toBeVisible();
  await page.getByRole('link').filter({ has: page.getByRole('heading', { name: 'Essenciais', exact: true }) }).click();
  await expect(page.getByRole('heading', { name: 'Café · Marca X · 500 g', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Editar Café · Marca X · 500 g', exact: true }).click();
  await expect(page.getByLabel('Nome do item', { exact: true })).toHaveValue('Café');
  await expect(page.getByLabel('Preço por un (R$)', { exact: true })).toHaveValue('0');
  await page.getByLabel(/^Marca/).fill('');
  await page.getByRole('button', { name: 'Salvar item', exact: true }).click();
  await page.getByRole('button', { name: 'Editar Café · 500 g', exact: true }).click();
  await page.getByLabel(/^Conteúdo por embalagem/).fill('');
  await page.getByRole('button', { name: 'Salvar item', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Café', exact: true })).toBeVisible();
  await page.goto(overview);
  await expect(page.getByText('Compra finalizada', { exact: true })).toBeVisible();
  await expect(page.getByText(/Café · Marca X · 500 g/)).toBeVisible();
  await expect(page.getByLabel('Total da lista', { exact: true })).toContainText('56,70');
});

test('billing by weight/volume stays independent and package counts require whole values', async ({ page }) => {
  await create(page); await add(page, 'Banana');
  let form = await buy(page, 'Banana');
  await form.getByLabel('Preço por un (R$)', { exact: true }).fill('8');
  await form.getByLabel('Quantidade', { exact: true }).fill('1,5');
  await form.getByLabel('Unidade', { exact: true }).selectOption('kg');
  await productFields(form, '0,5', 'kg', '');
  await form.getByRole('button', { name: 'Salvar valores', exact: true }).click();
  await expect(page.getByLabel('Total da categoria', { exact: true })).toContainText('12,00');
  await add(page, 'Leite'); form = await buy(page, 'Leite');
  await form.getByLabel('Preço por un (R$)', { exact: true }).fill('5');
  await form.getByLabel('Quantidade', { exact: true }).fill('2');
  await form.getByLabel('Unidade', { exact: true }).selectOption('L');
  await productFields(form, '500', 'ml', 'X');
  await form.getByRole('button', { name: 'Salvar valores', exact: true }).click();
  await expect(page.getByLabel('Total da categoria', { exact: true })).toContainText('22,00');
  await add(page, 'Ovos'); form = await buy(page, 'Ovos');
  await form.getByLabel('Preço por un (R$)', { exact: true }).fill('10');
  await productFields(form, '1,5', 'un', '');
  await form.getByRole('button', { name: 'Salvar valores', exact: true }).click();
  await expect(form.getByLabel(/^Conteúdo por embalagem/)).toHaveAttribute('aria-invalid', 'true');
  await expect(form.getByRole('alert')).toContainText('inteira');
  await form.getByLabel(/^Conteúdo por embalagem/).fill('12');
  await form.getByRole('button', { name: 'Salvar valores', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ovos · 12 un', exact: true })).toBeVisible();
  await expect(page.getByLabel('Total da categoria', { exact: true })).toContainText('32,00');
});

test('price-only save keeps another tab details and finalization detects a metadata-only change', async ({ page, context }) => {
  const { overview, category } = await create(page); await add(page, 'Café');
  const second = await context.newPage(); await second.goto(category);
  const local = await buy(page, 'Café');
  await local.getByLabel('Preço por un (R$)', { exact: true }).fill('30');
  await second.getByRole('button', { name: 'Editar Café', exact: true }).click();
  await productFields(second.getByRole('dialog'), '500', 'g', 'Marca X');
  await second.getByRole('button', { name: 'Salvar item', exact: true }).click();
  const liveForm = page.getByRole('form', { name: /^Valores de/ });
  await expect(page.getByRole('heading', { name: 'Café · Marca X · 500 g', exact: true })).toBeVisible();
  await expect(liveForm.getByLabel(/^Marca/)).toHaveValue('');
  await liveForm.getByRole('button', { name: 'Salvar valores', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Café · Marca X · 500 g', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '← Produtos', exact: true }).click();
  await page.getByRole('button', { name: 'Finalizar compra', exact: true }).click();
  const review = page.getByRole('dialog');
  await expect(review.getByLabel('Total para finalizar', { exact: true })).toContainText('30,00');
  await expect(second.getByLabel('Total da categoria', { exact: true })).toContainText('30,00');
  await second.getByRole('button', { name: 'Editar Café · Marca X · 500 g', exact: true }).click();
  await second.getByLabel(/^Marca/).fill('Marca Y');
  await second.getByRole('button', { name: 'Salvar item', exact: true }).click();
  await expect(review.getByRole('button', { name: 'Conferir resumo atualizado', exact: true })).toBeVisible();
  await review.getByRole('button', { name: 'Conferir resumo atualizado', exact: true }).click();
  await review.getByRole('button', { name: 'Confirmar finalização', exact: true }).click();
  await expect(page.getByText('Compra finalizada', { exact: true })).toBeVisible();
  await expect(second.getByRole('checkbox')).toBeDisabled();
  expect(page.url()).toBe(overview);
});

test('metadata persists offline and in v5 backup restoration, including completed copies', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Offline worker lifecycle is verified in Chromium.');
  const { overview } = await create(page); await add(page, 'Café');
  await expect(page.getByText('Pronto para usar offline', { exact: true })).toBeVisible();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  const form = await buy(page, 'Café');
  await form.getByLabel('Preço por un (R$)', { exact: true }).fill('18,90');
  await form.getByLabel('Quantidade', { exact: true }).fill('3');
  await productFields(form, '500', 'g', 'Marca X');
  await form.getByRole('button', { name: 'Salvar valores', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Café · Marca X · 500 g', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '← Produtos', exact: true }).click();
  await page.getByRole('button', { name: 'Finalizar compra', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar finalização', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const backup = await exportBackup(page);
  expect(backup.version).toBe(5);
  expect(backup.items[0]).toMatchObject({ name: 'Café', brand: 'Marca X', packageContent: { amount: '500', unit: 'g' } });
  await page.getByLabel('Arquivo de backup').setInputFiles({ name: 'v5.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await page.getByRole('button', { name: 'Substituir e restaurar', exact: true }).click();
  await expect(page.getByText('Backup restaurado.', { exact: true })).toBeVisible();
  await page.goto(overview);
  await expect(page.getByText(/Café · Marca X · 500 g/)).toBeVisible();
  await page.getByRole('button', { name: 'Copiar lista', exact: true }).click();
  await page.getByRole('button', { name: 'Criar cópia', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Produtos — cópia', exact: true })).toBeVisible();
  await expect(page.getByLabel('Total da lista', { exact: true })).toContainText('0,00');
  await expect(page.getByText(/Café · Marca X · 500 g/)).toBeVisible();
  expect(await page.evaluate(() => fetch('/online.txt?details-proof=1', { cache: 'no-store' }).then(() => true, () => false))).toBe(false);
});
