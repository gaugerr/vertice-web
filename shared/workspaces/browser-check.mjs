import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const owner = await context.newPage();
  const errors = [];
  context.on('page', (p) => p.on('pageerror', (e) => errors.push(e.message)));
  owner.on('pageerror', (e) => errors.push(e.message));
  const base = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5195/';
  const ready = (p) => p.locator('html[data-workspace-ready=true]').waitFor({ state: 'attached' });
  const select = async (p, id) => {
    await p.getByRole('button', { name: 'Abrir menu de áreas' }).click();
    await Promise.all([
      p.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      p.locator('#workspace-selector').selectOption(id),
    ]);
    await ready(p);
  };
  const go = async (p, area) => {
    await ready(p);
    await p.getByRole('button', { name: 'Abrir menu de áreas' }).click();
    await p.locator(`#app-menu nav[aria-label="Áreas do Vértice"] [data-area=${area}]`).click();
  };
  const save = async (p) => p.locator('#financial-form button[type=submit]').click();
  try {
    await owner.goto(base + '#configuracoes');
    await owner.locator('#workspace-create').waitFor();
    await owner.locator('#workspace-create').click();
    await owner.locator('#workspace-form [name=name]').fill('Nossa casa de teste');
    await owner.locator('#workspace-form [name=email]').fill('parceiro@exemplo.test');
    await owner.locator('#workspace-form button[type=submit]').click();
    await owner.locator('#workspace-invite-link').waitFor();
    const link = await owner.locator('#workspace-invite-link').inputValue();
    assert(link.includes('#convite?token='));
    const sharedId = await owner
      .locator('#workspace-selector option')
      .filter({ hasText: 'Nossa casa de teste' })
      .getAttribute('value');
    const guest = await context.newPage();
    await guest.addInitScript(() =>
      sessionStorage.setItem('vertice_demo_actor', '22222222-2222-4222-8222-222222222222'),
    );
    await guest.goto(link);
    await Promise.all([
      guest.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      guest
        .locator('#workspace-form button[type=submit]')
        .filter({ hasText: 'Entrar no espaço' })
        .click(),
    ]);
    await ready(guest);
    await guest
      .locator('#workspace-selector option:checked')
      .filter({ hasText: 'Nossa casa de teste' })
      .waitFor({ state: 'attached' });
    await select(owner, sharedId);
    await owner
      .locator('#workspace-selector option:checked')
      .filter({ hasText: 'Nossa casa de teste' })
      .waitFor({ state: 'attached' });
    await go(owner, 'finance');
    await owner.locator('#finance-tabs [data-view=transactions]').click();
    assert.equal(await owner.locator('#transaction-list .transaction').count(), 0);
    await go(guest, 'shopping');
    const frame = guest.frameLocator('#shopping-frame');
    await frame.getByRole('button', { name: 'Nova lista', exact: true }).click();
    await frame.getByLabel('Nome da lista').fill('Compra do casal');
    await frame.getByRole('button', { name: 'Criar lista', exact: true }).click();
    await frame.getByRole('heading', { name: 'Compra do casal', exact: true }).waitFor();
    await go(owner, 'shopping');
    await owner
      .frameLocator('#shopping-frame')
      .getByText('Compra do casal', { exact: true })
      .waitFor();
    await go(guest, 'finance');
    await guest.locator('#finance-tabs [data-view=transactions]').click();
    await guest.locator('#new-entry').click();
    const f = guest.locator('#financial-form');
    await f.locator('[name=name]').fill('Despesa do casal');
    await f.locator('[name=amount]').fill('60');
    await f.locator('[name=categoryId]').selectOption('D01');
    await f.locator('[name=paymentMethodId]').selectOption('P2');
    await save(guest);
    await go(owner, 'finance');
    await owner.locator('#finance-tabs [data-view=transactions]').click();
    await owner
      .locator('#transaction-list')
      .getByText('Despesa do casal', { exact: true })
      .waitFor();
    assert.match(await owner.locator('.stats').textContent(), /60,00/);
    await guest.evaluate(() =>
      localStorage.setItem('vertice_demo_offline_22222222-2222-4222-8222-222222222222', 'true'),
    );
    await go(guest, 'finance');
    await guest.locator('#new-entry').click();
    await f.locator('[name=name]').fill('Despesa offline');
    await f.locator('[name=amount]').fill('10');
    await f.locator('[name=categoryId]').selectOption('D01');
    await f.locator('[name=paymentMethodId]').selectOption('P2');
    await save(guest);
    await guest.locator('#sync-toggle[title="Pendente de envio"]').waitFor();
    assert.equal(await owner.getByText('Despesa offline', { exact: true }).count(), 0);
    await guest.evaluate(() => {
      localStorage.setItem('vertice_demo_offline_22222222-2222-4222-8222-222222222222', 'false');
      window.dispatchEvent(new Event('online'));
    });
    await owner
      .locator('#transaction-list')
      .getByText('Despesa offline', { exact: true })
      .waitFor();
    await go(owner, 'shopping');
    const ownerFrame = owner.frameLocator('#shopping-frame');
    await ownerFrame.getByRole('button', { name: 'Nova lista', exact: true }).click();
    await ownerFrame.getByLabel('Nome da lista').fill('Rascunho do casal');
    const personalId = await owner
      .locator('#workspace-selector option')
      .filter({ hasText: 'Meu espaço' })
      .getAttribute('value');
    await owner.getByRole('button', { name: 'Abrir menu de áreas' }).click();
    await owner.locator('#workspace-selector').selectOption(personalId);
    await owner.locator('#workspace-menu-message').filter({ hasText: 'Salve ou feche' }).waitFor();
    await owner.locator('#menu-close').click();
    assert.equal(await ownerFrame.getByLabel('Nome da lista').inputValue(), 'Rascunho do casal');
    owner.once('dialog', (d) => d.accept());
    await ownerFrame.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await select(owner, personalId);
    await owner
      .locator('#workspace-selector option:checked')
      .filter({ hasText: 'Meu espaço' })
      .waitFor({ state: 'attached' });
    await go(owner, 'finance');
    await owner.locator('#finance-tabs [data-view=transactions]').click();
    assert.equal(await owner.getByText('Despesa do casal', { exact: true }).count(), 0);
    await select(owner, sharedId);
    await owner
      .locator('#workspace-selector option:checked')
      .filter({ hasText: 'Nossa casa de teste' })
      .waitFor({ state: 'attached' });
    await go(owner, 'settings');
    await owner.locator('#workspace-copy-data').click();
    await owner.locator('#workspace-form button[type=submit]').click();
    await owner.locator('#workspace-form-error').filter({ hasText: 'já tem dados' }).waitFor();
    await owner.locator('#workspace-form [data-workspace-close-dialog]').first().click();
    owner.once('dialog', (d) => d.accept());
    await owner.locator('[data-workspace-remove]').click();
    await guest.locator('#workspace-access-block').waitFor({ state: 'visible' });
    assert.equal(await guest.locator('#finance-tabs').isVisible(), false);
    for (const width of [320, 390, 768, 1440]) {
      await owner.setViewportSize({ width, height: 900 });
      await go(owner, 'finance');
      for (const view of ['overview', 'transactions', 'fixed', 'budget', 'goals']) {
        await owner.locator(`#finance-tabs [data-view=${view}]`).click();
        assert(
          await owner.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          'overflow ' + width + ' ' + view,
        );
      }
    }
    const stage = await context.newPage();
    await stage.goto(base + 'staging/#configuracoes');
    if (process.env.EXPECT_CONNECTED_PREVIEW === '1') {
      await stage.locator('#workspace-login-panel').waitFor({ state: 'visible' });
      assert(await stage.locator('#workspace-login').isEnabled());
      assert.equal(await stage.locator('#shopping-frame').getAttribute('src'), null);
      assert.equal(await stage.locator('#workspace-selector').isVisible(), false);
    } else {
      await stage
        .locator('#workspace-message')
        .filter({ hasText: 'Não foi possível conectar' })
        .waitFor();
      assert(await stage.locator('#workspace-login').isDisabled());
    }
    assert.deepEqual(errors, []);
    await owner.setViewportSize({ width: 390, height: 844 });
    await go(owner, 'settings');
    await owner.screenshot({ path: '/workspace/vertice-couple-preview.png', fullPage: true });
    console.log(
      'PASS: criar/aceitar casal, duas pessoas, listas e finanças sincronizadas, offline/reconexão, rascunho protegido, dados pessoais separados, cópia não sobrescreve, remoção, homologação desativada, layout 320–1440.',
    );
  } catch (error) {
    await owner.screenshot({ path: '/workspace/vertice-couple-failure.png', fullPage: true });
    console.error('PAGE ERRORS', errors);
    throw error;
  } finally {
    await browser.close();
  }
})();
