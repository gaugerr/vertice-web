// Parcelas (installments), encerramento de repeat com crédito e atomicidade local.
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, saveEntry, dueDate } from './finance-domain.mjs';
import {
  saveLedgerEntry,
  saveWallet,
  walletBalance,
  deleteLedgerEntry,
  deleteInstallmentsFrom,
  deleteInstallmentSeries,
  installmentTotalPlan,
  updateInstallmentTotal,
  stopSeries,
  repeatCreditStopPlan,
  validateSeriesSequence,
  validateLedger,
} from './finance-ledger.mjs';

const setup = () => {
  const s = emptyState();
  saveWallet(s, { id: 'w', name: 'Banco', openingBalance: 100000, openingDate: '2026-01-01' });
  return s;
};
const base = (over) => ({
  id: 'x',
  name: 'Notebook',
  type: 'expense',
  date: '2026-11-12',
  amount: 90000,
  categoryId: 'D01',
  paymentMethodId: 'P2',
  paid: true,
  observation: '',
  ...over,
});
const ids = (s) => s.entries.map((e) => e.id);
const idx = (s) => s.entries.map((e) => e.seriesIndex);
const counts = (s) => s.entries.map((e) => e.seriesCount);
const snapshot = (s) => JSON.stringify(s);

test('parcelas: divisão exata em centavos, posições 1..N, IDs seriesId:índice', () => {
  const s = setup();
  saveLedgerEntry(s, base({ amount: 10000 }), { mode: 'installments', count: 3 });
  assert.deepEqual(
    s.entries.map((e) => e.amount),
    [3334, 3333, 3333],
  );
  assert.equal(
    s.entries.reduce((n, e) => n + e.amount, 0),
    10000,
  );
  assert.deepEqual(ids(s), ['x:0', 'x:1', 'x:2']);
  assert.deepEqual(idx(s), [1, 2, 3]);
  assert.deepEqual(counts(s), [3, 3, 3]);
});

test('parcelas: data em dia inexistente usa o último dia do mês e segue nos meses seguintes', () => {
  const s = setup();
  saveLedgerEntry(s, base({ date: '2026-01-31', amount: 4000 }), {
    mode: 'installments',
    count: 4,
  });
  assert.deepEqual(
    s.entries.map((e) => e.date),
    ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'],
  );
  assert.equal(dueDate('2026-02', 31), '2026-02-28');
});

test('alteração de total não crédito: pagas mantêm valor e as não pagas recebem o saldo igualmente', () => {
  const s = setup();
  saveLedgerEntry(s, base({ amount: 90000 }), { mode: 'installments', count: 3 });
  saveEntry(s, { ...s.entries[0], paid: true });
  updateInstallmentTotal(s, 'x:0', 120000);
  assert.deepEqual(
    s.entries.map((e) => e.amount),
    [30000, 45000, 45000],
  );
  assert.deepEqual(
    s.entries.map((e) => e.paid),
    [true, false, false],
  );
  assert.deepEqual(ids(s), ['x:0', 'x:1', 'x:2']);
});

test('alteração de total não crédito: o saldo é dividido com ajuste de centavos nas primeiras', () => {
  const s = setup();
  saveLedgerEntry(s, base({ amount: 90000 }), { mode: 'installments', count: 3 });
  saveEntry(s, { ...s.entries[0], paid: true });
  updateInstallmentTotal(s, 'x:0', 30001 + 30000);
  assert.deepEqual(
    s.entries.map((e) => e.amount),
    [30000, 15001, 15000],
  );
});

test('alteração de total recusa total que não cobre o valor pago, sem alterar o estado', () => {
  const s = setup();
  saveLedgerEntry(s, base({ amount: 90000 }), { mode: 'installments', count: 3 });
  saveEntry(s, { ...s.entries[0], paid: true });
  const before = snapshot(s);
  assert.throws(() => updateInstallmentTotal(s, 'x:0', 30000), /não cobre o valor já pago/);
  assert.equal(snapshot(s), before);
});

test('alteração de total recusa quando não há parcela não paga para receber o saldo', () => {
  const s = setup();
  saveLedgerEntry(s, base({ amount: 90000 }), { mode: 'installments', count: 2 });
  s.entries.forEach((e) => (e.paid = true));
  const before = snapshot(s);
  assert.throws(() => updateInstallmentTotal(s, 'x:0', 100000), /Não há parcelas não pagas/);
  assert.equal(snapshot(s), before);
});

