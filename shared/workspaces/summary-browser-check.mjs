import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { emptyState, saveEntry } from '../../previews/controle-financeiro/finance-domain.mjs';
const state = emptyState();
const month = new Date().toISOString().slice(0, 7);
for (const [i, [name, type, amount, categoryId, paid]] of [
  ['Salário', 'income', 300000, 'R01', true],
  ['Projeto extra', 'income', 50000, 'R02', true],
  ['Aluguel', 'expense', 120000, 'D01', true],
  ['Compras do mês', 'expense', 23000, 'D03', true],
  ['Reserva mensal', 'expense', 40000, 'D15', true],
  ['Internet', 'expense', 10000, 'D02', true],
  ['Café com amigos', 'expense', 2000, 'D08', false],
].entries())
  saveEntry(state, {
    id: 'entry' + i,
    name,
    type,
    amount,
    categoryId,
    paid,
    date: month + '-' + String(i + 1).padStart(2, '0'),
    paymentMethodId: 'P2',
    observation: '',
  });
state.revision = 0;
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((state) => {
    if (!localStorage.getItem('vertice-finance-preview-v2'))
      localStorage.setItem('vertice-finance-preview-v2', JSON.stringify(state));
  }, state);
  await page.goto((process.env.PREVIEW_URL ?? 'http://127.0.0.1:5197/') + '#financeiro/overview');
  await page.locator('.overview-total strong').filter({ hasText: '1.570,00' }).waitFor();
  assert.match(
    await page.locator('.overview-indicators').innerText(),
    /3\.500,00[\s\S]*1\.930,00[\s\S]*400,00/,
  );
  assert.equal(await page.locator('.recent-transactions li').count(), 5);
  assert.equal(
    await page.locator('.recent-transactions li strong').first().textContent(),
    'Café com amigos',
  );
  assert.match(await page.locator('.recent-transactions li').first().innerText(), /Pendente/);
  assert.equal(
    await page
      .locator('.recent-transactions')
      .evaluate((node) => node.previousElementSibling.className),
    'overview-balance',
  );
  await page.getByRole('heading', { name: 'Seu mês em movimento', exact: true }).waitFor();
  await page.getByRole('heading', { name: 'Comparar com o mês anterior', exact: true }).waitFor();
  for (const width of [280, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'overflow ' + width,
    );
    if (width === 390 || width === 1440)
      await page.screenshot({ path: `/tmp/vertice-summary-${width}.png`, fullPage: true });
  }
  await page.locator('.recent-heading [data-view=transactions]').click();
  assert.equal(await page.locator('#transaction-list .transaction').count(), 7);
  await page.locator('#finance-tabs [data-view=overview]').click();
  await page.locator('#prev-month').click();
  assert.match(await page.locator('.overview-total strong').innerText(), /0,00/);
  assert.equal(await page.locator('.recent-transactions li').count(), 0);
  await page.locator('#next-month').click();
  assert.equal(await page.locator('.recent-transactions li').count(), 5);
  await page.reload();
  await page.locator('.overview-total strong').filter({ hasText: '1.570,00' }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    'PASS: indicadores confirmados, investimentos sem dupla contagem, últimos cinco por data, pendência, gráficos/comparação preservados, Ver todos, troca de mês, persistência e layouts 280–1440.',
  );
} finally {
  await browser.close();
}
