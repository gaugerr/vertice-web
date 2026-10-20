import { test, expect, type Page } from '@playwright/test';

test.use({ hasTouch: true });

async function fillComparison(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Qual compensa?', exact: true });
  await dialog.getByLabel('Preço da opção A (R$)', { exact: true }).fill('10,90');
  await dialog.getByLabel('Conteúdo da opção A', { exact: true }).fill('500');
  await dialog.getByLabel('Preço da opção B (R$)', { exact: true }).fill('19,90');
  await dialog.getByLabel('Conteúdo da opção B', { exact: true }).fill('1');
  await dialog.getByLabel('Unidade da opção B', { exact: true }).selectOption('kg');
  await expect(
    dialog.getByRole('heading', { name: 'Opção B mais barata por quantidade' }),
  ).toBeVisible();
  return dialog;
}

test('comparison works without lists, keeps per-mode session drafts and fits a narrow screen', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  const launch = page.getByRole('button', { name: 'Comparar', exact: true });
  await launch.tap();
  const first = page.getByLabel('Preço da opção A (R$)', { exact: true });
  await expect(first).toBeFocused();
  await first.pressSequentially('10,90');
  await first.press('Enter');
  await expect(page.getByLabel('Conteúdo da opção A', { exact: true })).toBeFocused();
  await page.getByLabel('Conteúdo da opção A', { exact: true }).pressSequentially('500');
  await page.getByLabel('Conteúdo da opção A', { exact: true }).press('Enter');
  await expect(page.getByLabel('Preço da opção B (R$)', { exact: true })).toBeFocused();
  const dialog = await fillComparison(page);
  await expect(dialog.getByText(/Economia de.*1,90.*8,7%/)).toBeVisible();
  await dialog.getByLabel('Conteúdo da opção B', { exact: true }).press('Enter');
  await expect(dialog.getByLabel('Resultado da comparação', { exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await info.attach('comparison-320px', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(launch).toBeFocused();
  await launch.tap();
  await expect(first).toHaveValue('10,90');
  expect(
    await first.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd]),
  ).toEqual([0, 5]);
  await page.getByRole('button', { name: 'Volume', exact: true }).tap();
  await expect(first).toHaveValue('');
  await first.fill('3,50');
  await page.getByLabel('Conteúdo da opção A', { exact: true }).fill('500');
  await page.getByLabel('Preço da opção B (R$)', { exact: true }).fill('6');
  await page.getByLabel('Conteúdo da opção B', { exact: true }).fill('1');
  await page.getByLabel('Unidade da opção B', { exact: true }).selectOption('L');
  await expect(
    dialog.getByRole('heading', { name: 'Opção B mais barata por quantidade' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Peso', exact: true }).tap();
  await expect(first).toHaveValue('10,90');
  await page.getByRole('button', { name: 'Limpar comparação', exact: true }).tap();
  await expect(first).toHaveValue('');
  await page.getByRole('button', { name: 'Fechar comparador', exact: true }).tap();
  await page.reload();
  await launch.tap();
  await expect(first).toHaveValue('');
  await page.getByRole('button', { name: 'Volume', exact: true }).tap();
  await expect(first).toHaveValue('3,50');
  await page.getByLabel('Conteúdo da opção B', { exact: true }).fill('0');
  await page.getByLabel('Preço da opção B (R$)', { exact: true }).tap();
  await expect(page.getByLabel('Conteúdo da opção B', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(dialog.getByRole('heading', { name: /mais barata por quantidade/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Unidades', exact: true }).tap();
  await first.fill('12');
  await page.getByLabel('Conteúdo da opção A', { exact: true }).fill('12');
  await page.getByLabel('Preço da opção B (R$)', { exact: true }).fill('24');
  await page.getByLabel('Conteúdo da opção B', { exact: true }).fill('24');
  await expect(dialog.getByRole('heading', { name: 'Mesmo preço por quantidade' })).toBeVisible();
});

async function purchaseSnapshot(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('vertice_web');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = db.transaction(['lists', 'categories', 'items'], 'readonly');
    const rows = await Promise.all(
      ['lists', 'categories', 'items'].map(
        (name) =>
          new Promise<unknown[]>((resolve, reject) => {
            const request = transaction.objectStore(name).getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          }),
      ),
    );
    db.close();
    return rows;
  });
}

test('opening comparison preserves purchase drafts, budget, scroll position and stored records', async ({
  page,
}, info) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova lista', exact: true }).tap();
  await page.getByLabel('Nome da lista', { exact: true }).fill('Mercado comparador');
  await page.getByLabel('Orçamento da compra (R$)', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Criar lista', exact: true }).tap();
  await page.getByRole('link', { name: 'Abrir lista Mercado comparador', exact: true }).tap();
  await page
    .getByRole('link')
    .filter({ has: page.getByRole('heading', { name: 'Essenciais', exact: true }) })
    .tap();
  const newItem = page.getByRole('textbox', { name: 'Adicionar item', exact: true });
  await newItem.fill('Arroz');
  await newItem.press('Enter');
  await page.getByRole('checkbox', { name: 'Marcar Arroz como comprado', exact: true }).tap();
  const values = page.getByRole('form', { name: 'Valores de Arroz', exact: true });
  await expect(values.getByRole('button', { name: 'Salvar valores' })).toBeEnabled();
  await values.getByLabel('Preço por un (R$)', { exact: true }).fill('12,34');
  await values.getByLabel('Quantidade', { exact: true }).fill('1,5');
  const before = await purchaseSnapshot(page);
  const launch = page.getByRole('button', { name: 'Comparar', exact: true });
  await launch.scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => scrollY);
  await launch.tap();
  await fillComparison(page);
  await page.getByRole('button', { name: 'Fechar comparador', exact: true }).tap();
  await expect(launch).toBeFocused();
  expect(Math.abs((await page.evaluate(() => scrollY)) - scroll)).toBeLessThanOrEqual(1);
  expect(await purchaseSnapshot(page)).toEqual(before);
  await expect(values.getByLabel('Preço por un (R$)', { exact: true })).toHaveValue('12,34');
  await expect(values.getByLabel('Quantidade', { exact: true })).toHaveValue('1,5');
  await values.getByRole('button', { name: 'Salvar valores', exact: true }).tap({ trial: true });
  await info.attach('comparison-preserves-price-draft', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  await values.getByRole('button', { name: 'Salvar valores', exact: true }).tap();
  await expect(values).toHaveCount(0);
  await expect(page.getByLabel('Total da categoria', { exact: true })).toContainText('18,51');
  await expect(page.getByLabel('Saldo do orçamento', { exact: true })).toContainText(
    /Restam.*81,49/,
  );
  await launch.tap();
  await expect(page.getByLabel('Preço da opção A (R$)', { exact: true })).toHaveValue('10,90');
  await page.getByRole('button', { name: 'Fechar comparador', exact: true }).tap();
  await page.getByRole('link', { name: '← Mercado comparador', exact: true }).tap();
  await page
    .getByRole('link')
    .filter({ has: page.getByRole('heading', { name: 'Hortifruti', exact: true }) })
    .tap();
  await launch.tap();
  await expect(page.getByLabel('Preço da opção A (R$)', { exact: true })).toHaveValue('10,90');
  await expect(page.getByLabel('Unidade da opção B', { exact: true })).toHaveValue('kg');
  await page.getByRole('button', { name: 'Fechar comparador', exact: true }).tap();
  await expect(page.getByLabel('Saldo do orçamento', { exact: true })).toContainText(
    /Restam.*81,49/,
  );
});

test('comparison opens for the first time offline and survives a same-tab reload', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Real service worker offline lifecycle is verified in Chromium.',
  );
  await page.goto('/');
  await expect(page.getByText('Pronto para usar offline', { exact: true })).toBeVisible();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Comparar', exact: true }).tap();
  await fillComparison(page);
  await page.getByRole('button', { name: 'Fechar comparador', exact: true }).tap();
  await page.reload();
  await page.getByRole('button', { name: 'Comparar', exact: true }).tap();
  await expect(page.getByLabel('Preço da opção A (R$)', { exact: true })).toHaveValue('10,90');
  await expect(
    page.getByRole('heading', { name: 'Opção B mais barata por quantidade' }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      fetch('/online.txt?comparison-offline=1', { cache: 'no-store' }).then(
        () => true,
        () => false,
      ),
    ),
  ).toBe(false);
});

test('blocked session storage keeps the comparator usable in memory', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Blocked', 'SecurityError');
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Comparar', exact: true }).tap();
  await expect(page.getByText(/Uma recarga poderá apagar/)).toBeVisible();
  await fillComparison(page);
  await page.getByRole('button', { name: 'Fechar comparador', exact: true }).tap();
  await page.getByRole('button', { name: 'Comparar', exact: true }).tap();
  await expect(page.getByLabel('Preço da opção A (R$)', { exact: true })).toHaveValue('10,90');
});
