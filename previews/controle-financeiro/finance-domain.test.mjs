import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState,
  initialState,
  migrateV1,
  saveEntry,
  saveFixed,
  saveCatalog,
  toggleCatalog,
  monthlyRows,
  fixedRows,
  totals,
  summaryTotals,
  overviewData,
  payFixed,
  correctPayment,
  undoFixed,
  adjustFixed,
  endFixed,
  dueDate,
  validateState,
  cents,
} from './finance-domain.mjs';
import { FinanceStore, STORAGE_KEY, LEGACY_KEY, BACKUP_KEY } from './finance-store.mjs';
const account = (s, over = {}) =>
  saveFixed(s, {
    id: 'rent',
    name: 'Aluguel',
    startMonth: '2026-11',
    endMonth: null,
    from: '2026-11',
    amount: 100000,
    categoryId: 'D01',
    paymentMethodId: 'P2',
    dueDay: 31,
    ...over,
  });
const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};
test('orçamento aceita zero sem permitir zero em lançamentos ou valores negativos', () => {
  assert.equal(cents('0', { allowZero: true }), 0);
  assert.equal(cents('0,00', { allowZero: true }), 0);
  assert.throws(() => cents('0'));
  assert.throws(() => cents('-1', { allowZero: true }));
  const s = emptyState();
  s.budgets.D01 = 0;
  validateState(s);
});
test('edição mantém pagamento desconhecido do legado; novos registros e cópias exigem método', () => {
  const s = migrateV1({
    entries: [
      {
        id: 'legacy',
        name: 'Antigo',
        amount: 12345,
        date: '2026-11-05',
        category: 'Alimentação',
        type: 'expense',
        paid: false,
      },
    ],
    budgets: {},
    goals: [],
  });
  saveEntry(s, { ...s.entries[0], name: 'Corrigido' });
  assert.equal(s.entries[0].paymentMethodId, null);
  assert.throws(() => saveEntry(s, { ...s.entries[0], id: 'copy' }));
  saveEntry(s, { ...s.entries[0], paymentMethodId: 'P2' });
  assert.throws(() => saveEntry(s, { ...s.entries[0], paymentMethodId: null }));
  validateState(s);
});
test('parcial mantém restante, soma pagamentos e entra uma única vez no orçamento e totais', () => {
  const s = emptyState();
  account(s, { amount: 10000 });
  payFixed(s, 'rent', '2026-11', { date: '2026-12-01', amount: 6000 });
  let r = fixedRows(s, '2026-11')[0];
  assert.equal(r.paid, false);
  assert.equal(r.paidAmount, 6000);
  assert.equal(r.remainingAmount, 4000);
  assert.equal(r.amount, 10000);
  assert.equal(totals(monthlyRows(s, '2026-11')).expense, 6000);
  assert.equal(totals(monthlyRows(s, '2026-11')).expectedExpense, 10000);
  assert.equal(totals(monthlyRows(s, '2026-12')).expense, 0);
  assert.throws(() => adjustFixed(s, 'rent', '2026-11', 20000));
  account(s, { from: '2026-11', amount: 15000 });
  endFixed(s, 'rent', '2026-11');
  assert.equal(fixedRows(s, '2026-11')[0].remainingAmount, 4000);
  payFixed(s, 'rent', '2026-11', { date: '2026-12-02', amount: 4000 });
  r = fixedRows(s, '2026-11')[0];
  assert.equal(r.paid, true);
  assert.equal(r.remainingAmount, 0);
  assert.equal(r.paidAmount, 10000);
  assert.equal(monthlyRows(s, '2026-11').length, 1);
  assert.equal(s.occurrences['rent:2026-11'].payment.history.length, 2);
  assert.equal(totals(monthlyRows(s, '2026-11')).expense, 10000);
  validateState(s);
});
test('correção e desfazer pagamentos parciais, quitação com desconto e legado quitado', () => {
  const s = emptyState();
  account(s, { amount: 10000 });
  payFixed(s, 'rent', '2026-11', { date: '2026-11-10', amount: 6000 });
  correctPayment(s, 'rent', '2026-11', { date: '2026-11-11', amount: 5000 });
  assert.equal(fixedRows(s, '2026-11')[0].remainingAmount, 5000);
  validateState(s);
  payFixed(s, 'rent', '2026-11', { date: '2026-11-12', amount: 1000, settle: true });
  assert.equal(fixedRows(s, '2026-11')[0].paid, true);
  assert.equal(totals(monthlyRows(s, '2026-11')).expectedExpense, 6000);
  validateState(s);
  delete s.occurrences['rent:2026-11'].payment.settled;
  delete s.occurrences['rent:2026-11'].payment.history;
  assert.equal(fixedRows(s, '2026-11')[0].paid, true);
  assert.equal(fixedRows(s, '2026-11')[0].amount, 6000);
  validateState(s);
  undoFixed(s, 'rent', '2026-11');
  assert.equal(fixedRows(s, '2026-11')[0].remainingAmount, 10000);
  assert.equal(totals(monthlyRows(s, '2026-11')).expense, 0);
  validateState(s);
});
test('centavos, datas civis e fevereiro inclusive bissexto', () => {
  assert.equal(cents('120,50'), 12050);
  for (const v of ['0', '1.200,50', '-3', '1,999']) assert.throws(() => cents(v));
  assert.equal(dueDate('2027-02', 31), '2027-02-28');
  assert.equal(dueDate('2028-02', 31), '2028-02-29');
  assert.equal(dueDate('2026-04', 31), '2026-04-30');
});
test('recorrências em vigências, uma ocorrência por mês e sem mutação na consulta', () => {
  const s = emptyState();
  account(s, { endMonth: '2027-02' });
  const before = JSON.stringify(s);
  assert.equal(fixedRows(s, '2026-10').length, 0);
  assert.equal(fixedRows(s, '2027-02').length, 1);
  assert.equal(fixedRows(s, '2027-03').length, 0);
  assert.equal(totals(monthlyRows(s, '2026-11')).expectedExpense, 100000);
  fixedRows(s, '2026-11');
  assert.equal(JSON.stringify(s), before);
});
test('pagamento em dezembro pertence à competência novembro; pagar não paga outro mês', () => {
  const s = emptyState();
  account(s);
  payFixed(s, 'rent', '2026-11', {
    date: '2026-12-05',
    amount: 101000,
    observation: 'Diferença conferida',
  });
  assert.equal(totals(monthlyRows(s, '2026-11')).expense, 101000);
  assert.equal(totals(monthlyRows(s, '2026-12')).expense, 0);
  assert.equal(fixedRows(s, '2026-11')[0].paymentDate, '2026-12-05');
  assert.throws(() => payFixed(s, 'rent', '2026-11', { date: '2026-12-06', amount: 101000 }));
  validateState(s);
});
test('reajuste preserva histórico pago e vigências antigas, ajustes pontuais não vazam', () => {
  const s = emptyState();
  account(s);
  payFixed(s, 'rent', '2026-11', { date: '2026-11-30', amount: 100000 });
  account(s, { from: '2026-11', amount: 120000 });
  assert.equal(fixedRows(s, '2026-11')[0].amount, 100000);
  assert.equal(fixedRows(s, '2026-12')[0].amount, 120000);
  account(s, { from: '2027-01', amount: 130000 });
  assert.equal(fixedRows(s, '2026-12')[0].amount, 120000);
  adjustFixed(s, 'rent', '2026-12', 125000, 'Somente dezembro');
  assert.equal(fixedRows(s, '2026-12')[0].amount, 125000);
  assert.equal(fixedRows(s, '2027-01')[0].amount, 130000);
  undoFixed(s, 'rent', '2026-11');
  assert.equal(fixedRows(s, '2026-11')[0].paid, false);
  assert.equal(fixedRows(s, '2026-11')[0].amount, 120000);
  validateState(s);
});
test('correção altera data e valor sem trocar competência ou o cadastro histórico', () => {
  const s = emptyState();
  account(s);
  payFixed(s, 'rent', '2026-11', { date: '2026-12-05', amount: 101000 });
  account(s, { from: '2026-12', amount: 120000, categoryId: 'D02' });
  correctPayment(s, 'rent', '2026-11', {
    date: '2026-12-06',
    amount: 102000,
    observation: 'Valor conferido',
  });
  const row = fixedRows(s, '2026-11')[0];
  assert.equal(row.amount, 102000);
  assert.equal(row.paymentDate, '2026-12-06');
  assert.equal(row.categoryId, 'D01');
  assert.equal(row.observation, 'Valor conferido');
  assert.equal(totals(monthlyRows(s, '2026-11')).expense, 102000);
  assert.equal(totals(monthlyRows(s, '2026-12')).expense, 0);
  assert.throws(() => correctPayment(s, 'rent', '2026-12', { date: '2026-12-06', amount: 1 }));
  validateState(s);
});
test('término mantém competências pagas e não mostra novas pendências após o fim', () => {
  const s = emptyState();
  account(s);
  payFixed(s, 'rent', '2027-01', { date: '2026-12-30', amount: 100000 });
  endFixed(s, 'rent', '2026-12');
  assert.equal(fixedRows(s, '2027-01')[0].paid, true);
  assert.equal(fixedRows(s, '2027-02').length, 0);
  assert.equal(fixedRows(s, '2026-12').length, 1);
});
test('cadastros têm IDs estáveis, nomes únicos, arquivo preserva vínculo e bloqueia novo uso', () => {
  const s = emptyState();
  saveCatalog(s, 'categories', { id: 'custom', name: 'Estudos', type: 'expense' });
  saveEntry(s, {
    id: 'e',
    name: 'Curso',
    amount: 4000,
    date: '2026-11-10',
    categoryId: 'custom',
    paymentMethodId: 'P2',
    type: 'expense',
    paid: true,
    observation: 'Curso mensal',
  });
  saveCatalog(s, 'categories', { id: 'custom', name: 'Cursos', type: 'income' });
  assert.equal(s.categories.find((c) => c.id === 'custom').type, 'expense');
  assert.equal(s.entries[0].categoryId, 'custom');
  toggleCatalog(s, 'categories', 'custom');
  assert.throws(() => saveEntry(s, { ...s.entries[0], id: 'new' }));
  saveEntry(s, { ...s.entries[0], amount: 5000 });
  saveCatalog(s, 'methods', { id: 'P2', name: 'Meu Pix' });
  toggleCatalog(s, 'methods', 'P2');
  saveEntry(s, { ...s.entries[0], amount: 6000 });
  assert.throws(() => saveEntry(s, { ...s.entries[0], id: 'new2', categoryId: 'D01' }));
  assert.throws(() => saveCatalog(s, 'methods', { id: 'p-new', name: ' meu pix ' }));
  validateState(s);
});
test('migração conserva totais, metas, pendências, limites e categorias genéricas sem inferir', () => {
  const old = {
    entries: [
      {
        id: 'a',
        name: 'Salário personalizado',
        amount: 500000,
        date: '2026-11-05',
        category: 'Renda',
        type: 'income',
        paid: true,
      },
      {
        id: 'b',
        name: 'Mercado',
        amount: 12345,
        date: '2026-11-06',
        category: 'Alimentação',
        type: 'expense',
        paid: false,
      },
    ],
    budgets: { Alimentação: 90000, Moradia: 180000 },
    goals: [{ id: 'g', name: 'Meta antiga', current: 50, target: 100 }],
  };
  const s = migrateV1(old);
  assert.equal(totals(monthlyRows(s, '2026-11')).forecast, 487655);
  assert.equal(s.categories.find((c) => c.id === s.entries[0].categoryId).name, 'Renda (legado)');
  assert.equal(
    s.categories.find((c) => c.id === s.entries[1].categoryId).name,
    'Alimentação (legado)',
  );
  assert.equal(s.budgets[s.entries[1].categoryId], 90000);
  assert.equal(s.entries[0].paymentMethodId, null);
  assert.deepEqual(s.goals, old.goals);
  assert.equal(s.fixedAccounts.length, 0);
});
test('armazenamento migra uma vez, preserva original e cópia, não reimporta após reload', () => {
  const storage = memory();
  const old = { entries: [], budgets: { Alimentação: 1 }, goals: [] };
  const raw = JSON.stringify(old);
  storage.setItem(LEGACY_KEY, raw);
  const store = new FinanceStore(storage);
  store.load();
  assert.equal(storage.getItem(LEGACY_KEY), raw);
  assert.equal(storage.getItem(BACKUP_KEY), raw);
  store.commit((s) => account(s));
  assert.equal(new FinanceStore(storage).load().fixedAccounts.length, 1);
});
test('erro ao salvar preserva estado anterior e falha de leitura nunca restaura exemplos', () => {
  const storage = memory();
  const store = new FinanceStore(storage);
  store.load();
  const old = JSON.stringify(store.state);
  storage.setItem = () => {
    throw Error('QuotaExceeded');
  };
  assert.throws(() => store.commit((s) => account(s)), /Não foi possível salvar/);
  assert.equal(JSON.stringify(store.state), old);
  const broken = memory();
  broken.setItem(STORAGE_KEY, '{quebrou');
  assert.throws(() => new FinanceStore(broken).load(), /Nada foi apagado/);
  assert.equal(broken.getItem(STORAGE_KEY), '{quebrou');
});
test('gravação de outra aba impede sobrescrever os registros silenciosamente', () => {
  const storage = memory();
  const a = new FinanceStore(storage),
    b = new FinanceStore(storage);
  a.load();
  b.load();
  a.commit((s) => account(s));
  assert.throws(() => b.commit((s) => account(s, { id: 'other' })), /outra aba/);
  assert.equal(new FinanceStore(storage).load().fixedAccounts.length, 1);
});
test('avulsos e contas fixas compartilham os totais sem contar o cadastro da conta', () => {
  const s = initialState();
  const before = totals(monthlyRows(s, '2026-11'));
  account(s);
  const after = totals(monthlyRows(s, '2026-11'));
  assert.equal(after.expectedExpense, before.expectedExpense + 100000);
  assert.equal(after.expense, before.expense);
  payFixed(s, 'rent', '2026-11', { date: '2026-11-30', amount: 100000 });
  assert.equal(totals(monthlyRows(s, '2026-11')).expectedExpense, after.expectedExpense);
  assert.equal(totals(monthlyRows(s, '2026-11')).expense, before.expense + 100000);
});

