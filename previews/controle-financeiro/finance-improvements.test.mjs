import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState,
  initialState,
  saveEntry,
  saveFixed,
  payFixed,
  monthlyRows,
  totals,
  validateState,
  budgetsFor,
  saveBudget,
  copyPreviousBudget,
  overdueRows,
  compareMonths,
  saveGoal,
  saveContribution,
  removeContribution,
  removeGoal,
} from './finance-domain.mjs';
import { createBackup, readBackup } from './finance-backup.mjs';
import { FinanceStore, STORAGE_KEY, PRE_RESTORE_KEY } from './finance-store.mjs';
const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};
const account = (s) =>
  saveFixed(s, {
    id: 'bill',
    name: 'Conta antiga',
    startMonth: '2026-09',
    endMonth: '2026-10',
    from: '2026-09',
    amount: 10000,
    categoryId: 'D01',
    paymentMethodId: 'P2',
    dueDay: 31,
  });
test('limites mensais preservam base e histórico; zero, remoção e cópia não vazam', () => {
  const s = emptyState();
  s.budgets = { D01: 10000, D02: null };
  saveBudget(s, '2026-11', 'D01', 0);
  assert.equal(budgetsFor(s, '2026-11').D01, 0);
  assert.equal(budgetsFor(s, '2026-10').D01, 10000);
  assert.equal(s.budgets.D01, 10000);
  saveBudget(s, '2026-11', 'D01', null);
  assert.equal(budgetsFor(s, '2026-11').D01, undefined);
  assert.equal(budgetsFor(s, '2026-12').D01, 10000);
  saveBudget(s, '2026-11', 'D03', 12345);
  copyPreviousBudget(s, '2026-12');
  saveBudget(s, '2026-12', 'D03', 50000);
  assert.equal(budgetsFor(s, '2026-11').D03, 12345);
  assert.equal(budgetsFor(s, '2026-12').D03, 50000);
  validateState(s);
  assert.throws(() => saveBudget(s, 'bad', 'D01', 100));
  assert.throws(() => saveBudget(s, '2026-11', 'R01', 100));
});
test('pendências anteriores usam apenas restante, não duplicam resultado mensal e respeitam datas', () => {
  const s = emptyState();
  account(s);
  saveEntry(s, {
    id: 'manual',
    name: 'Avulsa antiga',
    amount: 5000,
    date: '2026-10-05',
    type: 'expense',
    paid: false,
    categoryId: 'D01',
    paymentMethodId: 'P2',
    observation: '',
  });
  payFixed(s, 'bill', '2026-09', { date: '2026-10-01', amount: 10000 });
  payFixed(s, 'bill', '2026-10', { date: '2026-11-01', amount: 6000 });
  const before = JSON.stringify(s);
  const pending = overdueRows(s, '2026-11', '2026-11-09');
  assert.equal(pending.length, 2);
  assert.equal(
    pending.reduce((n, r) => n + r.remainingAmount, 0),
    9000,
  );
  assert.equal(totals(monthlyRows(s, '2026-11')).expectedExpense, 0);
  assert.equal(JSON.stringify(s), before);
  assert.equal(overdueRows(s, '2026-10', '2026-11-09').length, 0);
  assert.equal(overdueRows(s, '2026-12', '2026-09-01').length, 0);
});
test('comparação usa realizados por competência e lida com mês sem registros', () => {
  const s = initialState();
  const c = compareMonths(s, '2026-11');
  assert.equal(c.previous, '2026-10');
  assert.equal(c.prior.income, 520000);
  assert.equal(c.current.expense, 218235);
  assert(c.hasPrior);
  assert.equal(compareMonths(s, '2027-02').hasPrior, false);
  assert.equal(compareMonths(s, '1900-01').prior, null);
});
test('metas novas e legadas mantêm saldo anterior; corrigir e desfazer aportes não movimentam lançamentos', () => {
  const s = initialState();
  const entries = JSON.stringify(s.entries);
  saveContribution(s, 'reserve', { id: 'a', date: '2026-11-09', amount: 10000 });
  assert.equal(s.goals[0].openingAmount, 180000);
  assert.equal(s.goals[0].current, 190000);
  saveContribution(s, 'reserve', { id: 'a', date: '2026-11-10', amount: 5000 });
  assert.equal(s.goals[0].current, 185000);
  assert.equal(s.goals[0].contributions.length, 1);
  removeContribution(s, 'reserve', 'a');
  assert.equal(s.goals[0].current, 180000);
  assert.equal(JSON.stringify(s.entries), entries);
  saveGoal(s, { id: 'new', name: 'Viagem', target: 100000, openingAmount: 0 });
  saveContribution(s, 'new', { id: 'b', date: '2026-11-09', amount: 9000 });
  saveGoal(s, { id: 'new', name: 'Viagem editada', target: 200000 });
  assert.equal(s.goals.at(-1).current, 9000);
  validateState(s);
  removeGoal(s, 'new');
  assert.equal(s.goals.length, 2);
});
test('metas rejeitam datas e valores inválidos e histórico inconsistente', () => {
  const s = emptyState();
  saveGoal(s, { id: 'g', name: 'Meta', target: 10000 });
  assert.throws(() => saveContribution(s, 'g', { id: 'a', date: '2026-02-31', amount: 100 }));
  assert.throws(() => saveContribution(s, 'g', { id: 'a', date: '2026-11-01', amount: 0 }));
  assert.equal(s.goals[0].current, 0);
  saveContribution(s, 'g', { id: 'a', date: '2026-11-01', amount: 100 });
  s.goals[0].current = 200;
  assert.throws(() => validateState(s));
});
test('backup completo preserva recorrência parcial, limites mensais, metas e históricos', () => {
  const s = initialState();
  s.revision = 5;
  account(s);
  payFixed(s, 'bill', '2026-10', { date: '2026-11-01', amount: 6000 });
  saveBudget(s, '2026-11', 'D01', 0);
  saveContribution(s, 'reserve', { id: 'a', date: '2026-11-01', amount: 1000 });
  assert.deepEqual(readBackup(createBackup(s)), s);
});
test('backup inválido, referências quebradas e conteúdo perigoso são recusados', () => {
  const s = initialState();
  s.revision = 0;
  assert.throws(() => readBackup('{bad'));
  assert.throws(() => readBackup(JSON.stringify({ state: s })));
  s.entries[0].categoryId = 'unknown';
  assert.throws(() =>
    readBackup(JSON.stringify({ app: 'vertice-finance-preview', formatVersion: 1, state: s })),
  );
  assert.throws(() => readBackup('{"__proto__":{"polluted":true}}'));
  const good = initialState();
  good.revision = 0;
  good.categories[0].color = 'url(https://example.com)';
  assert.throws(() => readBackup(createBackup(good)));
});
test('restauração guarda cópia anterior e mantém revisão local crescente', () => {
  const storage = memory(),
    store = new FinanceStore(storage);
  store.load();
  const before = structuredClone(store.state);
  const imported = emptyState();
  imported.revision = 500;
  store.restore(imported);
  assert.equal(store.state.revision, 1);
  assert.equal(store.state.entries.length, 0);
  assert.deepEqual(JSON.parse(storage.getItem(PRE_RESTORE_KEY)), before);
  assert.equal(new FinanceStore(storage).load().revision, 1);
});
test('falha ao guardar cópia ou gravar restauração mantém estado e dados anteriores', () => {
  for (const failedKey of [PRE_RESTORE_KEY, STORAGE_KEY]) {
    const storage = memory(),
      store = new FinanceStore(storage);
    store.load();
    const before = storage.getItem(STORAGE_KEY);
    const set = storage.setItem;
    storage.setItem = (k, v) => {
      if (k === failedKey) throw Error('quota');
      set(k, v);
    };
    const imported = emptyState();
    imported.revision = 0;
    assert.throws(() => store.restore(imported));
    assert.equal(storage.getItem(STORAGE_KEY), before);
    assert.deepEqual(store.state, JSON.parse(before));
  }
});
test('restauração não sobrescreve alteração feita em outra aba', () => {
  const storage = memory(),
    a = new FinanceStore(storage),
    b = new FinanceStore(storage);
  a.load();
  b.load();
  b.commit((s) => saveBudget(s, '2026-11', 'D01', 123));
  const imported = emptyState();
  imported.revision = 0;
  assert.throws(() => a.restore(imported));
  assert.equal(storage.getItem(PRE_RESTORE_KEY), null);
  assert.equal(new FinanceStore(storage).load().monthlyBudgets['2026-11'].D01, 123);
});
