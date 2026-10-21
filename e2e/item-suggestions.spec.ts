import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import type { Unit } from '../src/domain/models/shopping';

test.use({ hasTouch: true });
function fixture() {
  const source = randomUUID();
  const current = randomUUID();
  const draft = randomUUID();
  const oldCategory = randomUUID();
  const category = randomUUID();
  const otherCategory = randomUUID();
  const draftCategory = randomUUID();
  const now = '2026-10-12T12:00:00.000Z';
  const timestamps = { createdAt: now, updatedAt: now };
  const base = { date: '2026-10-12', description: '', budgetCents: null, ...timestamps };
  const active = { status: 'active', completedAt: null, purchaseDate: null, marketName: null };
  function item(
    name: string,
    brand: string | null,
    amount: string | null,
    rank: number,
    unit: Unit = 'un',
  ) {
    return {
      id: randomUUID(),
      shoppingListId: source,
      categoryId: oldCategory,
      name,
      brand,
      packageContent: amount ? { amount, unit: 'g' } : null,
      unit,
      unitPrice: '18.9',
      quantity: '3',
      isPurchased: true,
      ...timestamps,
      updatedAt: `2026-10-12T12:${String(rank).padStart(2, '0')}:00.000Z`,
    };
  }
  const longName = 'Café ' + 'a'.repeat(45);
  const longBrand = 'b'.repeat(50);
  return {
    source,
    current,
    category,
    otherCategory,
    longName,
    longBrand,
    backup: {
      format: 'vertice-backup',
      version: 5,
      exportedAt: now,
      lists: [
        {
          ...base,
          id: source,
          storeName: 'Anterior',
          status: 'completed',
          completedAt: now,
          purchaseDate: '2026-10-12',
          marketName: 'Mercado X',
        },
        { ...base, ...active, id: current, storeName: 'Atual' },
        { ...base, ...active, id: draft, storeName: 'Rascunho' },
      ],
      categories: [
        {
          id: oldCategory,
          shoppingListId: source,
          title: 'Essenciais',
          position: 0,
          ...timestamps,
        },
        { id: category, shoppingListId: current, title: 'Essenciais', position: 0, ...timestamps },
        { id: otherCategory, shoppingListId: current, title: 'Outros', position: 1, ...timestamps },
        {
          id: draftCategory,
          shoppingListId: draft,
          title: 'Essenciais',
          position: 0,
          ...timestamps,
        },
      ],
      items: [
        item('Café', 'Melitta', '500', 9),
        { ...item('Café', 'Melitta', '0.5', 8), packageContent: { amount: '0.5', unit: 'kg' } },
        item('Café', 'Pilão', '500', 7),
        item('Café', null, null, 6),
        item('Café', 'Outra', '250', 5),
        item(longName, longBrand, '500', 4),
        item('Banana', null, null, 3, 'kg'),
        { ...item('Café pendente', null, null, 2), isPurchased: false },
        {
          ...item('Café rascunho', null, null, 59),
          shoppingListId: draft,
          categoryId: draftCategory,
        },
        {
          ...item('Café', 'Pilão', '500', 1),
          shoppingListId: current,
          categoryId: otherCategory,
          unitPrice: '0',
          isPurchased: false,
        },
      ],
    },
  };
}
async function restore(page: Page, backup: ReturnType<typeof fixture>['backup']) {
  await page.goto('/settings');
  const file = {
    name: 'suggestions.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  };
  await page.getByLabel('Arquivo de backup').setInputFiles(file);
  await page.getByRole('button', { name: 'Substituir e restaurar', exact: true }).click();
  await expect(page.getByText('Backup restaurado.', { exact: true })).toBeVisible();
}
async function open(page: Page, data: ReturnType<typeof fixture>) {
  await page.goto(`/lists/${data.current}/categories/${data.category}`);
  const input = page.getByRole('textbox', { name: 'Adicionar item', exact: true });
  await input.fill('cafe');
  const suggestions = page.getByRole('list', { name: 'Sugestões de compras anteriores' });
  await expect(suggestions.getByRole('button')).toHaveCount(3);
  return { input, suggestions };
}
async function exportBackup(page: Page) {
  await page.goto('/settings');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar backup' }).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString());
}

test('three compact suggestions preserve touch/keyboard entry, copy details and connect to the last price', async ({
  page,
}, info) => {
  const data = fixture();
  await restore(page, data.backup);
  const { input, suggestions } = await open(page, data);
  await expect(
    suggestions.getByRole('button', { name: 'Adicionar Café · Melitta · 500 g', exact: true }),
  ).toBeVisible();
  await expect(
    suggestions.getByRole('button', { name: 'Adicionar Café', exact: true }),
  ).toBeVisible();
  await expect(suggestions.getByRole('button', { name: /Pilão|pendente|rascunho/ })).toHaveCount(0);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const box = await suggestions.boundingBox();
    expect(box!.height).toBeLessThanOrEqual(136);
    for (const button of await suggestions.getByRole('button').all())
      expect((await button.boundingBox())!.height).toBe(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await suggestions.scrollIntoViewIfNeeded();
    await info.attach(`compact-suggestions-${width}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  }
  await input.fill('cafe aa');
  const longLabel = `Adicionar ${data.longName} · ${data.longBrand} · 500 g`;
  await expect(suggestions.getByRole('button', { name: longLabel, exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await input.fill('c');
  await expect(suggestions).toHaveCount(0);
  await input.fill('cafe');
  await input.press('Escape');
  await expect(suggestions).toHaveCount(0);
  await input.fill('caf');
  await suggestions
    .getByRole('button', { name: 'Adicionar Café · Melitta · 500 g', exact: true })
    .tap();
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
  await expect(
    page.getByRole('heading', { name: 'Café · Melitta · 500 g', exact: true }),
  ).toBeVisible();
  await input.fill('cafe');
  await expect(
    suggestions.getByRole('button', { name: 'Adicionar Café · Melitta · 500 g', exact: true }),
  ).toHaveCount(0);
  await input.press('Enter');
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
  await expect(page.getByRole('heading', { name: 'cafe', exact: true })).toBeVisible();
  await input.fill('ba');
  await input.press('Tab');
  await expect(page.getByRole('button', { name: 'Adicionar item', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  const banana = suggestions.getByRole('button', {
    name: 'Adicionar Banana · por kg',
    exact: true,
  });
  await expect(banana).toBeFocused();
  await banana.press('Enter');
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Banana', exact: true })).toBeVisible();
  await page
    .getByRole('checkbox', { name: 'Marcar Café · Melitta · 500 g como comprado', exact: true })
    .tap();
  const form = page.getByRole('form', { name: 'Valores de Café · Melitta · 500 g', exact: true });
  const price = form.getByLabel('Preço por un (R$)', { exact: true });
  await expect(price).toBeFocused();
  await expect(price).toHaveValue('0');
  await expect(form.getByLabel('Quantidade', { exact: true })).toHaveValue('1');
  await expect(form.getByLabel('Preço da última compra')).toContainText('R$ 18,90/un');
  await price.fill('20,90');
  await price.press('Enter');
  await expect(form).toHaveCount(0);
  const backup = await exportBackup(page);
  const current = backup.items.filter(
    (item: { shoppingListId: string }) => item.shoppingListId === data.current,
  );
  expect(current.find((item: { name: string }) => item.name === 'Banana')).toMatchObject({
    unit: 'kg',
    quantity: '1',
    unitPrice: '0',
    isPurchased: false,
    categoryId: data.category,
    brand: null,
    packageContent: null,
  });
  expect(current.find((item: { name: string }) => item.name === 'cafe')).toMatchObject({
    brand: null,
    packageContent: null,
    unitPrice: '0',
    quantity: '1',
  });
  expect(current.find((item: { brand: string }) => item.brand === 'Melitta')).toMatchObject({
    name: 'Café',
    packageContent: { amount: '500', unit: 'g' },
    quantity: '1',
    unitPrice: '20.9',
    categoryId: data.category,
  });
});

test('suggestions react to another tab, exclude existing products and survive offline additions', async ({
  page,
  context,
  browserName,
}) => {
  const data = fixture();
  await restore(page, data.backup);
  const { input, suggestions } = await open(page, data);
  const second = await context.newPage();
  await second.goto(`/lists/${data.source}`);
  await second.getByRole('button', { name: 'Reabrir compra', exact: true }).click();
  await second.getByRole('button', { name: 'Confirmar reabertura', exact: true }).click();
  await expect(suggestions).toHaveCount(0);
  await expect(input).toHaveValue('cafe');
  await second.getByRole('button', { name: 'Finalizar compra', exact: true }).click();
  await second.getByRole('button', { name: 'Confirmar finalização', exact: true }).click();
  await expect(suggestions.getByRole('button')).toHaveCount(3);
  await second.goto('/');
  await second.getByRole('button', { name: 'Finalizadas', exact: true }).click();
  await second.getByRole('button', { name: 'Excluir lista Anterior', exact: true }).click();
  await second
    .getByRole('dialog', { name: 'Excluir lista?', exact: true })
    .getByRole('button', { name: 'Excluir lista', exact: true })
    .click();
  await expect(suggestions).toHaveCount(0);
  await restore(second, data.backup);
  await expect(suggestions.getByRole('button')).toHaveCount(3);
  await open(second, data);
  await second.getByRole('button', { name: 'Adicionar Café · Melitta · 500 g', exact: true }).tap();
  await expect(
    second.getByRole('heading', { name: 'Café · Melitta · 500 g', exact: true }),
  ).toBeVisible();
  await expect(
    suggestions.getByRole('button', { name: 'Adicionar Café · Melitta · 500 g', exact: true }),
  ).toHaveCount(0);
  await expect(input).toHaveValue('cafe');
  if (browserName === 'chromium') {
    await expect(page.getByText('Pronto para usar offline', { exact: true })).toBeVisible();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await context.setOffline(true);
  }
  await suggestions.getByRole('button', { name: 'Adicionar Café', exact: true }).tap();
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Café', exact: true })).toBeVisible();
  if (browserName === 'chromium') await page.reload();
  await input.fill('cafe');
  await expect(
    suggestions.getByRole('button', { name: 'Adicionar Café', exact: true }),
  ).toHaveCount(0);
  await expect(
    suggestions.getByRole('button', { name: 'Adicionar Café · Melitta · 500 g', exact: true }),
  ).toHaveCount(0);
  await expect(suggestions.getByRole('button')).toHaveCount(2);
  if (browserName === 'chromium')
    expect(
      await page.evaluate(() =>
        fetch('/online.txt?suggestions-proof=1', { cache: 'no-store' }).then(
          () => true,
          () => false,
        ),
      ),
    ).toBe(false);
});
