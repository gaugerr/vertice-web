import { test, expect, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

async function createList(page: Page, name = 'Compra da semana', budget = '') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova lista', exact: true }).click();
  await page.getByLabel('Nome da lista', { exact: true }).fill(name);
  if (budget) await page.getByLabel('Orçamento da compra (R$)', { exact: true }).fill(budget);
  await page.getByRole('button', { name: 'Criar lista', exact: true }).click();
  await page.getByRole('link', { name: `Abrir lista ${name}` }).click();
  await expect(page.getByRole('heading', { name: 'Por categoria' })).toBeVisible();
  await page
    .getByRole('link')
    .filter({ has: page.getByRole('heading', { name: 'Essenciais', exact: true }) })
    .click();
}
async function addItem(page: Page, name: string) {
  await page.getByRole('textbox', { name: 'Adicionar item', exact: true }).fill(name);
  await page.getByRole('button', { name: 'Adicionar item', exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}
test.describe('fast entry with touch input', () => {
  test.use({ hasTouch: true });

  test('continuous names and a selected decimal price directly from the checkbox', async ({
    page,
  }, info) => {
    await createList(page);
    const input = page.getByRole('textbox', { name: 'Adicionar item', exact: true });
    await input.fill('Arroz rápido');
    await input.press('Enter');
    await expect(input).toHaveValue('');
    await expect(input).toBeFocused();
    await page.keyboard.type('Feijão rápido');
    await page.getByRole('button', { name: 'Adicionar item', exact: true }).tap();
    await expect(input).toHaveValue('');
    await expect(input).toBeFocused();
    await page.keyboard.type('Leite rápido');
    await input.press('Enter');
    await expect(page.getByRole('heading', { name: /rápido/ })).toHaveCount(3);

    await page.getByRole('button', { name: 'Pendentes', exact: true }).tap();
    const checked = page.getByRole('checkbox', { name: 'Marcar Arroz rápido como comprado' });
    await checked.tap();
    await expect(checked).toBeChecked();
    const form = page.getByRole('form', { name: 'Valores de Arroz rápido' });
    const price = form.getByLabel('Preço por un (R$)', { exact: true });
    await expect(price).toBeFocused();
    expect(
      await price.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd]),
    ).toEqual([0, 1]);
    await page.keyboard.type('12,50');
    await expect(price).toHaveValue('12,50');
    await form.getByLabel('Quantidade', { exact: true }).fill('0,5');
    await form.getByLabel('Unidade', { exact: true }).selectOption('kg');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    // The floating total must never cover the price editor or its save action.
    await form.getByRole('button', { name: 'Salvar valores' }).tap({ trial: true });
    await info.attach('quick-price-mobile', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await form.getByLabel('Preço por kg (R$)', { exact: true }).press('Enter');
    await expect(form).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Arroz rápido', exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Total da categoria', { exact: true })).toHaveText(/6,25/);

    await page.getByRole('button', { name: 'Comprados', exact: true }).tap();
    await checked.tap();
    await expect(page.getByLabel('Total da categoria', { exact: true })).toHaveText(/0,00/);
    await expect(page.getByRole('form', { name: 'Valores de Arroz rápido' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Todos', exact: true }).tap();
    await page.reload();
    await checked.tap();
    const savedPrice = page.getByLabel('Preço por kg (R$)', { exact: true });
    await expect(savedPrice).toHaveValue('12,5');
    await expect(savedPrice).toBeFocused();
    expect(
      await savedPrice.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd]),
    ).toEqual([0, 4]);
    await page.getByRole('button', { name: 'Fechar', exact: true }).tap();
  });
});
test('shopping CRUD, direct routes, money and accessible form focus', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await createList(page);
  await addItem(page, 'Arroz');
  await page.getByRole('button', { name: 'Editar Arroz', exact: true }).click();
  await expect(page.getByLabel('Nome do item', { exact: true })).toBeFocused();
  await page.getByLabel('Quantidade', { exact: true }).fill('0,5');
  await page.getByLabel('Unidade', { exact: true }).selectOption('kg');
  await page.getByLabel('Preço por kg (R$)', { exact: true }).fill('20,00');
  await page.getByRole('button', { name: 'Salvar item' }).click();
  await expect(page.getByLabel('Total da categoria', { exact: true })).toHaveText(/0,00/);
  // The checkbox reflects the committed IndexedDB write, not an optimistic DOM toggle.
  const purchased = page.getByRole('checkbox', { name: 'Marcar Arroz como comprado' });
  await purchased.click();
  await expect(purchased).toBeChecked();
  await expect(page.getByLabel('Total da categoria', { exact: true })).toHaveText(/10,00/);
  await expect(page.getByLabel('Preço por kg (R$)', { exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  const route = page.url();
  await page.reload();
  await expect(page.getByRole('checkbox')).toBeChecked();
  expect(page.url()).toBe(route);
  await page.getByRole('button', { name: 'Editar Arroz', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Editar Arroz', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Excluir Arroz', exact: true }).click();
  await page.getByRole('button', { name: 'Excluir item', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Arroz', exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('real offline writes, closing the tab, reopening and exporting records', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Installation/offline behavior is verified in Chromium; WebKit CRUD is separate.',
  );
  await createList(page);
  await addItem(page, 'Arroz');
  await expect(page.getByText('Pronto para usar offline', { exact: true })).toBeVisible();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const route = page.url();
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Definir orçamento', exact: true }).click();
  await page.getByLabel('Orçamento da compra (R$)', { exact: true }).fill('7,50');
  await page.getByRole('button', { name: 'Salvar orçamento', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await addItem(page, 'Feijão offline');
  await page.getByRole('checkbox', { name: 'Marcar Feijão offline como comprado' }).click();
  const values = page.getByRole('form', { name: 'Valores de Feijão offline' });
  await expect(values.getByLabel('Preço por un (R$)')).toBeFocused();
  await values.getByLabel('Preço por un (R$)').fill('4,25');
  await values.getByLabel('Quantidade', { exact: true }).fill('2');
  await values.getByRole('button', { name: 'Salvar valores' }).click();
  await expect(values).toHaveCount(0);
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto(route);
  await expect(
    reopened.getByRole('heading', { name: 'Feijão offline', exact: true }),
  ).toBeVisible();
  await expect(
    reopened.getByRole('checkbox', { name: 'Marcar Feijão offline como comprado' }),
  ).toBeChecked();
  await expect(reopened.getByLabel('Total da categoria', { exact: true })).toHaveText(/8,50/);
  await expect(reopened.getByLabel('Saldo do orçamento', { exact: true })).toContainText(/Ultrapassou em.*1,00/);
  expect(
    await reopened.evaluate(() =>
      fetch('/online.txt?offline-proof=1', { cache: 'no-store' }).then(
        () => true,
        () => false,
      ),
    ),
  ).toBe(false);
  await expect(
    reopened.getByText('Offline · dados salvos neste aparelho', { exact: true }),
  ).toBeVisible();
  await reopened.getByRole('link', { name: 'Dados e aplicativo', exact: true }).click();
  const downloaded = reopened.waitForEvent('download');
  await reopened.getByRole('button', { name: 'Exportar backup' }).click();
  const file = await downloaded;
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const backup = JSON.parse(Buffer.concat(chunks).toString());
  expect(backup.version).toBe(3);
  expect(backup.lists[0].budgetCents).toBe(750);
  expect(backup.items.map((item: { name: string }) => item.name)).toContain('Feijão offline');
  await reopened.reload();
  await expect(reopened.getByRole('heading', { name: 'Dados e aplicativo' })).toBeVisible();
});

test('legacy backup import, invalid backups and empty replacement confirmation', async ({
  page,
}) => {
  await page.goto('/settings');
  const legacy = {
    format: 'vertice-backup',
    version: 1,
    lists: [{ id: 1, storeName: 'Mercado importado', date: 1792454400000, description: '' }],
    categories: [{ id: 1, title: 'Essenciais', shoppingListId: 1 }],
    items: [
      {
        id: 1,
        name: 'Arroz importado',
        price: 20,
        quantity: 0.5,
        unit: 'kg',
        isPurchased: 1,
        categoryId: 1,
        shoppingListId: 1,
      },
    ],
  };
  await page.getByLabel('Arquivo de backup').setInputFiles({
    name: 'flutter.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(legacy)),
  });
  await expect(page.getByRole('heading', { name: 'Restaurar backup?' })).toBeVisible();
  await page.getByRole('button', { name: 'Substituir e restaurar' }).click();
  await expect(page.getByText('Backup restaurado.', { exact: true })).toBeVisible();
  await page.getByLabel('Arquivo de backup').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{'),
  });
  await expect(page.getByRole('alert')).toContainText('JSON válido');
  await page.getByRole('link', { name: 'Vértice, minhas listas' }).click();
  await page.getByRole('link', { name: 'Abrir lista Mercado importado' }).click();
  await expect(page.getByLabel('Total da lista', { exact: true })).toContainText('10,00');
  await page.getByRole('link', { name: 'Dados e aplicativo', exact: true }).click();
  const empty = {
    format: 'vertice-backup',
    version: 2,
    exportedAt: new Date().toISOString(),
    lists: [],
    categories: [],
    items: [],
  };
  const file = {
    name: 'empty.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(empty)),
  };
  await page.getByLabel('Arquivo de backup').setInputFiles(file);
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('link', { name: 'Vértice, minhas listas' }).click();
  await expect(page.getByRole('link', { name: 'Abrir lista Mercado importado' })).toBeVisible();
  await page.getByRole('link', { name: 'Dados e aplicativo', exact: true }).click();
  await page.getByLabel('Arquivo de backup').setInputFiles(file);
  await page.getByRole('button', { name: 'Substituir e restaurar' }).click();
  await expect(page.getByText('Backup restaurado.', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Vértice, minhas listas' }).click();
  await expect(page.getByRole('heading', { name: 'Sua próxima compra começa aqui' })).toBeVisible();
});

test('two tabs see committed changes and stale URLs recover after deletion', async ({
  page,
  context,
}) => {
  await createList(page);
  await addItem(page, 'Original');
  const second = await context.newPage();
  await second.goto(page.url());
  await addItem(page, 'Outra aba');
  await expect(second.getByRole('heading', { name: 'Outra aba', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Vértice, minhas listas' }).click();
  await page.getByRole('button', { name: 'Excluir lista Compra da semana' }).click();
  await page.getByRole('button', { name: 'Excluir lista', exact: true }).click();
  await expect(
    second.getByRole('heading', { name: 'Esta categoria não está mais disponível.' }),
  ).toBeVisible();
});

test('PWA update preserves data and failed assets are real 404s', async ({
  page,
  browserName,
  request,
}) => {
  test.skip(browserName !== 'chromium', 'Service worker lifecycle test targets Chromium.');
  await createList(page);
  await addItem(page, 'Preservar na atualização');
  await expect(page.getByText('Pronto para usar offline', { exact: true })).toBeVisible();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await request.post('/__test__/update');
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update();
  });
  const reloaded = page.waitForEvent('load');
  await page.getByRole('button', { name: /Nova versão disponível/ }).click();
  await reloaded;
  await expect(
    page.getByRole('heading', { name: 'Preservar na atualização', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Nova versão disponível/ })).toHaveCount(0);
  const missing = await request.get('/assets/not-found.js');
  expect(missing.status()).toBe(404);
});

test('100 items stay usable in a narrow viewport', async ({ page }, info) => {
  await page.goto('/settings');
  const legacy = {
    format: 'vertice-backup',
    version: 1,
    lists: [{ id: 1, storeName: '100 produtos', date: 1792454400000, description: '' }],
    categories: [{ id: 1, title: 'Essenciais', shoppingListId: 1 }],
    items: Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      name: `Produto ${i + 1}`,
      price: 1.99,
      quantity: 1,
      unit: 'un',
      isPurchased: 0,
      categoryId: 1,
      shoppingListId: 1,
    })),
  };
  await page.getByLabel('Arquivo de backup').setInputFiles({
    name: '100-items.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(legacy)),
  });
  await page.getByRole('button', { name: 'Substituir e restaurar' }).click();
  await expect(page.getByText('Backup restaurado.', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Vértice, minhas listas' }).click();
  await page.getByRole('link', { name: 'Abrir lista 100 produtos' }).click();
  await page
    .getByRole('link')
    .filter({ has: page.getByRole('heading', { name: 'Essenciais', exact: true }) })
    .click();
  await expect(page.getByRole('heading', { name: 'Produto 1', exact: true })).toBeInViewport();
  await page.getByRole('heading', { name: 'Produto 100', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('heading', { name: 'Produto 100', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await info.attach('100-items-mobile', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  await writeFile(
    info.outputPath('note.txt'),
    'CI browser usability check; not a physical-phone performance measurement.',
  );
});
