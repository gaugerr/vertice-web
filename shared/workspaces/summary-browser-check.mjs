import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import {
  emptyState,
  saveEntry,
  saveBudget,
} from '../../previews/controle-financeiro/finance-domain.mjs';
const state = emptyState();
const month = new Date().toISOString().slice(0, 7);
for (let i = 0; i < 8; i++)
  saveEntry(state, {
    id: 'e' + i,
    name: 'Despesa ' + i,
    type: 'expense',
    amount: (8 - i) * 10000,
    categoryId: 'D' + String(i + 1).padStart(2, '0'),
    paid: i !== 7,
    date: month + '-' + String(i + 1).padStart(2, '0'),
    paymentMethodId: 'P2',
    observation: '',
  });
saveEntry(state, {
  id: 'income',
  name: 'Receita',
  type: 'income',
  amount: 500000,
  categoryId: 'R01',
  paid: true,
  date: month + '-01',
  paymentMethodId: 'P2',
  observation: '',
});
saveBudget(state, month, 'D01', 100000);
state.revision = 0;
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
try {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.addInitScript((state) => {
    if (!localStorage.getItem('vertice-finance-preview-v2'))
      localStorage.setItem('vertice-finance-preview-v2', JSON.stringify(state));
  }, state);
  await p.goto((process.env.PREVIEW_URL ?? 'http://127.0.0.1:5199/') + '#financeiro/overview');
  await p.locator('.monthly-result').waitFor();
  assert.equal(await p.locator('.available-balance').count(), 0);
  assert.match(await p.locator('.monthly-result').innerText(), /1.500,00/);
  assert.match(await p.locator('.summary-budget').innerText(), /Restam.*200,00/s);
  assert.equal(await p.locator('[role=progressbar]').getAttribute('aria-valuenow'), '80');
  assert.equal(await p.locator('.recent-transactions li').count(), 5);
  assert.equal(await p.locator('.category-ranking button').count(), 6);
  assert.equal(await p.locator('#content .line-chart').count(), 0);
  const order = await p
    .locator('#content')
    .evaluate((el) => [...el.children].map((n) => n.className));
  assert.match(order[0], /overview-balance/);
  assert.match(order[1], /summary-budget/);
  assert.match(order[2], /panel/);
  assert.match(order[3], /recent-transactions/);
  await p.locator('[data-category-history=D01]').click();
  assert.equal(await p.locator('#transaction-list .transaction').count(), 1);
  await p.locator('#finance-tabs [data-view=overview]').click();
  await p.locator('[data-category-history=__overview_others__]').click();
  assert.equal(await p.locator('#transaction-list .transaction').count(), 2);
  await p.locator('#finance-tabs [data-view=analysis]').click();
  await p.locator('.line-chart').waitFor();
  await p.locator('#menu-toggle').click();
  await p.locator('[data-finance-view=more]').click();
  await p.locator('#content [data-view=wealth]').click();
  await p.getByRole('heading', { name: 'Investimentos registrados', exact: true }).waitFor();
  await p.locator('#finance-tabs [data-view=overview]').click();
  for (const width of [280, 390, 1440]) {
    await p.setViewportSize({ width, height: 844 });
    assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (width === 390)
      await p.screenshot({ path: '/tmp/vertice-reorganized-overview.png', fullPage: true });
  }
  await p.setViewportSize({ width: 390, height: 844 });
  await p.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await p.locator('#new-entry').click();
  await p.locator('#financial-form [name=name]').waitFor();
  assert.deepEqual(errors, []);
  console.log(
    'PASS: resultado mensal, orçamento, ordem, últimos cinco, top 5/Outros com filtros, Análises/Patrimônio e CTA mobile; 280/390/1440.',
  );
} finally {
  await browser.close();
}
