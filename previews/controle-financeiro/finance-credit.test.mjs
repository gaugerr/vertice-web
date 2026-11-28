// Regras globais de crédito, classificação mensal e Quanto sobrou.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState,
  summaryTotals,
  monthClassification,
  expenseSituations,
  monthlyRows,
  saveEntry,
} from './finance-domain.mjs';
import { saveLedgerEntry, saveWallet, walletBalance, validateLedger } from './finance-ledger.mjs';

const TODAY = '2026-11-27';
const setup = () => {
  const s = emptyState();
  saveWallet(s, { id: 'w', name: 'Banco', openingBalance: 100000, openingDate: '2026-01-01' });
  return s;
};
const entry = (over) => ({
  id: 'e',
  name: 'Compra',
  type: 'expense',
  date: '2026-11-10',
  amount: 50000,
  categoryId: 'D01',
  paymentMethodId: 'P4',
  paid: false,
  observation: '',
  ...over,
});
const credit = (over) => entry({ paymentMethodId: 'P4', ...over });
const pix = (over) => entry({ paymentMethodId: 'P2', paid: true, ...over });
const salary = (over) =>
  entry({
    id: 'sal',
    name: 'Salário',
    type: 'income',
    categoryId: 'R01',
    amount: 500000,
    paymentMethodId: 'P2',
    paid: true,
    date: '2026-11-05',
    ...over,
  });

test('crédito em repeat: todas as ocorrências são reconhecidas e sem conta', () => {
  const s = setup();
  saveLedgerEntry(s, credit({ paid: false, date: '2026-11-27' }), { mode: 'repeat', count: 3 });
  assert.deepEqual(
    s.entries.map((e) => e.paid),
    [true, true, true],
  );
  assert.ok(s.entries.every((e) => e.walletId === undefined));
  assert.doesNotThrow(() => validateLedger(s));
});

test('crédito em installments: todas as parcelas reconhecidas, sem conta, divisão exata', () => {
  const s = setup();
  saveLedgerEntry(s, credit({ amount: 90000, date: '2026-11-12' }), {
    mode: 'installments',
    count: 3,
  });
  assert.deepEqual(
    s.entries.map((e) => e.amount),
    [30000, 30000, 30000],
  );
  assert.deepEqual(
    s.entries.map((e) => e.paid),
    [true, true, true],
  );
  assert.ok(s.entries.every((e) => e.walletId === undefined));
});

test('crédito com conta vinculada é recusado em lançamento avulso, série e edição', () => {
  const s = setup();
  assert.throws(() => saveLedgerEntry(s, credit({ walletId: 'w' })), /não movimenta carteira/);
  assert.throws(
    () => saveLedgerEntry(s, credit({ walletId: 'w' }), { mode: 'repeat', count: 2 }),
    /não movimenta carteira/,
  );
  saveLedgerEntry(s, credit());
  assert.throws(() => saveEntry(s, { ...s.entries[0], walletId: 'w' }), /não movimenta carteira/);
});

test('crédito não movimenta saldo de carteira', () => {
  const s = setup();
  saveLedgerEntry(s, credit({ amount: 30000 }), { mode: 'repeat', count: 2 });
  assert.equal(walletBalance(s, 'w', '2026-12-31'), 100000);
});

test('validação recusa crédito não reconhecido ou com conta, mesmo vindo de estado externo', () => {
  const s = setup();
  saveLedgerEntry(s, credit());
  s.entries[0].paid = false;
  assert.throws(() => validateLedger(s), /crédito inválido/);
  s.entries[0].paid = true;
  s.entries[0].walletId = 'w';
  assert.throws(() => validateLedger(s), /crédito inválido/);
});

test('série de crédito não converte para outra forma, e a forma não converte para crédito', () => {
  const s = setup();
  saveLedgerEntry(s, credit({ amount: 90000 }), { mode: 'installments', count: 3 });
  assert.throws(
    () => saveEntry(s, { ...s.entries[1], paymentMethodId: 'P2' }),
    /não pode mudar entre crédito/,
  );
  const t = setup();
  saveLedgerEntry(t, pix({ amount: 2990 }), { mode: 'repeat', count: 2 });
  assert.throws(
    () => saveEntry(t, { ...t.entries[1], paymentMethodId: 'P4' }),
    /não pode mudar entre crédito/,
  );
});

