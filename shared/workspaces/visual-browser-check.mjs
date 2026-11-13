// Visual/interaction regression using synthetic, local-only data.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { initialState, validateState } from '../../previews/controle-financeiro/finance-domain.mjs';
import { financeView } from '../../previews/controle-financeiro/finance-navigation.mjs';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const base = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5203/';
try {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  const state = initialState();
  state.entries[0].name = 'Receita com descrição longa para verificar a quebra de linha';
  state.revision = 0;
  validateState(state);
  await p.addInitScript((s) => {
    if (!localStorage.getItem('vertice-finance-preview-v2'))
      localStorage.setItem('vertice-finance-preview-v2', JSON.stringify(s));
  }, state);
  const open = async (view) => {
    await p.goto(base + '#financeiro/' + view);
    await p.locator('html[data-workspace-ready=true]').waitFor({ state: 'attached' });
    await p
      .locator(`#finance-area[data-view="${financeView(view)}"]`)
      .waitFor({ state: 'visible' });
    assert.equal(await p.locator('#retry-load').count(), 0, 'Synthetic fixture must load');
    await p.evaluate(() => scrollTo(0, 0));
  };
  const fits = async (label) =>
    assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label);
  for (const width of [280, 390, 1440]) {
    await p.setViewportSize({ width, height: 900 });
    for (const view of [
      'home',
      'transactions',
      'planning/budget',
      'planning/fixed',
      'planning/goals',
      'analysis',
      'more',
      'more/wealth',
      'more/wallets',
      'more/cards',
    ]) {
      await open(view);
      await fits(`${view} at ${width}`);
      if (width === 390 && ['home', 'transactions', 'planning/goals', 'analysis'].includes(view))
        await p.screenshot({
          path: `/tmp/vertice-visual-${view.replaceAll('/', '-')}-mobile.png`,
          fullPage: true,
        });
      if (width === 1440 && view === 'home')
        await p.screenshot({ path: '/tmp/vertice-visual-home-desktop.png', fullPage: true });
    }
  }
  await p.setViewportSize({ width: 390, height: 844 });
  await open('transactions');
  await p.locator('.filter-details > summary').click();
  await p.locator('[data-filter=type]').selectOption('expense');
  assert.equal(await p.locator('#filter-count').innerText(), '1');
  await p.locator('#search').fill('mercado');
  assert.equal(await p.locator('#filter-count').innerText(), '2');
  assert.equal(await p.locator('#transaction-list .transaction').count(), 1);
  await p.locator('[data-clear-filters]').click();
  assert.equal(await p.locator('#search').inputValue(), '');
  assert.equal(await p.locator('#filter-count').innerText(), '');
  assert(await p.locator('[data-clear-filters]').isHidden());
  // Native secondary action menu must be usable with the keyboard.
  const menu = p.locator('.row-menu > summary').first();
  await menu.focus();
  await p.keyboard.press('Enter');
  assert(await p.locator('.row-menu-items').first().isVisible());
  await p.keyboard.press('Enter');
  await p.locator('#new-entry').click();
  const form = p.locator('#financial-form');
  await form.locator('[name=amount]').fill('0');
  await form.locator('[name=name]').fill('Rascunho preservado');
  await form.locator('[type=submit]').click();
  await p.locator('#financial-error').waitFor({ state: 'visible' });
  assert.equal(await form.locator('[name=name]').inputValue(), 'Rascunho preservado');
  assert(await form.locator('[type=submit]').isEnabled());
  await form.locator('[name=amount]').fill('20,90');
  for (const height of [844, 500]) {
    await p.setViewportSize({ width: 390, height });
    await form.locator('[name=date]').scrollIntoViewIfNeeded();
    await form.locator('[name=date]').focus();
    await fits('form viewport ' + height);
    await form.locator('[type=submit]').scrollIntoViewIfNeeded();
    const r = await form.locator('[type=submit]').boundingBox();
    assert(r && r.y >= 0 && r.y + r.height <= height, 'Save remains in viewport');
  }
  await p.setViewportSize({ width: 390, height: 844 });
  await p.locator('#financial-dialog').evaluate((el) => (el.scrollTop = 0));
  await p.screenshot({ path: '/tmp/vertice-visual-entry-mobile.png' });
  await form.locator('[name=amount]').fill('9876543,21');
  await form.locator('[type=submit]').click();
  await p.locator('#financial-dialog').waitFor({ state: 'hidden' });
  for (const width of [280, 390, 1440]) {
    await p.setViewportSize({ width, height: 900 });
    await open('home');
    await p.locator('.monthly-result strong.pink').waitFor();
    await fits('large negative amount at ' + width);
    await open('transactions');
    await fits('large transaction amount at ' + width);
  }
  await p.setViewportSize({ width: 390, height: 844 });
  // Check financial settings without altering a real user's account.
  await open('more');
  await p.locator('[data-settings-section=settings-area]').click();
  await fits('settings mobile');
  await p.screenshot({ path: '/tmp/vertice-visual-settings-mobile.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    'PASS: all ten financial views at 280/390/1440, filters/reset, keyboard menu, failed-save draft, form at 500px height, settings and screenshots.',
  );
} finally {
  await browser.close();
}