test('alteração de total recusa saldo menor que um centavo por parcela não paga', () => {
  const s = setup();
  saveLedgerEntry(s, base({ amount: 90000 }), { mode: 'installments', count: 3 });
  saveEntry(s, { ...s.entries[0], paid: true });
  assert.throws(() => updateInstallmentTotal(s, 'x:0', 30001), /pelo menos R\$ 0,01/);
});

test('alteração de total de crédito redistribui entre todas as parcelas, todas reconhecidas', () => {
  const s = setup();
  saveLedgerEntry(s, base({ amount: 90000, paymentMethodId: 'P4' }), {
    mode: 'installments',
    count: 3,
  });
  updateInstallmentTotal(s, 'x:0', 120000);
  assert.deepEqual(
    s.entries.map((e) => e.amount),
    [40000, 40000, 40000],
  );
  assert.ok(s.entries.every((e) => e.paid === true));
});

test('prévia do total não grava nada', () => {
  const s = setup();
  saveLedgerEntry(s, base({ amount: 90000 }), { mode: 'installments', count: 3 });
  const before = snapshot(s);
  const plan = installmentTotalPlan(s, 'x:0', 120000);
  assert.deepEqual(
    plan.map((p) => p.to),
    [30000, 45000, 45000],
  );
  assert.equal(snapshot(s), before);
});

test('exclusão de parcela isolada renumera as restantes, mantém IDs e atualiza seriesCount', () => {
  const s = setup();
  saveLedgerEntry(s, base({ amount: 4000 }), { mode: 'installments', count: 4 });
  deleteLedgerEntry(s, 'x:1');
  assert.deepEqual(ids(s), ['x:0', 'x:2', 'x:3']);
  assert.deepEqual(idx(s), [1, 2, 3]);
  assert.deepEqual(counts(s), [3, 3, 3]);
  assert.deepEqual(
    s.entries.map((e) => e.amount),
    [1000, 1000, 1000],
  );
  assert.doesNotThrow(() => validateSeriesSequence(s));
});

test('"esta e as seguintes" remove a escolhida e as posteriores e renumera as anteriores', () => {
  const s = setup();
  saveLedgerEntry(s, base({ amount: 4000 }), { mode: 'installments', count: 4 });
  deleteInstallmentsFrom(s, 'x:2');
  assert.deepEqual(ids(s), ['x:0', 'x:1']);
  assert.deepEqual(idx(s), [1, 2]);
  assert.deepEqual(counts(s), [2, 2]);
});

test('"esta e as seguintes" que deixaria uma única parcela converte o restante em avulso, com o mesmo id', () => {
  const s = setup();
  saveLedgerEntry(s, base({ amount: 4000, walletId: 'w' }), { mode: 'installments', count: 4 });
  saveEntry(s, { ...s.entries[0], paid: true });
  const before = s.entries[0];
  deleteInstallmentsFrom(s, 'x:1');
  assert.equal(s.entries.length, 1);
  const [rest] = s.entries;
  assert.equal(rest.id, 'x:0');
  assert.equal(rest.amount, before.amount);
  assert.equal(rest.date, before.date);
  assert.equal(rest.paid, true);
  assert.equal(rest.paymentMethodId, before.paymentMethodId);
  assert.equal(rest.walletId, 'w');
  for (const key of ['seriesId', 'seriesKind', 'seriesIndex', 'seriesCount'])
    assert.equal(rest[key], undefined, key);
  assert.doesNotThrow(() => validateLedger(s));
});

test('"série inteira" remove todas as parcelas', () => {
  const s = setup();
  saveLedgerEntry(s, base({ amount: 4000 }), { mode: 'installments', count: 4 });
  deleteInstallmentSeries(s, 'x:0');
  assert.equal(s.entries.length, 0);
});

test('exclusão de parcela paga não cria movimentação: o saldo recalcula sem a despesa', () => {
  const s = setup();
  saveLedgerEntry(s, base({ amount: 90000, walletId: 'w' }), { mode: 'installments', count: 3 });
  saveEntry(s, { ...s.entries[0], paid: true });
  assert.equal(walletBalance(s, 'w', '2026-12-31'), 100000 - 30000);
  deleteLedgerEntry(s, 'x:0');
  assert.equal(walletBalance(s, 'w', '2026-12-31'), 100000);
  assert.equal(s.moves, undefined);
});