test('Quanto sobrou do exemplo: lançadas, previstas do mês e parcelas futuras sem antecipação', () => {
  const s = setup();
  saveLedgerEntry(s, salary());
  saveLedgerEntry(s, pix({ id: 'pix', amount: 50000, date: '2026-11-10' }));
  saveLedgerEntry(s, credit({ id: 'avista', amount: 50000, date: '2026-11-10' }));
  saveLedgerEntry(s, credit({ id: 'parc', amount: 90000, date: '2026-11-12' }), {
    mode: 'installments',
    count: 3,
  });
  saveLedgerEntry(s, credit({ id: 'futuro', amount: 20000, date: '2026-11-30' }));
  const nov = monthClassification(s, '2026-11', TODAY);
  assert.equal(nov.quantoSobrou, 350000);
  assert.equal(nov.lancadas, 130000);
  assert.equal(nov.previstas, 20000);
  assert.equal(nov.compromissosFuturos.amount, 60000);
  const dez = monthClassification(s, '2026-12', TODAY);
  assert.equal(dez.creditForecast, 30000);
  assert.equal(dez.quantoSobrou, -30000);
});

test('classificação: cada despesa cai em exatamente uma situação e nada é contado duas vezes', () => {
  const s = setup();
  saveLedgerEntry(s, pix({ id: 'a', amount: 1000, date: '2026-11-03' }));
  saveLedgerEntry(s, pix({ id: 'b', amount: 2000, date: '2026-12-03' }));
  saveLedgerEntry(
    s,
    entry({ id: 'c', amount: 3000, date: '2026-11-03', paymentMethodId: 'P2', paid: false }),
  );
  saveLedgerEntry(
    s,
    entry({ id: 'd', amount: 4000, date: '2026-11-29', paymentMethodId: 'P2', paid: false }),
  );
  saveLedgerEntry(s, credit({ id: 'e', amount: 5000, date: '2026-11-03' }));
  saveLedgerEntry(s, credit({ id: 'f', amount: 6000, date: '2026-11-29' }));
  const rows = monthlyRows(s, '2026-11');
  const expenses = expenseSituations(rows, TODAY);
  assert.equal(expenses.paid, 1000);
  assert.equal(expenses.creditRecognized, 5000);
  assert.equal(expenses.creditForecast, 6000);
  assert.equal(expenses.unpaid, 7000);
  assert.equal(expenses.lancadas + expenses.previstas, expenses.total);
  assert.equal(
    expenses.total,
    rows.filter((r) => r.type === 'expense').reduce((n, r) => n + r.amount, 0),
  );
});

test('despesa paga com data futura entra em pagas e lançadas; não paga, mesmo vencida, entra em previstas', () => {
  const s = setup();
  saveLedgerEntry(s, pix({ id: 'fut', amount: 1000, date: '2026-11-29' }));
  saveLedgerEntry(
    s,
    entry({ id: 'venc', amount: 2000, date: '2026-11-03', paymentMethodId: 'P2', paid: false }),
  );
  const x = expenseSituations(monthlyRows(s, '2026-11'), TODAY);
  assert.equal(x.lancadas, 1000);
  assert.equal(x.previstas, 2000);
  assert.equal(monthClassification(s, '2026-11', TODAY).quantoSobrou, -1000);
});

test('Quanto sobrou novo bate com o indicador existente quando não há previstas de crédito', () => {
  const s = setup();
  saveLedgerEntry(s, salary());
  saveLedgerEntry(s, pix({ id: 'p', amount: 50000, date: '2026-11-10' }));
  saveLedgerEntry(s, credit({ id: 'c', amount: 50000, date: '2026-11-10' }));
  assert.equal(
    monthClassification(s, '2026-11', TODAY).quantoSobrou,
    summaryTotals(s, '2026-11').remainingAfterSaving,
  );
  assert.equal(monthClassification(s, '2026-11', TODAY).quantoSobrou, 400000);
});

