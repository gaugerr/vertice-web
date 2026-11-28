// Roteiro das telas Resumo, Planejamento e Lançamentos (demonstração isolada).
// Uso: PREVIEW_URL=http://127.0.0.1:5210/ FIXTURE=/caminho/fixture.json node shared/workspaces/finance-screens-check.mjs
// O FIXTURE é um estado de demonstração gerado a partir do domínio; nada é lido de conta real.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {
  emptyState,
  catalog,
  saveBudget,
  saveGoal,
  saveFixed,
} from '../../previews/controle-financeiro/finance-domain.mjs';
import { saveLedgerEntry } from '../../previews/controle-financeiro/finance-ledger.mjs';

// Estado de demonstração construído com as funções do domínio: lançamentos, limites, meta e conta fixa.
function buildFixture() {
  const s = emptyState();
  const cat = catalog();
  const id = (name, list = cat.categories) => list.find((x) => x.name === name).id;
  const M = '2026-11';
  const mercado = id('Mercado'),
    lazer = id('Lazer'),
    transp = id('Transporte');
  const salario = id('Salário'),
    pix = id('Pix', cat.methods),
    credito = id('Cartão de Crédito', cat.methods);
  const add = (e) =>
    saveLedgerEntry(s, {
      id: crypto.randomUUID(),
      name: e.name,
      amount: e.amount,
      date: e.date,
      categoryId: e.cat,
      paymentMethodId: e.method,
      type: e.type ?? 'expense',
      paid: e.paid ?? true,
      observation: '',
    });
  add({
    name: 'Salário',
    amount: 500000,
    date: '2026-11-05',
    cat: salario,
    method: pix,
    type: 'income',
  });
  add({
    name: 'Freela',
    amount: 80000,
    date: '2026-11-25',
    cat: id('Renda Extra'),
    method: pix,
    type: 'income',
    paid: false,
  });
  add({ name: 'Supermercado', amount: 42000, date: '2026-11-08', cat: mercado, method: pix });
  add({ name: 'Jantar fora', amount: 35000, date: '2026-11-14', cat: lazer, method: credito });
  add({ name: 'Cinema', amount: 31000, date: '2026-11-18', cat: lazer, method: credito });
  add({ name: 'Uber', amount: 9000, date: '2026-11-20', cat: transp, method: pix });
  for (let i = 0; i < 60; i++) {
    add({
      name: ['Padaria', 'Feira', 'Farmácia', 'Café', 'Papelaria'][i % 5] + ' ' + (i + 1),
      amount: 500 + ((i * 137) % 9000),
      date: `${M}-${String((i % 26) + 1).padStart(2, '0')}`,
      cat: [mercado, lazer, transp][i % 3],
      method: i % 4 === 0 ? credito : pix,
      paid: i % 7 !== 0,
    });
  }
  saveBudget(s, M, mercado, 50000);
  saveBudget(s, M, lazer, 20000);
  saveBudget(s, M, transp, 30000);
  saveGoal(s, {
    id: 'g1',
    name: 'Viagem',
    target: 300000,
    subtitle: 'Férias de janeiro',
    openingAmount: 50000,
  });
  saveFixed(s, {
    id: 'f1',
    name: 'Aluguel',
    amount: 120000,
    startMonth: '2026-01',
    endMonth: null,
    from: '2026-01',
    dueDay: 5,
    categoryId: id('Moradia'),
    paymentMethodId: pix,
    observation: '',
  });
  s.revision = 1;
  return JSON.stringify(s);
}
const fixture = process.env.FIXTURE ? readFileSync(process.env.FIXTURE, 'utf8') : buildFixture();

