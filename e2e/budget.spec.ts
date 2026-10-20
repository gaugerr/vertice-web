import { test, expect, type Page } from '@playwright/test';

async function openCategory(page: Page, name: string) {
  await page
    .getByRole('link')
    .filter({ has: page.getByRole('heading', { name, exact: true }) })
    .click();
}

async function purchase(page: Page, name: string, price: string) {
  const input = page.getByRole('textbox', { name: 'Adicionar item', exact: true });
  await input.fill(name);
  await input.press('Enter');
  await expect(input).toHaveValue('');
  await page.getByRole('checkbox', { name: `Marcar ${name} como comprado`, exact: true }).click();
  const values = page.getByRole('form', { name: `Valores de ${name}`, exact: true });
  const priceInput = values.getByLabel('Preço por un (R$)', { exact: true });
  await expect(priceInput).toBeFocused();
  await priceInput.fill(price);
  await expect(values.getByRole('button', { name: 'Salvar valores', exact: true })).toBeEnabled();
  await priceInput.press('Enter');
  await expect(values).toHaveCount(0);
}

test('budget spans categories and filters, warns without blocking, and updates between tabs', async ({
  page,
  context,
}, info) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova lista', exact: true }).click();
  await page.getByLabel('Nome da lista', { exact: true }).fill('Compra com orçamento');
  await page.getByLabel('Orçamento da compra (R$)', { exact: true }).fill('100,00');
  await page.getByRole('button', { name: 'Criar lista', exact: true }).click();
  await page.getByRole('link', { name: 'Abrir lista Compra com orçamento', exact: true }).click();
  await expect(page.getByLabel('Saldo do orçamento', { exact: true })).toContainText(
    /Restam.*100,00/,
  );
  await openCategory(page, 'Essenciais');
  await purchase(page, 'Arroz', '80');
  await expect(page.getByText('Orçamento perto do limite', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Saldo do orçamento', { exact: true })).toContainText(
    /Restam.*20,00/,
  );
  await page.getByRole('button', { name: 'Pendentes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Arroz', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Gasto da lista', { exact: true })).toContainText('80,00');
  await page.getByRole('button', { name: 'Todos', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Marcar Arroz como comprado', exact: true }).click();
  await expect(page.getByLabel('Saldo do orçamento', { exact: true })).toContainText(
    /Restam.*100,00/,
  );
  await page.getByRole('checkbox', { name: 'Marcar Arroz como comprado', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar valores', exact: true }).click();
  await expect(page.getByRole('form', { name: 'Valores de Arroz' })).toHaveCount(0);

  await page.getByRole('link', { name: '← Compra com orçamento', exact: true }).click();
  await expect(page.getByLabel('Total da lista', { exact: true })).toContainText('80,00');
  await openCategory(page, 'Hortifruti');
  await purchase(page, 'Tomate', '25');
  await expect(page.getByLabel('Total da categoria', { exact: true })).toContainText('25,00');
  await expect(page.getByLabel('Gasto da lista', { exact: true })).toContainText('105,00');
  await expect(page.getByLabel('Saldo do orçamento', { exact: true })).toContainText(
    /Ultrapassou em.*5,00/,
  );
  await expect(page.getByRole('progressbar', { name: 'Orçamento utilizado' })).toHaveAttribute(
    'value',
    '100',
  );
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page
    .getByRole('button', { name: 'Ajustar orçamento', exact: true })
    .scrollIntoViewIfNeeded();
  await info.attach('budget-on-mobile', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });

  const other = await context.newPage();
  await other.goto(page.url());
  await expect(other.getByLabel('Gasto da lista', { exact: true })).toContainText('105,00');
  await page.getByRole('button', { name: 'Ajustar orçamento', exact: true }).click();
  const input = page.getByLabel('Orçamento da compra (R$)', { exact: true });
  await expect(input).toBeFocused();
  expect(
    await input.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd]),
  ).toEqual([0, 6]);
  await input.fill('0');
  await page.getByRole('button', { name: 'Salvar orçamento', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('maior que zero');
  await expect(input).toHaveValue('0');
  await input.fill('105,00');
  await page.getByRole('button', { name: 'Salvar orçamento', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(other.getByText('Limite atingido', { exact: true })).toBeVisible();
  await other.getByRole('button', { name: 'Ajustar orçamento', exact: true }).click();
  await other.getByLabel('Orçamento da compra (R$)', { exact: true }).fill('');
  await other.getByRole('button', { name: 'Salvar orçamento', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Definir orçamento', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Definir orçamento', exact: true })).toBeVisible();
  await expect(page.getByLabel('Total da categoria', { exact: true })).toContainText('25,00');
  await page.getByRole('link', { name: '← Compra com orçamento', exact: true }).click();
  await expect(page.getByLabel('Total da lista', { exact: true })).toContainText('105,00');
});

test('a populated old browser database is upgraded and exported without losing purchases', async ({
  page,
}) => {
  // Open a same-origin text resource before any application code creates the database.
  await page.goto('/online.txt');
  const ids = await page.evaluate(async () => {
    const list = crypto.randomUUID(),
      category = crypto.randomUUID(),
      item = crypto.randomUUID();
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      // Dexie version 1 uses native IndexedDB version 10.
      const request = indexedDB.open('vertice_web', 10);
      request.onupgradeneeded = () => {
        const database = request.result;
        const lists = database.createObjectStore('lists', { keyPath: 'id' });
        lists.createIndex('updatedAt', 'updatedAt');
        const categories = database.createObjectStore('categories', { keyPath: 'id' });
        categories.createIndex('shoppingListId', 'shoppingListId');
        categories.createIndex('[shoppingListId+position]', ['shoppingListId', 'position']);
        const items = database.createObjectStore('items', { keyPath: 'id' });
        items.createIndex('shoppingListId', 'shoppingListId');
        items.createIndex('categoryId', 'categoryId');
        items.createIndex('[categoryId+createdAt]', ['categoryId', 'createdAt']);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const timestamps = {
      createdAt: '2026-10-19T12:00:00.000Z',
      updatedAt: '2026-10-19T12:00:00.000Z',
    };
    const transaction = db.transaction(['lists', 'categories', 'items'], 'readwrite');
    const oldLists = transaction.objectStore('lists');
    const oldCategories = transaction.objectStore('categories');
    const oldItems = transaction.objectStore('items');
    oldLists.put({
      id: list,
      storeName: 'Compra antiga',
      date: '2026-10-19',
      description: 'Preservada',
      ...timestamps,
    });
    oldCategories.put({
      id: category,
      shoppingListId: list,
      title: 'Essenciais',
      position: 0,
      ...timestamps,
    });
    oldItems.put({
      id: item,
      shoppingListId: list,
      categoryId: category,
      name: 'Arroz antigo',
      unitPrice: '20',
      quantity: '0.5',
      unit: 'kg',
      isPurchased: true,
      ...timestamps,
    });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
    db.close();
    return { list, category, item };
  });
  await page.goto(`/lists/${ids.list}/categories/${ids.category}`);
  await expect(page.getByRole('heading', { name: 'Arroz antigo', exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox')).toBeChecked();
  await expect(page.getByLabel('Total da categoria', { exact: true })).toContainText('10,00');
  await page.getByRole('button', { name: 'Definir orçamento', exact: true }).click();
  await page.getByLabel('Orçamento da compra (R$)', { exact: true }).fill('20');
  await page.getByRole('button', { name: 'Salvar orçamento', exact: true }).click();
  await expect(page.getByLabel('Saldo do orçamento', { exact: true })).toContainText(
    /Restam.*10,00/,
  );
  await page.getByRole('link', { name: 'Dados e aplicativo', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar backup', exact: true }).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const backup = JSON.parse(Buffer.concat(chunks).toString());
  expect(backup.version).toBe(3);
  expect(backup.lists[0]).toMatchObject({
    id: ids.list,
    description: 'Preservada',
    budgetCents: 2000,
  });
  expect(backup.items[0]).toMatchObject({ id: ids.item, isPurchased: true, quantity: '0.5' });
});
