// Roteiro de navegador do formulário de lançamentos (demonstração isolada, sem conta real).
// Uso: PREVIEW_URL=http://127.0.0.1:5210/ node shared/workspaces/entry-browser-check.mjs
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const base = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5210/';
const browser = await chromium.launch();
const clean = (t) =>
  (t ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

async function open(width, height) {
  const mobile = width < 600;
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: mobile,
    hasTouch: mobile,
  });
  context.setDefaultTimeout(8000);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('.area-switch [data-area=finance]').click();
  await page.locator('#new-entry').waitFor();
  return { context, page, errors };
}
const form = (p) => p.locator('#financial-form');
const dialogOpen = (p) => p.locator('#financial-dialog').evaluate((d) => d.open);
const rows = (p, name) => p.locator('article.transaction', { hasText: name });

async function rowInMonth(p, name, months) {
  for (let i = 0; i < months; i++) await p.locator('#next-month').click();
  const count = await rows(p, name).count();
  for (let i = 0; i < months; i++) await p.locator('#prev-month').click();
  return count;
}

async function newEntry(p) {
  await p.locator('#new-entry').click();
  await form(p).locator('[name=amount]').waitFor();
}
async function fillEntry(
  p,
  { type = 'expense', amount, name, category, method, mode, count, paid },
) {
  if (type === 'income')
    await form(p).locator('.type-switch label', { hasText: 'Receita' }).click();
  if (amount !== undefined) await form(p).locator('[name=amount]').fill(amount);
  if (name !== undefined) await form(p).locator('[name=name]').fill(name);
  if (category) await form(p).locator('[name=categoryId]').selectOption({ label: category });
  if (method) await form(p).locator('[name=paymentMethodId]').selectOption({ label: method });
  if (paid !== undefined) await form(p).locator('[name=paid]').setChecked(paid);
  if (mode) {
    await form(p).locator('.entry-details summary').click();
    await form(p).locator('[name=seriesMode]').selectOption(mode);
    if (count) await form(p).locator('[name=seriesCount]').fill(String(count));
  }
}
async function save(p) {
  await form(p).locator('button[type=submit]').click();
  await p.locator('#financial-dialog').waitFor({ state: 'hidden' });
  await p.locator('#finance-tabs [data-view=transactions]').click();
  await p.locator('article.transaction').first().waitFor();
}
async function assertInViewport(p, locator, label) {
  const box = await locator.boundingBox();
  const size = p.viewportSize();
  assert(box, label + ' sem caixa visível');
  assert(
    box.y >= 0 && box.y + box.height <= size.height + 1,
    `${label} fora da tela (${Math.round(box.y)}–${Math.round(box.y + box.height)} de ${size.height})`,
  );
}
async function noOverflow(p, label) {
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  assert(sw <= p.viewportSize().width, `rolagem horizontal em ${label}: ${sw}px`);
}

const results = [];
async function scenario(name, width, height, fn) {
  const session = await open(width, height);
  try {
    await fn(session.page);
    assert.deepEqual(session.errors, [], 'erros de página');
    results.push(`OK   ${width}px  ${name}`);
  } catch (error) {
    results.push(`FAIL ${width}px  ${name} :: ${error.message.split('\n')[0]}`);
  } finally {
    await session.context.close();
  }
}

