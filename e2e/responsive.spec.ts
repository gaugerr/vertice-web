import { test, expect, type Page, type Locator } from './fixtures';

test.use({ isMobile: true, hasTouch: true });

async function fitsScreen(page: Page, dialog?: Locator) {
  // Do not hide overflow: both the document and open dialogs must actually fit.
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport + 1);
  if (dialog) {
    const dimensions = await dialog.evaluate((el) => ({
      viewport: el.clientWidth,
      content: el.scrollWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
  }
}

for (const viewport of [
  { width: 280, height: 653 },
  { width: 320, height: 640 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 844, height: 390 },
]) {
  test(`shopping screens and forms fit ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByRole('button', { name: 'Nova lista', exact: true }).tap();
    await fitsScreen(page, page.getByRole('dialog'));
    // A long, unbroken title must wrap in cards, headings and the back button.
    const name = 'Supermercado'.repeat(4);
    await page.getByLabel('Nome da lista', { exact: true }).fill(name);
    await page.getByRole('button', { name: 'Criar lista', exact: true }).tap();
    const list = page.getByRole('link', { name: `Abrir lista ${name}`, exact: true });
    await expect(list).toBeVisible();
    await fitsScreen(page);
    await list.tap();
    await expect(page.getByRole('heading', { name: 'Por categoria' })).toBeVisible();
    await fitsScreen(page);
    await page
      .getByRole('link')
      .filter({ has: page.getByRole('heading', { name: 'Essenciais', exact: true }) })
      .tap();
    await page.getByRole('textbox', { name: 'Adicionar item', exact: true }).fill('Arroz');
    await page.getByRole('button', { name: 'Adicionar item', exact: true }).tap();
    await expect(page.getByRole('heading', { name: 'Arroz', exact: true })).toBeVisible();
    await fitsScreen(page);
    await page.getByRole('button', { name: 'Editar Arroz', exact: true }).tap();
    await fitsScreen(page, page.getByRole('dialog', { name: 'Editar item', exact: true }));
    await page.getByRole('button', { name: 'Cancelar', exact: true }).tap();
    await page.getByRole('button', { name: 'Comparar', exact: true }).tap();
    await fitsScreen(page, page.getByRole('dialog', { name: 'Qual compensa?', exact: true }));
    await page.getByRole('button', { name: 'Fechar comparador', exact: true }).tap();
    await page.getByRole('link', { name, exact: true }).tap();
    await expect(page.getByRole('heading', { name: 'Por categoria' })).toBeVisible();
    await page.getByRole('link', { name: 'Dados e aplicativo', exact: true }).tap();
    await expect(page.getByRole('heading', { name: 'Dados e aplicativo' })).toBeVisible();
    await fitsScreen(page);
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: 'Privacidade no Vértice' })).toBeVisible();
    await fitsScreen(page);
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Entrar com Google' })).toBeVisible();
    await fitsScreen(page);
  });
}