test('mês de início imutável, dia inválido e entradas incorretas não passam na validação', () => {
  const s = emptyState();
  account(s);
  assert.throws(() => account(s, { startMonth: '2026-10', from: '2026-11' }));
  assert.throws(() => account(emptyState(), { dueDay: 32 }));
  assert.throws(() =>
    saveEntry(s, {
      id: 'bad',
      name: 'Teste',
      amount: 100,
      date: '2026-02-31',
      type: 'expense',
      categoryId: 'D01',
      paymentMethodId: 'P2',
      paid: true,
      observation: '',
    }),
  );
});
test('v1 corrompida e falha de gravação durante migração preservam a origem', () => {
  const storage = memory();
  storage.setItem(LEGACY_KEY, '{"entries":');
  assert.throws(() => new FinanceStore(storage).load());
  assert.equal(storage.getItem(LEGACY_KEY), '{"entries":');
  assert.equal(storage.getItem(STORAGE_KEY), null);
  const good = memory();
  const raw = JSON.stringify({ entries: [], budgets: {}, goals: [] });
  good.setItem(LEGACY_KEY, raw);
  const set = good.setItem;
  good.setItem = (key, v) => {
    if (key === STORAGE_KEY) throw Error('Quota');
    set(key, v);
  };
  assert.throws(() => new FinanceStore(good).load());
  assert.equal(good.getItem(LEGACY_KEY), raw);
  assert.equal(good.getItem(BACKUP_KEY), raw);
});