for (const [width, height] of [
  [1440, 900],
  [390, 844],
  [360, 740],
]) {
  await scenario(
    'primeiro uso: sem categoria ou forma pré-selecionadas',
    width,
    height,
    async (p) => {
      await newEntry(p);
      assert.equal(await form(p).locator('[name=categoryId]').inputValue(), '');
      assert.equal(await form(p).locator('[name=paymentMethodId]').inputValue(), '');
      assert.equal(await form(p).locator('[name=paid]').isChecked(), true);
      assert.equal(await form(p).locator('[name=amount]').getAttribute('inputmode'), 'decimal');
      await form(p).locator('button[type=submit]').click();
      await p.waitForTimeout(150);
      assert.equal(await dialogOpen(p), true, 'salvou sem categoria e forma');
    },
  );

  await scenario('receita simples', width, height, async (p) => {
    await newEntry(p);
    await fillEntry(p, {
      type: 'income',
      amount: '1500',
      name: 'Freela',
      category: 'Renda Extra',
      method: 'Pix',
    });
    await save(p);
    assert.match(
      clean(await p.locator('#toast').textContent()),
      /Receita de R\$ 1\.500,00 registrada/,
    );
    assert.equal(await rows(p, 'Freela').count(), 1);
  });

  await scenario('despesa simples', width, height, async (p) => {
    await newEntry(p);
    await fillEntry(p, { amount: '80,50', name: 'Mercado', category: 'Mercado', method: 'Pix' });
    await save(p);
    assert.match(clean(await p.locator('#toast').textContent()), /Despesa de R\$ 80,50 registrada/);
    assert.equal(await rows(p, 'Mercado').count(), 1);
  });

  await scenario(
    'despesa no crédito: texto e status deixam de dizer "Pago"',
    width,
    height,
    async (p) => {
      await newEntry(p);
      await fillEntry(p, {
        amount: '120',
        name: 'Restaurante',
        category: 'Lazer',
        method: 'Cartão de Crédito',
      });
      assert.equal(
        clean(await p.locator('#paid-label').textContent()),
        'Contar como gasto deste mês',
      );
      await save(p);
      const row = rows(p, 'Restaurante');
      assert.match(clean(await row.textContent()), /No crédito/);
      assert.doesNotMatch(clean(await row.textContent()), /Pago/);
    },
  );

  await scenario('parcelado: prévia coincide com o que é gravado', width, height, async (p) => {
    await newEntry(p);
    await fillEntry(p, {
      amount: '900',
      name: 'Notebook',
      category: 'Compras Pessoais',
      method: 'Pix',
      mode: 'installments',
      count: 3,
    });
    assert.match(
      clean(await p.locator('#series-preview').textContent()),
      /3 parcelas de R\$ 300,00/,
    );
    await save(p);
    assert.equal(await rows(p, 'Notebook · 1/3').count(), 1, 'parcela 1/3');
    for (const n of [2, 3])
      assert.equal(await rowInMonth(p, `Notebook · ${n}/3`, n - 1), 1, `parcela ${n}/3`);
  });

  await scenario(
    'recorrente: quantidade e valor claros antes de salvar',
    width,
    height,
    async (p) => {
      await newEntry(p);
      await fillEntry(p, {
        amount: '29,90',
        name: 'Streaming',
        category: 'Assinaturas',
        method: 'Cartão de Débito',
        mode: 'repeat',
        count: 3,
      });
      assert.match(
        clean(await p.locator('#series-preview').textContent()),
        /3 lançamentos de R\$ 29,90/,
      );
      await save(p);
      assert.equal(await rows(p, 'Streaming · 1/3').count(), 1, 'repetição 1/3');
      for (const n of [2, 3])
        assert.equal(await rowInMonth(p, `Streaming · ${n}/3`, n - 1), 1, `repetição ${n}/3`);
    },
  );

  await scenario('edição preserva dados e atualiza a lista', width, height, async (p) => {
    await newEntry(p);
    await fillEntry(p, { amount: '45', name: 'Padaria', category: 'Mercado', method: 'Dinheiro' });
    await save(p);
    await p.locator('button[aria-label="Editar Padaria"]').click();
    assert.equal(await form(p).locator('[name=amount]').inputValue(), '45,00');
    await form(p).locator('[name=name]').fill('Padaria da esquina');
    await save(p);
    assert.equal(await rows(p, 'Padaria da esquina').count(), 1);
    assert.equal(await rows(p, 'Padaria').count(), 1);
  });

  await scenario('validação: campos obrigatórios e mensagem clara', width, height, async (p) => {
    await newEntry(p);
    await form(p).locator('button[type=submit]').click();
    await p.waitForTimeout(150);
    assert.equal(await dialogOpen(p), true);
    const msg = clean(await p.locator('#financial-error').textContent());
    assert.match(msg, /^Confira: /);
    assert.match(msg, /Valor/);
    assert.match(msg, /Descrição/);
    assert.match(msg, /Categoria/);
    await form(p).locator('[name=amount]').fill('0');
    await form(p).locator('[name=name]').fill('Teste');
    await form(p).locator('[name=categoryId]').selectOption({ label: 'Mercado' });
    await form(p).locator('[name=paymentMethodId]').selectOption({ label: 'Pix' });
    await form(p).locator('button[type=submit]').click();
    await p.waitForTimeout(150);
    assert.equal(await dialogOpen(p), true);
    assert.match(clean(await p.locator('#financial-error').textContent()), /valor positivo/i);
  });

  await scenario(
    'gerenciar categoria: volta ao lançamento com dados e seleção',
    width,
    height,
    async (p) => {
      await newEntry(p);
      await form(p).locator('[name=amount]').fill('50');
      await form(p).locator('[name=name]').fill('Presente');
      await form(p).locator('button[aria-label="Gerenciar categorias"]').click();
      assert.equal(await p.locator('#catalog-dialog').evaluate((d) => d.open), true);
      assert.equal(await p.locator('#catalog-return').isVisible(), true);
      await p.locator('#catalog-name').fill('Pets teste');
      await p.locator('#catalog-form button.primary').click();
      await p.waitForTimeout(200);
      assert.equal(
        clean(await form(p).locator('[name=categoryId] option:checked').textContent()),
        'Pets teste',
      );
      await p.locator('#catalog-dialog [data-close]').first().click();
      assert.equal(await dialogOpen(p), true);
      assert.equal(await form(p).locator('[name=amount]').inputValue(), '50');
      assert.equal(await form(p).locator('[name=name]').inputValue(), 'Presente');
    },
  );

  await scenario('gerenciar forma de pagamento: volta ao lançamento', width, height, async (p) => {
    await newEntry(p);
    await form(p).locator('[name=amount]').fill('70');
    await form(p).locator('button[aria-label="Gerenciar formas de pagamento"]').click();
    await p.locator('#catalog-name').fill('Vale teste');
    await p.locator('#catalog-form button.primary').click();
    await p.waitForTimeout(200);
    assert.equal(
      clean(await form(p).locator('[name=paymentMethodId] option:checked').textContent()),
      'Vale teste',
    );
    await p.locator('#catalog-dialog [data-close]').first().click();
    assert.equal(await form(p).locator('[name=amount]').inputValue(), '70');
  });

  await scenario('duplo clique salva uma única vez', width, height, async (p) => {
    await newEntry(p);
    await fillEntry(p, { amount: '10', name: 'Duplo', category: 'Outros', method: 'Pix' });
    await form(p).locator('button[type=submit]').dblclick();
    await p.locator('#financial-dialog').waitFor({ state: 'hidden' });
    await p.locator('#finance-tabs [data-view=transactions]').click();
    await p.locator('article.transaction').first().waitFor();
    assert.equal(await rows(p, 'Duplo').count(), 1);
  });

  await scenario('botão Salvar visível e sem rolagem horizontal', width, height, async (p) => {
    await newEntry(p);
    await fillEntry(p, {
      amount: '15',
      name: 'Visível',
      category: 'Outros',
      method: 'Pix',
      mode: 'installments',
      count: 2,
    });
    await form(p).locator('button[type=submit]').scrollIntoViewIfNeeded();
    await assertInViewport(p, form(p).locator('button[type=submit]'), 'Salvar');
    await noOverflow(p, 'formulário');
  });
}

await browser.close();
console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} OK`);
process.exitCode = failed ? 1 : 0;