const base = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5210/';
const browser = await chromium.launch();
const clean = (t) =>
  (t ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const results = [];

async function open(width, height, seeded = true) {
  const mobile = width < 600;
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: mobile,
    hasTouch: mobile,
  });
  context.setDefaultTimeout(8000);
  if (seeded)
    await context.addInitScript((f) => {
      if (!localStorage.getItem('vertice-finance-preview-v2'))
        localStorage.setItem('vertice-finance-preview-v2', f);
    }, fixture);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('.area-switch [data-area=finance]').click();
  await page.locator('#new-entry').waitFor();
  return { context, page, errors };
}
async function tab(p, view) {
  await p.locator(`#finance-tabs [data-view=${view}]`).click();
  await p.waitForTimeout(150);
}
async function planning(p, sub) {
  await tab(p, 'planning');
  await p.locator(`#planning-tabs [data-view=${sub}]`).click();
  await p.waitForTimeout(150);
}
const txRows = (p) => p.locator('article.transaction');
async function noOverflow(p, label) {
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  assert(sw <= p.viewportSize().width, `rolagem horizontal em ${label}: ${sw}px`);
}
async function scenario(name, width, height, seeded, fn) {
  const s = await open(width, height, seeded);
  try {
    await fn(s.page);
    assert.deepEqual(s.errors, [], 'erros de página');
    results.push(`OK   ${width}px  ${name}`);
  } catch (error) {
    results.push(`FAIL ${width}px  ${name} :: ${error.message.split('\n')[0]}`);
  } finally {
    await s.context.close();
  }
}