test('primeiro acesso começa vazio e não recria exemplos ao reabrir', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  for (let i = 0; i < 2; i++) {
    const state = new FinanceStore(storage).load();
    assert.deepEqual(state.entries, []);
    assert.deepEqual(state.fixedAccounts, []);
    assert.deepEqual(state.goals, []);
    assert.deepEqual(state.occurrences, {});
  }
});

test('resumo mantém totais canônicos e investimento confirmado por competência, sem duplicar metas', () => {
  const s = emptyState();
  const entry = (id, type, amount, categoryId, paid, date = '2026-11-10') =>
    saveEntry(s, {
      id,
      name: id,
      type,
      amount,
      categoryId,
      paid,
      date,
      paymentMethodId: 'P2',
      observation: '',
    });
  entry('salario', 'income', 300000, 'R01', true);
  entry('pendente', 'income', 50000, 'R01', false);
  entry('mercado', 'expense', 20000, 'D03', true);
  entry('investimento', 'expense', 50000, 'D15', true);
  entry('investimento-pendente', 'expense', 10000, 'D15', false);
  entry('mes-anterior', 'expense', 90000, 'D15', true, '2026-10-10');
  saveFixed(s, {
    id: 'reserva',
    name: 'Aporte mensal',
    startMonth: '2026-11',
    from: '2026-11',
    endMonth: null,
    amount: 20000,
    dueDay: 5,
    categoryId: 'D15',
    paymentMethodId: 'P2',
  });
  payFixed(s, 'reserva', '2026-11', { amount: 5000, date: '2026-12-01' });
  s.goals.push({ id: 'goal', name: 'Reserva', target: 1000000, current: 900000, subtitle: '' });
  const summary = summaryTotals(s, '2026-11');
  assert.equal(summary.income, 300000);
  assert.equal(summary.expense, 75000);
  assert.equal(summary.balance, 225000);
  assert.equal(summary.invested, 55000);
  assert.deepEqual(
    Object.fromEntries(
      Object.keys(totals(monthlyRows(s, '2026-11'))).map((key) => [key, summary[key]]),
    ),
    totals(monthlyRows(s, '2026-11')),
  );
  const category = s.categories.find((c) => c.id === 'D15');
  category.name = 'Minha reserva';
  category.active = false;
  assert.equal(summaryTotals(s, '2026-11').invested, 55000);
  undoFixed(s, 'reserva', '2026-11');
  assert.equal(summaryTotals(s, '2026-11').invested, 50000);
});