test('exclusão atômica: falha no meio da operação deixa o estado intacto', () => {
  const s = setup();
  saveLedgerEntry(s, base({ amount: 4000 }), { mode: 'installments', count: 3 });
  s.entries[2].id = 'outra:2';
  const before = snapshot(s);
  assert.throws(() => deleteLedgerEntry(s, 'x:1'), /Identificador de parcela inconsistente/);
  assert.equal(snapshot(s), before);
});

test('validação de sequência recusa lacunas e contagem divergente em parcelas', () => {
  const s = setup();
  saveLedgerEntry(s, base({ amount: 4000 }), { mode: 'installments', count: 3 });
  s.entries[1].seriesIndex = 3;
  assert.throws(() => validateSeriesSequence(s), /Sequência de parcelas inconsistente/);
  const t = setup();
  saveLedgerEntry(t, base({ amount: 4000 }), { mode: 'installments', count: 3 });
  t.entries.pop();
  assert.throws(() => validateSeriesSequence(t), /Sequência de parcelas inconsistente/);
});

test('encerrar repeat com crédito remove só datas futuras a partir da posição, sem renumerar', () => {
  const s = setup();
  saveLedgerEntry(s, base({ date: '2026-11-27', amount: 2990, paymentMethodId: 'P4' }), {
    mode: 'repeat',
    count: 6,
  });
  const result = stopSeries(s, 'x:2', { today: '2026-11-27' });
  assert.deepEqual(result, { removed: 4, preserved: 0 });
  assert.deepEqual(ids(s), ['x:0', 'x:1']);
  assert.deepEqual(idx(s), [1, 2]);
  assert.deepEqual(counts(s), [6, 6]);
});

test('encerrar repeat com crédito preserva a ocorrência com data igual a hoje', () => {
  const s = setup();
  saveLedgerEntry(s, base({ date: '2026-11-27', amount: 2990, paymentMethodId: 'P4' }), {
    mode: 'repeat',
    count: 4,
  });
  const plan = repeatCreditStopPlan(s, 'x:0', '2026-11-27');
  assert.deepEqual(plan.removeIds, ['x:1', 'x:2', 'x:3']);
  assert.deepEqual(plan.preservedIds, ['x:0']);
  assert.deepEqual(stopSeries(s, 'x:0', { today: '2026-11-27' }), { removed: 3, preserved: 1 });
  assert.deepEqual(ids(s), ['x:0']);
});

test('encerrar repeat com crédito exige data de hoje e recusa quando não há futuras', () => {
  const s = setup();
  saveLedgerEntry(s, base({ date: '2026-11-27', amount: 2990, paymentMethodId: 'P4' }), {
    mode: 'repeat',
    count: 2,
  });
  assert.throws(() => stopSeries(s, 'x:0'), /Informe a data de hoje/);
  const before = snapshot(s);
  assert.throws(() => stopSeries(s, 'x:0', { today: '2027-06-01' }), /Não há ocorrências futuras/);
  assert.equal(snapshot(s), before);
});

test('encerrar repeat com crédito preserva as ocorrências anteriores à posição escolhida', () => {
  const s = setup();
  saveLedgerEntry(s, base({ date: '2026-11-27', amount: 2990, paymentMethodId: 'P4' }), {
    mode: 'repeat',
    count: 4,
  });
  stopSeries(s, 'x:2', { today: '2026-11-27' });
  assert.deepEqual(ids(s), ['x:0', 'x:1']);
});

test('repeat com crédito e encerramento não alteram o saldo da carteira', () => {
  const s = setup();
  saveLedgerEntry(s, base({ date: '2026-11-27', amount: 2990, paymentMethodId: 'P4' }), {
    mode: 'repeat',
    count: 3,
  });
  stopSeries(s, 'x:1', { today: '2026-11-27' });
  assert.equal(walletBalance(s, 'w', '2026-12-31'), 100000);
  assert.doesNotThrow(() => validateLedger(s));
});

test('stopSeries não encerra parcelas: indica as exclusões aprovadas, sem alterar o estado', () => {
  const s = setup();
  saveLedgerEntry(s, base({ amount: 4000 }), { mode: 'installments', count: 4 });
  const before = snapshot(s);
  assert.throws(() => stopSeries(s, 'x:0'), /esta parcela.*esta e as seguintes/);
  assert.equal(snapshot(s), before);
});