test('conversão de avulso para crédito sem conta: permitida e mantém id e dados', () => {
  const s = setup();
  saveLedgerEntry(s, pix({ id: 'av', amount: 4000, date: '2026-11-10' }));
  const impact = saveEntry(s, { ...s.entries[0], paymentMethodId: 'P4' });
  assert.equal(impact, null);
  assert.equal(s.entries[0].id, 'av');
  assert.equal(s.entries[0].amount, 4000);
  assert.equal(s.entries[0].paid, true);
  assert.equal(s.entries[0].walletId, undefined);
});

test('conversão de avulso com conta exige confirmação explícita e informa o impacto', () => {
  const s = setup();
  saveLedgerEntry(s, pix({ id: 'av', amount: 4000, date: '2026-11-10', walletId: 'w' }));
  assert.equal(walletBalance(s, 'w', '2026-12-31'), 96000);
  assert.throws(
    () => saveEntry(s, { ...s.entries[0], paymentMethodId: 'P4', walletId: undefined }),
    /Confirme a remoção do vínculo/,
  );
  assert.equal(s.entries[0].walletId, 'w');
  assert.throws(
    () =>
      saveEntry(
        s,
        { ...s.entries[0], paymentMethodId: 'P4', walletId: 'w' },
        { removeWallet: true },
      ),
    /não movimenta carteira/,
  );
  const impact = saveEntry(
    s,
    { ...s.entries[0], paymentMethodId: 'P4', walletId: undefined },
    { removeWallet: true },
  );
  assert.deepEqual(impact, {
    change: 'removed',
    walletId: 'w',
    amount: 4000,
    type: 'expense',
    paid: true,
  });
  assert.equal(s.entries[0].walletId, undefined);
  assert.equal(s.entries[0].id, 'av');
  assert.equal(walletBalance(s, 'w', '2026-12-31'), 100000);
  assert.doesNotThrow(() => validateLedger(s));
});

test('crédito novo com conta é recusado e a forma de pagamento não depende do nome exibido', () => {
  const s = setup();
  assert.throws(() => saveLedgerEntry(s, credit({ walletId: 'w' })), /não movimenta carteira/);
  const renamed = emptyState();
  saveWallet(renamed, { id: 'w', name: 'Banco', openingBalance: 0, openingDate: '2026-01-01' });
  renamed.methods.find((m) => m.id === 'P4').name = 'Crédito renomeado';
  saveLedgerEntry(renamed, credit({ id: 'r', amount: 3000, date: '2026-11-10' }));
  assert.equal(renamed.entries[0].paid, true);
  assert.equal(monthClassification(renamed, '2026-11', TODAY).creditRecognized, 3000);
});

test('conversão de crédito para Pix sem conta: permitida, sem impacto e sem alterar saldo', () => {
  const s = setup();
  saveLedgerEntry(s, credit({ id: 'c', amount: 4000, date: '2026-11-10' }));
  const impact = saveEntry(s, { ...s.entries[0], paymentMethodId: 'P2' });
  assert.equal(impact, null);
  assert.equal(s.entries[0].paymentMethodId, 'P2');
  assert.equal(s.entries[0].paid, true);
  assert.equal(walletBalance(s, 'w', '2026-12-31'), 100000);
});

test('conversão de crédito para Pix com conta pagas: débito explícito, informado como impacto', () => {
  const s = setup();
  saveLedgerEntry(s, credit({ id: 'c', amount: 4000, date: '2026-11-10' }));
  const impact = saveEntry(s, { ...s.entries[0], paymentMethodId: 'P2', walletId: 'w' });
  assert.deepEqual(impact, {
    change: 'added',
    walletId: 'w',
    amount: 4000,
    type: 'expense',
    date: '2026-11-10',
  });
  assert.equal(walletBalance(s, 'w', '2026-12-31'), 96000);
  assert.equal(s.moves, undefined);
  assert.doesNotThrow(() => validateLedger(s));
});

test('conversão de crédito para Pix com conta não paga: sem débito e sem impacto', () => {
  const s = setup();
  saveLedgerEntry(s, credit({ id: 'c', amount: 4000, date: '2026-11-10' }));
  const impact = saveEntry(s, {
    ...s.entries[0],
    paymentMethodId: 'P2',
    walletId: 'w',
    paid: false,
  });
  assert.equal(impact, null);
  assert.equal(walletBalance(s, 'w', '2026-12-31'), 100000);
});