test('resumo vazio e saldo negativo usam apenas valores confirmados', () => {
  const s = emptyState();
  assert.equal(summaryTotals(s, '2026-11').invested, 0);
  assert.equal(summaryTotals(s, '2026-11').balance, 0);
  saveEntry(s, {
    id: 'despesa',
    name: 'Despesa',
    type: 'expense',
    amount: 100,
    categoryId: 'D01',
    paid: true,
    date: '2026-11-10',
    paymentMethodId: 'P2',
    observation: '',
  });
  assert.equal(summaryTotals(s, '2026-11').balance, -100);
});

test('resumo agrega orçamento existente e top cinco com Outros sem duplicar categorias', () => {
  const s = emptyState();
  for (let i = 0; i < 7; i++)
    saveEntry(s, {
      id: 'e' + i,
      name: 'Despesa',
      type: 'expense',
      amount: (7 - i) * 100,
      categoryId: 'D' + String(i + 1).padStart(2, '0'),
      paid: true,
      date: '2026-11-01',
      paymentMethodId: 'P2',
      observation: '',
    });
  s.monthlyBudgets = { '2026-11': { D01: 1000, D02: 0 } };
  const data = overviewData(s, '2026-11');
  assert.equal(data.budget.limit, 1000);
  assert.equal(data.budget.used, 1300);
  assert.equal(data.budget.remaining, -300);
  assert.equal(data.budget.outside, 1500);
  assert.equal(data.categories.length, 6);
  assert.deepEqual(data.otherIds, ['D06', 'D07']);
  assert.equal(data.categories[5].value, 300);
  assert.equal(
    data.categories.reduce((sum, c) => sum + c.value, 0),
    2800,
  );
  assert.equal(overviewData(s, '2026-10').budget.defined, false);
});

