import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test.use({ hasTouch: true });
// Restore ordinary v5 data through the public UI, without seeding internal database tables.
function fixture() {
  const historical = randomUUID(),
    current = randomUUID();
  const oldCategory = randomUUID(),
    currentCategory = randomUUID();
  const now = '2026-10-12T12:00:00.000Z';
  const list = {
    date: '2026-10-12',
    description: '',
    budgetCents: null,
    createdAt: now,
    updatedAt: now,
  };
  const item = {
    name: 'Café',
    brand: 'Marca X',
    packageContent: { amount: '500', unit: 'g' },
    quantity: '3',
    unit: 'un',
    createdAt: now,
    updatedAt: now,
  };
  return {
    historical,
    current,
    oldCategory,
    currentCategory,
    backup: {
      format: 'vertice-backup',
      version: 5,
      exportedAt: now,
      lists: [
        {
          ...list,
          id: historical,
          storeName: 'Anterior',
          status: 'completed',
          completedAt: now,
          purchaseDate: '2026-10-12',
          marketName: 'Mercado X',
        },
        {
          ...list,
          id: current,
          storeName: 'Atual',
          status: 'active',
          completedAt: null,
          purchaseDate: null,
          marketName: null,
        },
      ],
      categories: [
        {
          id: oldCategory,
          shoppingListId: historical,
          title: 'Essenciais',
          position: 0,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: currentCategory,
          shoppingListId: current,
          title: 'Essenciais',
          position: 0,
          createdAt: now,
          updatedAt: now,
        },
      ],
      items: [
        {
          ...item,
          id: randomUUID(),
          shoppingListId: historical,
          categoryId: oldCategory,
          unitPrice: '18.9',
          isPurchased: true,
        },
        {
          ...item,
          id: randomUUID(),
          shoppingListId: current,
          categoryId: currentCategory,
          unitPrice: '0',
          isPurchased: false,
        },
      ],
    },
  };
}
async function restore(page: Page, backup: ReturnType<typeof fixture>['backup']) {
  await page.goto('/settings');
  await page.getByLabel('Arquivo de backup').setInputFiles({
    name: 'history.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.getByRole('button', { name: 'Substituir e restaurar', exact: true }).click();
  await expect(page.getByText('Backup restaurado.', { exact: true })).toBeVisible();
}
async function openCurrent(page: Page, data: ReturnType<typeof fixture>) {
  await page.goto(`/lists/${data.current}/categories/${data.currentCategory}`);
  await page
    .getByRole('checkbox', { name: 'Marcar Café · Marca X · 500 g como comprado', exact: true })
    .tap();
  const form = page.getByRole('form', { name: 'Valores de Café · Marca X · 500 g', exact: true });
  await expect(form.getByLabel('Preço por un (R$)', { exact: true })).toBeFocused();
  await expect(form.getByLabel('Preço da última compra')).toContainText('R$ 18,90/un');
  return form;
}

test('last price follows draft details, preserves fast entry and is available offline', async ({
  page,
  context,
  browserName,
}, info) => {
  const data = fixture();
  await restore(page, data.backup);
  const form = await openCurrent(page, data);
  const price = form.getByLabel('Preço por un (R$)', { exact: true });
  const reference = form.getByLabel('Preço da última compra');
  await expect(reference).toContainText('Mercado X');
  await expect(reference).toContainText('2026');
  await expect(reference).not.toContainText('a mais');
  await price.fill('20,90');
  await expect(reference).toContainText('R$ 2,00 a mais por unidade');
  await expect(price).toBeFocused();
  await form.getByLabel('Quantidade', { exact: true }).fill('10');
  await expect(reference).toContainText('R$ 2,00 a mais');
  await form.getByLabel('Marca', { exact: true }).fill('Outra marca');
  await expect(reference).toHaveCount(0);
  await form.getByLabel('Marca', { exact: true }).fill(' marca   x ');
  await expect(reference).toBeVisible();
  await form.getByLabel('Embalagem', { exact: true }).fill('0,5');
  await expect(reference).toHaveCount(0);
  await form.getByLabel('Unidade da embalagem', { exact: true }).selectOption('kg');
  await expect(reference).toBeVisible();
  await form.getByLabel('Unidade', { exact: true }).selectOption('kg');
  await expect(reference).toHaveCount(0);
  await form.getByLabel('Unidade', { exact: true }).selectOption('un');
  await expect(reference).toBeVisible();
  // Restore the initial metadata, leaving only the price/quantity edits to save.
  await form.getByLabel('Marca', { exact: true }).fill('Marca X');
  await form.getByLabel('Embalagem', { exact: true }).fill('500');
  await form.getByLabel('Unidade da embalagem', { exact: true }).selectOption('g');
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await form.scrollIntoViewIfNeeded();
    await info.attach(`last-price-${width}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  }
  if (browserName === 'chromium') {
    await expect(page.getByText('Pronto para usar offline', { exact: true })).toBeVisible();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await context.setOffline(true);
  }
  await price.press('Enter');
  await expect(form).toHaveCount(0);
  await expect(page.getByLabel('Total da categoria', { exact: true })).toContainText('209,00');
  if (browserName === 'chromium') await page.reload();
  await page.getByRole('button', { name: 'Editar Café · Marca X · 500 g', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Editar item', exact: true });
  await expect(editor.getByLabel('Preço da última compra')).toContainText('R$ 2,00 a mais');
  await editor.getByLabel('Nome do item', { exact: true }).fill('Café extraforte');
  await expect(editor.getByLabel('Preço da última compra')).toHaveCount(0);
  await editor.getByLabel('Nome do item', { exact: true }).fill('Café');
  await editor.getByLabel('Preço por un (R$)', { exact: true }).fill('16,90');
  await expect(editor.getByLabel('Preço da última compra')).toContainText('R$ 2,00 a menos');
  await editor.getByRole('button', { name: 'Salvar item', exact: true }).click();
  await expect(page.getByLabel('Total da categoria', { exact: true })).toContainText('169,00');
});

test('another tab reopening, correcting, deleting and restoring history preserves the unsaved current price', async ({
  page,
  context,
}) => {
  const data = fixture();
  await restore(page, data.backup);
  const form = await openCurrent(page, data);
  const price = form.getByLabel('Preço por un (R$)', { exact: true });
  await price.fill('20,90');
  const second = await context.newPage();
  await second.goto(`/lists/${data.historical}`);
  await second.getByRole('button', { name: 'Reabrir compra', exact: true }).click();
  await second.getByRole('button', { name: 'Confirmar reabertura', exact: true }).click();
  await expect(form.getByLabel('Preço da última compra')).toHaveCount(0);
  await expect(price).toHaveValue('20,90');
  await second.goto(`/lists/${data.historical}/categories/${data.oldCategory}`);
  await second.getByRole('button', { name: 'Editar Café · Marca X · 500 g', exact: true }).click();
  await expect(second.getByLabel('Preço da última compra')).toHaveCount(0);
  await second.getByLabel('Preço por un (R$)', { exact: true }).fill('17,90');
  await second.getByRole('button', { name: 'Salvar item', exact: true }).click();
  await second.getByRole('link', { name: '← Anterior', exact: true }).click();
  await second.getByRole('button', { name: 'Finalizar compra', exact: true }).click();
  await second.getByRole('button', { name: 'Confirmar finalização', exact: true }).click();
  await expect(form.getByLabel('Preço da última compra')).toContainText('R$ 17,90/un');
  await expect(form.getByLabel('Preço da última compra')).toContainText('R$ 3,00 a mais');
  await expect(price).toHaveValue('20,90');
  await second.goto('/');
  await second.getByRole('button', { name: 'Finalizadas', exact: true }).click();
  await second.getByRole('button', { name: 'Excluir lista Anterior', exact: true }).click();
  await second
    .getByRole('dialog', { name: 'Excluir lista?', exact: true })
    .getByRole('button', { name: 'Excluir lista', exact: true })
    .click();
  await expect(form.getByLabel('Preço da última compra')).toHaveCount(0);
  await expect(price).toHaveValue('20,90');
  await restore(second, data.backup);
  await expect(form.getByLabel('Preço da última compra')).toContainText('R$ 18,90/un');
  await expect(price).toHaveValue('20,90');
});
