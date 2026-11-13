// Synthetic local accounts only; no real bank or Google session.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
try {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  const base = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5201/';
  await p.goto(base + '#financeiro/home');
  await p.locator('html[data-workspace-ready=true]').waitFor({ state: 'attached' });
  const form = p.locator('#financial-form');
  const save = async () => {
    await form.locator('[type=submit]').click();
    await p.locator('#financial-dialog').waitFor({ state: 'hidden' });
  };
  await p.locator('#new-entry').click();
  const started = Date.now();
  assert.equal(await form.locator('[name=categoryId]').inputValue(), 'D16');
  assert.equal(await form.locator('[name=paymentMethodId]').inputValue(), 'P2');
  await form.locator('[name=amount]').fill('12,50');
  await form.locator('[name=name]').fill('Café rápido');
  await save();
  assert(
    Date.now() - started < 10000,
    'Two-field automated entry should complete within ten seconds',
  );
  await p.locator('#finance-tabs [data-view=transactions]').click();
  await p.locator('#search').fill('cafe');
  assert.equal(await p.locator('#transaction-list .transaction').count(), 1);
  await p.locator('[data-entry-edit]').click();
  assert(await form.locator('[name=paymentMethodId]').isVisible());
  assert(await form.locator('[name=date]').isVisible());
  await form.locator('[name=paymentMethodId]').selectOption('P4');
  await form.locator('[name=name]').fill('Café corrigido');
  await save();
  assert.match(await p.locator('#transaction-indicators').innerText(), /12,50/);
  const credit = await p.evaluate(async () => {
    const c = await (await import('/workspaces.js')).openPreviewWorkspace();
    return (await c.finance()).entries.find((e) => e.name === 'Café corrigido');
  });
  assert.equal(credit.paymentMethodId, 'P4');
  assert(!credit.cardId);
  p.once('dialog', (d) => d.accept());
  await p.locator('.row-menu > summary').click();
  await p.locator('[data-entry-delete]').click();
  await p.locator('#transaction-list .transaction').waitFor({ state: 'hidden' });
  await p.locator('#finance-tabs [data-view=planning]').click();
  await p.locator('[data-monthly-limit]').click();
  await form.locator('[name=amount]').fill('1000');
  await save();
  await p.locator('#menu-toggle').click();
  await p.locator('[data-finance-view=more]').click();
  await p.locator('#content [data-view=wallets]').click();
  for (const name of ['Conta A', 'Conta B']) {
    await p.locator('[data-wallet-new]').click();
    await form.locator('[name=name]').fill(name);
    await form.locator('[name=amount]').fill(name === 'Conta A' ? '1000' : '0');
    await save();
  }
  const wallet = await p.evaluate(async () => {
    const c = await (await import('/workspaces.js')).openPreviewWorkspace();
    return (await c.finance()).wallets.find((w) => w.name === 'Conta A').id;
  });
  await p.locator('[data-transfer]').click();
  const walletA = await form
    .locator('[name=fromWalletId] option')
    .filter({ hasText: 'Conta A' })
    .getAttribute('value');
  const walletB = await form
    .locator('[name=toWalletId] option')
    .filter({ hasText: 'Conta B' })
    .getAttribute('value');
  await form.locator('[name=fromWalletId]').selectOption(walletA);
  await form.locator('[name=toWalletId]').selectOption(walletB);
  await form.locator('[name=amount]').fill('100');
  await save();
  await p.locator('#menu-toggle').click();
  await p.locator('[data-finance-view=more]').click();
  await p.locator('#content [data-view=cards]').click();
  await p.locator('[data-card-new]').click();
  await form.locator('[name=name]').fill('Cartão A');
  await save();
  const card = await p.evaluate(async () => {
    const c = await (await import('/workspaces.js')).openPreviewWorkspace();
    return (await c.finance()).cards[0].id;
  });
  await p.locator('#finance-tabs [data-view=overview]').click();
  await p.locator('#new-entry').click();
  await form.locator('[name=amount]').fill('100');
  await form.locator('[name=name]').fill('Compra parcelada');
  await form.locator('details summary').click();
  await form.locator('[name=cardId]').selectOption(card);
  await form.locator('[name=seriesMode]').selectOption('installments');
  await form.locator('[name=seriesCount]').fill('3');
  await save();
  const snapshot = await p.evaluate(async () => {
    const c = await (await import('/workspaces.js')).openPreviewWorkspace();
    const s = await c.finance();
    const e = s.entries.filter((e) => e.seriesId);
    return { entries: e, month: e[0].date.slice(0, 7) };
  });
  assert.equal(snapshot.entries.length, 3);
  assert.equal(
    snapshot.entries.reduce((n, e) => n + e.amount, 0),
    10000,
  );
  await p.locator('#menu-toggle').click();
  await p.locator('[data-finance-view=more]').click();
  await p.locator('#content [data-view=cards]').click();
  for (let i = 0; i < 12; i++) {
    const current = await p.locator('#month').innerText();
    const has = await p.locator('[data-invoice-pay]').count();
    if (has) break;
    await p.locator('#next-month').click();
    assert(current !== (await p.locator('#month').innerText()));
  }
  await p.locator('[data-invoice-pay]').click();
  await form.locator('[name=fromWalletId]').selectOption(wallet);
  await save();
  await p.locator('#menu-toggle').click();
  await p.locator('[data-finance-view=more]').click();
  await p.locator('#content [data-view=wallets]').click();
  const balances = await p.locator('.wealth-value').allTextContents();
  assert(balances.some((s) => s.includes('866,66')));
  assert(balances.some((s) => s.includes('100,00')));
  await p.reload();
  await p.locator('html[data-workspace-ready=true]').waitFor({ state: 'attached' });
  await p.locator('[data-transfer]').waitFor();
  await p.locator('#menu-toggle').click();
  await p.locator('[data-finance-view=more]').click();
  await p.locator('[data-settings-section=settings-area]').click();
  const download = p.waitForEvent('download');
  await p.locator('#export-finance').click();
  assert.match((await download).suggestedFilename(), /vertice-financeiro/);
  for (const width of [280, 390, 1440]) {
    await p.setViewportSize({ width, height: 844 });
    assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  assert.deepEqual(errors, []);
  console.log(
    'PASS: despesa em dois campos, busca sem acentos, contas/transferência, parcelas, cartão/pagamento de fatura, saldos, recarga e backup; layouts 280/390/1440.',
  );
} finally {
  await browser.close();
}