for (const [width, height] of [
  [1440, 900],
  [390, 844],
  [360, 740],
]) {
  await scenario(
    'Resumo sem dados: um painel de primeiro uso, sem cartões vazios',
    width,
    height,
    false,
    async (p) => {
      assert.equal(await p.locator('#welcome-title').isVisible(), true);
      assert.equal(await p.getByText('Gastos por categoria').count(), 0);
      assert.equal(await p.getByText('Comparar com o mês anterior').count(), 0);
      await noOverflow(p, 'resumo vazio');
    },
  );

  await scenario(
    'Resumo com dados: indicadores explicados e valores coerentes',
    width,
    height,
    true,
    async (p) => {
      const text = clean(await p.locator('.overview-balance').textContent());
      assert.match(text, /Quanto sobrou no mês\s*R\$ 1\.495,34/);
      assert.match(text, /Receitas\s*R\$ 5\.000,00\s*Recebidas no mês/);
      assert.match(text, /Despesas\s*R\$ 3\.504,66\s*Pagas no mês/);
      assert.match(text, /Antes de guardar\s*R\$ 1\.495,34/);
      assert.match(text, /Previsto até o fim do mês\s*R\$ 705,10/);
      await noOverflow(p, 'resumo');
    },
  );

  await scenario(
    'Planejamento: categorias com, sem e acima do limite',
    width,
    height,
    true,
    async (p) => {
      await planning(p, 'budget');
      const list = clean(await p.locator('.budget-grid').textContent());
      assert.match(list, /Com limite/);
      assert.match(list, /Lazer.*Acima do limite/);
      assert.match(list, /Sem limite/);
      assert.equal(await p.locator('.status-over').count(), 3);
      assert.equal(await p.locator('button[aria-label="Editar limite de Mercado"]').count(), 1);
      await noOverflow(p, 'planejamento');
    },
  );

  await scenario(
    'Planejamento: criar limite em categoria sem limite',
    width,
    height,
    true,
    async (p) => {
      await planning(p, 'budget');
      await p.locator('button[aria-label="Definir limite de Moradia"]').click();
      await p.locator('#financial-form [name=amount]').fill('2000');
      await p.locator('#financial-form button[type=submit]').click();
      await p.locator('button[aria-label="Editar limite de Moradia"]').waitFor();
      assert.equal(await p.locator('button[aria-label="Definir limite de Moradia"]').count(), 0);
    },
  );

  await scenario('Planejamento: editar limite muda o status', width, height, true, async (p) => {
    await planning(p, 'budget');
    await p.locator('button[aria-label="Editar limite de Mercado"]').click();
    await p.locator('#financial-form [name=amount]').fill('1400');
    await p.locator('#financial-form button[type=submit]').click();
    await p.waitForTimeout(200);
    assert.match(
      clean(await p.locator('.budget-grid').textContent()),
      /Mercado[^]*?Perto do limite/,
    );
  });

  await scenario(
    'Metas e investimentos: meta existente, nova meta e patrimônio',
    width,
    height,
    true,
    async (p) => {
      await planning(p, 'goals');
      assert.equal(await p.getByText('Viagem', { exact: true }).count(), 1);
      await p.locator('#new-entry').click();
      await p.locator('#financial-form [name=name]').fill('Reserva teste');
      await p.locator('#financial-form [name=target]').fill('1000');
      await p.locator('#financial-form [name=openingAmount]').fill('0');
      await p.locator('#financial-form button[type=submit]').click();
      await p.getByText('Reserva teste', { exact: true }).waitFor();
      // Em telas estreitas, Mais fica no menu (a barra inferior tem Novo no centro).
      if (p.viewportSize().width <= 640) {
        await p.locator('#menu-toggle').click();
        await p.locator('#menu-more').click();
      } else await p.locator('#finance-tabs [data-view=more]').click();
      await p.locator('.more-links button', { hasText: 'Patrimônio' }).click();
      assert.equal(await p.getByText('Investimentos registrados').isVisible(), true);
    },
  );

  await scenario('Lançamentos: lista longa agrupada por dia', width, height, true, async (p) => {
    await tab(p, 'transactions');
    assert.ok((await txRows(p).count()) >= 40, 'lista deveria ter muitos lançamentos');
    assert.ok((await p.locator('.day-heading').count()) >= 5, 'deveria haver vários grupos de dia');
    await noOverflow(p, 'lista longa');
  });

  await scenario(
    'Lançamentos: busca encontra um item e mostra resumo filtrado',
    width,
    height,
    true,
    async (p) => {
      await tab(p, 'transactions');
      await p.locator('#search').fill('Padaria 26');
      await p.waitForTimeout(150);
      assert.equal(await txRows(p).count(), 1);
      assert.match(clean(await p.locator('.compact-summary').textContent()), /Receitas/);
    },
  );

  await scenario('Lançamentos: filtro por tipo Receitas', width, height, true, async (p) => {
    await tab(p, 'transactions');
    await p.locator('.filter-details summary').click();
    await p.locator('[data-filter=type]').selectOption('income');
    await p.waitForTimeout(150);
    assert.ok((await txRows(p).count()) >= 1);
    assert.equal(
      await p.locator('.txn-amount', { hasText: '−' }).count(),
      0,
      'há despesa na lista de receitas',
    );
  });

  await scenario(
    'Lançamentos: estado sem resultados com orientação',
    width,
    height,
    true,
    async (p) => {
      await tab(p, 'transactions');
      await p.locator('#search').fill('zzzz sem resultado');
      await p.waitForTimeout(150);
      assert.match(
        clean(await p.locator('#transaction-list').textContent()),
        /Nenhum lançamento com esses filtros/,
      );
    },
  );

  await scenario('Lançamentos: editar um lançamento', width, height, true, async (p) => {
    await tab(p, 'transactions');
    await p.locator('#search').fill('Salário');
    await p.locator('button[aria-label="Editar Salário"]').click();
    await p.locator('#financial-form [name=name]').fill('Salário editado');
    await p.locator('#financial-form button[type=submit]').click();
    await p.getByText('Salário editado', { exact: true }).waitFor();
  });

  await scenario('Lançamentos: excluir um lançamento', width, height, true, async (p) => {
    await tab(p, 'transactions');
    await p.locator('#search').fill('Feira 52');
    await p.locator('summary[aria-label="Mais ações de Feira 52"]').click();
    await p.locator('button[data-entry-delete]').click();
    await p.waitForTimeout(250);
    assert.equal(await txRows(p).count(), 0);
  });

  await scenario(
    'navegação: trocar entre Compras e Financeiro e voltar às seções',
    width,
    height,
    true,
    async (p) => {
      await p.locator('.area-switch [data-area=shopping]').click();
      await p.waitForTimeout(200);
      await p.locator('.area-switch [data-area=finance]').click();
      await tab(p, 'transactions');
      assert.equal(await p.locator('#page-title').innerText(), 'Lançamentos');
    },
  );
}

await browser.close();
console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} OK`);
process.exitCode = failed ? 1 : 0;
