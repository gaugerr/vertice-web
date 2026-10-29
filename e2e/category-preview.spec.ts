import { test, expect } from './fixtures';

for (const width of [280, 1280]) {
  test(`category previews preserve totals and react to purchases at ${width}px`, async ({
    page,
    context,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
    const timestamps = {
      createdAt: '2026-10-29T00:00:00.000Z',
      updatedAt: '2026-10-29T00:00:00.000Z',
    };
    const longName = 'ProdutoComNomeMuitoLongo'.repeat(4);
    const names = Array.from({ length: 12 }, (_, index) =>
      index === 2 ? longName : `Produto ${String(index + 1).padStart(2, '0')}`,
    );
    const backup = {
      format: 'vertice-backup',
      version: 5,
      exportedAt: timestamps.createdAt,
      lists: [
        {
          ...timestamps,
          id: id(1),
          storeName: 'Prévia por categoria',
          date: '2026-10-29',
          description: '',
          budgetCents: null,
          status: 'active',
          completedAt: null,
          purchaseDate: null,
          marketName: null,
        },
      ],
      categories: [
        {
          ...timestamps,
          id: id(2),
          shoppingListId: id(1),
          title: 'Essenciais',
          position: 0,
        },
      ],
      items: names.map((name, index) => ({
        ...timestamps,
        id: id(100 + index),
        shoppingListId: id(1),
        categoryId: id(2),
        name,
        unitPrice: '1.25',
        quantity: '2',
        unit: 'un',
        isPurchased: ![2, 6, 10].includes(index),
        brand: null,
        packageContent: null,
      })),
    };
    await page.goto('/settings');
    await page.getByLabel('Arquivo de backup').setInputFiles({
      name: 'category-preview.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backup)),
    });
    await page.getByRole('button', { name: 'Substituir e restaurar' }).click();
    await expect(page.getByText('Backup restaurado.', { exact: true })).toBeVisible();
    await page.goto(`/lists/${id(1)}`);
    const card = page.locator('.category-card').filter({
      has: page.getByRole('heading', { name: 'Essenciais', exact: true }),
    });
    await expect(card.locator('.category-item-name')).toHaveText([
      longName,
      'Produto 07',
      'Produto 11',
      'Produto 01',
      'Produto 02',
    ]);
    await expect(card.getByText('+ 7 itens…', { exact: true })).toBeVisible();
    await expect(card.locator('.category-footer')).toContainText('12 itens');
    await expect(card.locator('.category-footer strong')).toContainText('22,50');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await info.attach(`category-preview-${width}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    // Keep the overview open: committed writes in another tab must update its live query.
    const detail = await context.newPage();
    await detail.goto(`/lists/${id(1)}/categories/${id(2)}`);
    await expect(detail.getByRole('checkbox')).toHaveCount(12);
    await detail.getByRole('checkbox', { name: `Marcar ${longName} como comprado` }).click();
    await detail.getByRole('button', { name: 'Fechar', exact: true }).click();
    await expect(card.locator('.category-item-name')).toHaveText([
      'Produto 07',
      'Produto 11',
      'Produto 01',
      'Produto 02',
      longName,
    ]);
    await expect(card.locator('.category-footer strong')).toContainText('25,00');
    await detail.getByRole('checkbox', { name: 'Marcar Produto 12 como comprado' }).click();
    await expect(card.locator('.category-item-name')).toHaveText([
      'Produto 07',
      'Produto 11',
      'Produto 12',
      'Produto 01',
      'Produto 02',
    ]);
    await expect(card.locator('.category-footer strong')).toContainText('22,50');
    await expect(card.getByText('+ 7 itens…', { exact: true })).toBeVisible();
    await detail.close();
    await card.click();
    await expect(page.getByRole('checkbox')).toHaveCount(12);
    await expect(page.getByLabel('Total da categoria', { exact: true })).toContainText('22,50');
  });
}
