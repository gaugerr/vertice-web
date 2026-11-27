// Isolated browser storage and local transport only; never uses real accounts.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const base = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5196/';
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => errors.push(e.message));
  const ready = () =>
    page.locator('html[data-workspace-ready=true]').waitFor({ state: 'attached' });
  const go = async (area) => {
    await page.getByRole('button', { name: 'Abrir menu de áreas' }).click();
    if (area === 'settings') {
      await page.locator('[data-finance-view=more]').click();
      await page.locator('[data-settings-section=settings-area]').click();
    } else
      await page
        .locator(
          `#app-menu nav[aria-label="Áreas do Vértice"] [data-area=${area}]:not([data-finance-view])`,
        )
        .click();
  };
  const clean = async () => {
    assert.doesNotMatch(
      await page.locator('body').innerText(),
      /preview|demonstração|homologação|dados de exemplo|dados fictícios|simular/i,
    );
    assert.doesNotMatch(await page.title(), /preview|homologação/i);
    assert.equal(await page.locator('#reset,#finance-reset,.workspace-demo-tools').count(), 0);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  };
  await page.goto(base);
  await ready();
  await go('finance');
  await page.getByText('Comece pelo seu primeiro lançamento', { exact: true }).waitFor();
  await clean();
  await page.locator('[data-new-entry]').click();
  const form = page.locator('#financial-form');
  await form.locator('[name=name]').fill('Despesa preservada');
  await form.locator('[name=amount]').fill('50');
  await form.locator('[name=categoryId]').selectOption('D01');
  await form.locator('[name=paymentMethodId]').selectOption('P2');
  await form.locator('[type=submit]').click();
  await page.getByText('Despesa preservada', { exact: true }).waitFor();
  await page.locator('#finance-tabs [data-view=planning]').click();
  await page.locator('#planning-tabs [data-view=fixed]').click();
  await page.locator('#new-entry').click();
  for (const [name, value] of Object.entries({ name: 'Aluguel', amount: '1226' }))
    await form.locator(`[name=${name}]`).fill(value);
  await form.locator('[name=categoryId]').selectOption('D01');
  await form.locator('[name=paymentMethodId]').selectOption('P2');
  await form.locator('[type=submit]').click();
  const pay = async () => {
    await page.locator('[data-fixed-action=pay]').click();
    await form.locator('[type=submit]').click();
    await page
      .getByRole('button', { name: 'Corrigir pagamento de Aluguel', exact: true })
      .waitFor();
  };
  await pay();
  await page.getByRole('button', { name: 'Detalhes de Aluguel', exact: true }).click();
  page.once('dialog', (d) => d.accept());
  await page.locator('[data-fixed-action=undo]').click();
  await pay();
  await go('settings');
  await clean();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-finance').click();
  const download = await downloadPromise;
  const raw = await readFile(await download.path(), 'utf8');
  assert.equal(JSON.parse(raw).state.fixedAccounts.length, 1);
  await page
    .locator('#finance-backup-file')
    .setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(raw) });
  await page.getByRole('heading', { name: 'Restaurar backup financeiro' }).waitFor();
  await form.locator('[type=submit]').click();
  await page.locator('#export-before-restore').waitFor({ state: 'visible' });
  const recoveryPromise = page.waitForEvent('download');
  await page.locator('#export-before-restore').click();
  assert.equal(
    JSON.parse(await readFile(await (await recoveryPromise).path(), 'utf8')).state.fixedAccounts
      .length,
    1,
  );
  await page.reload();
  await ready();
  await go('finance');
  await page.locator('#finance-tabs [data-view=planning]').click();
  await page.locator('#planning-tabs [data-view=fixed]').click();
  await page.getByRole('button', { name: 'Corrigir pagamento de Aluguel', exact: true }).waitFor();
  for (const width of [280, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const view of ['overview', 'transactions', 'fixed', 'budget', 'goals']) {
      if (['fixed', 'budget', 'goals'].includes(view)) {
        await page.locator('#finance-tabs [data-view=planning]').click();
        await page.locator(`#planning-tabs [data-view=${view}]`).click();
      } else await page.locator(`#finance-tabs [data-view=${view}]`).click();
      await clean();
    }
    await go('settings');
    await clean();
    await go('finance');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await go('shopping');
  const frame = page.frameLocator('#shopping-frame');
  await frame.getByRole('button', { name: 'Nova lista', exact: true }).waitFor();
  await go('settings');
  await page.locator('#shopping-settings').click();
  await frame.getByRole('heading', { name: 'Backup das suas compras' }).waitFor();
  assert.doesNotMatch(
    await frame.locator('body').innerText(),
    /preview|demonstração|compras de teste/i,
  );
  await go('settings');
  await page.screenshot({ path: '/tmp/vertice-settings-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: '/tmp/vertice-settings-desktop.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    'PASS: conta vazia, criação, pagamento/desfazer/reconfirmar, backup/restauração/cópia anterior, persistência, compras e configurações; layouts 280–1440; sem controles ou textos de teste.',
  );
} finally {
  await browser.close();
}