test('indicadores distinguem despesas, reserva e resultado sem descontar duas vezes', () => {
  const s = emptyState();
  const add = (id, type, amount, categoryId, paid = true) =>
    saveEntry(s, {
      id,
      type,
      amount,
      categoryId,
      paid,
      name: id,
      date: '2026-11-12',
      paymentMethodId: 'P2',
      observation: '',
    });
  add('receita', 'income', 100000, 'R01');
  add('despesa', 'expense', 30000, 'D01');
  add('reserva', 'expense', 20000, 'D15');
  add('pendente', 'expense', 10000, 'D02', false);
  s.goals.push({
    id: 'g',
    name: 'Meta',
    target: 500000,
    current: 90000,
    openingAmount: 90000,
    contributions: [],
  });
  const t = summaryTotals(s, '2026-11');
  assert.equal(t.operatingExpense, 30000);
  assert.equal(t.resultBeforeSaving, 70000);
  assert.equal(t.invested, 20000);
  assert.equal(t.remainingAfterSaving, 50000);
  assert.equal(t.forecast, 40000);
  const filtered = summaryTotals(
    s,
    '2026-11',
    monthlyRows(s, '2026-11').filter((r) => r.categoryId === 'D15'),
  );
  assert.equal(filtered.invested, 20000);
  assert.equal(filtered.operatingExpense, 0);
  assert.equal(filtered.remainingAfterSaving, -20000);
  assert.equal(overviewData(s, '2026-11').budget.used, 0);
  s.entries.find((e) => e.id === 'reserva').amount = 15000;
  assert.equal(summaryTotals(s, '2026-11').remainingAfterSaving, 55000);
  s.entries = s.entries.filter((e) => e.id !== 'reserva');
  assert.equal(summaryTotals(s, '2026-11').remainingAfterSaving, 70000);
  assert.equal(summaryTotals(s, '2026-12').remainingAfterSaving, 0);
});
