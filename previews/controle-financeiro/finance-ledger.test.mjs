import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState,
  validateState,
  monthlyRows,
  totals,
  overviewData,
  copyPreviousBudget,
  payFixed,
  correctPayment,
  saveFixed,
} from './finance-domain.mjs';
import {
  stopSeries,
  saveMonthlyLimit,
  saveWallet,
  saveMove,
  saveLedgerEntry,
  walletBalance,
} from './finance-ledger.mjs';
import { financeRows, readFinance, isLegacyCardRecord } from '../../shared/workspaces/mapping.mjs';
import { createBackup, readBackup } from './finance-backup.mjs';
const setup = () => {
  const s = emptyState();
  saveWallet(s, { id: 'w', name: 'Conta', openingBalance: 100000, openingDate: '2026-01-01' });
  saveWallet(s, { id: 'w2', name: 'Outra', openingBalance: 0, openingDate: '2026-01-01' });
  return s;
};
const entry = (over) => ({
  id: 'e',
  name: 'Compra',
  type: 'expense',
  date: '2026-11-10',
  amount: 10000,
  categoryId: 'D01',
  paymentMethodId: 'P2',
  paid: true,
  observation: '',
  ...over,
});
test('parcelas conservam centavos e dia civil entre meses e anos, sem repetir o total', () => {
  const s = setup();
  saveLedgerEntry(s, entry({ date: '2026-12-31', amount: 10000 }), {
    mode: 'installments',
    count: 3,
  });
  assert.deepEqual(
    s.entries.map((e) => e.amount),
    [3334, 3333, 3333],
  );
  assert.deepEqual(
    s.entries.map((e) => e.date),
    ['2026-12-31', '2027-01-31', '2027-02-28'],
  );
  assert.deepEqual(
    s.entries.map((e) => e.paid),
    [true, false, false],
  );
  assert.equal(totals(monthlyRows(s, '2027-01')).expense, 0);
  assert.equal(totals(monthlyRows(s, '2027-01')).expectedExpense, 3333);
});
test('receita repetida tem competências próprias e apenas primeiro recebimento confirmado', () => {
  const s = setup();
  saveLedgerEntry(
    s,
    entry({ type: 'income', categoryId: 'R01', amount: 1200, date: '2028-01-31' }),
    { mode: 'repeat', count: 3 },
  );
  assert.deepEqual(
    s.entries.map((e) => e.date),
    ['2028-01-31', '2028-02-29', '2028-03-31'],
  );
  assert.equal(totals(monthlyRows(s, '2028-02')).income, 0);
  assert.equal(
    s.entries.reduce((n, e) => n + e.amount, 0),
    3600,
  );
});
test('transferência não é receita, saldo inicial não entra em totais e transferência é atômica', () => {
  const s = setup();
  saveMove(s, {
    id: 't',
    kind: 'transfer',
    fromWalletId: 'w',
    toWalletId: 'w2',
    amount: 20000,
    date: '2026-11-11',
  });
  assert.equal(walletBalance(s, 'w', '2026-11-11'), 80000);
  assert.equal(walletBalance(s, 'w2', '2026-11-11'), 20000);
  assert.equal(totals(monthlyRows(s, '2026-11')).income, 0);
  assert.throws(() =>
    saveMove(s, {
      id: 'bad',
      kind: 'transfer',
      fromWalletId: 'w',
      toWalletId: 'w',
      amount: 1,
      date: '2026-11-11',
    }),
  );
  assert.equal(s.moves.length, 1);
});
test('contas fixas preservam a conta dos pagamentos e da correção', () => {
  let s = setup();
  saveFixed(s, {
    id: 'fixed',
    name: 'Aluguel',
    amount: 10000,
    dueDay: 5,
    categoryId: 'D01',
    paymentMethodId: 'P2',
    startMonth: '2026-11',
    from: '2026-11',
    endMonth: null,
  });
  payFixed(s, 'fixed', '2026-11', { amount: 10000, date: '2026-11-05', walletId: 'w' });
  correctPayment(s, 'fixed', '2026-11', { amount: 9000, date: '2026-11-06' });
  s = readFinance(financeRows(s));
  assert.equal(walletBalance(s, 'w', '2026-11-06'), 91000);
});
test('backup mantém contas e movimentos; legado continua válido', () => {
  const s = setup();
  s.revision = 0;
  validateState(s);
  const notes = [];
  const restored = readBackup(createBackup(s), notes);
  assert.equal(restored.wallets.length, 2);
  assert.deepEqual(notes, []);
  validateState(emptyState());
  assert.throws(() => validateState({ ...s, wallets: [{ ...s.wallets[0], openingBalance: NaN }] }));
});
const legacyBackup = (state) =>
  JSON.stringify({
    app: 'vertice-finance-preview',
    formatVersion: 1,
    exportedAt: '2026-11-26T21:00:00.000Z',
    state: { ...setup(), revision: 0, ...state },
  });
const card = { id: 'c', name: 'Cartão', closingDay: 20, dueDay: 5, active: true };
test('backup antigo com cartão mantém valores: compras viram despesas e faturas pagas, saldo da conta', () => {
  const notes = [];
  const restored = readBackup(
    legacyBackup({
      cards: [card],
      entries: [
        entry({
          id: 'p1',
          date: '2026-12-05',
          cardId: 'c',
          purchaseDate: '2026-11-10',
          paid: true,
        }),
        entry({
          id: 'p2',
          amount: 3000,
          date: '2026-12-05',
          cardId: 'c',
          purchaseDate: '2026-11-11',
          paid: false,
          paidAmount: 0,
          remainingAmount: 3000,
        }),
      ],
      moves: [
        {
          id: 'pay1',
          kind: 'invoice',
          fromWalletId: 'w',
          cardId: 'c',
          month: '2026-12',
          amount: 10000,
          date: '2026-12-05',
        },
      ],
    }),
    notes,
  );
  assert.equal(restored.cards, undefined);
  assert.equal(restored.moves.length, 0);
  assert.ok(restored.entries.every((e) => e.cardId === undefined && e.purchaseDate === undefined));
  // The invoice payment was R$ 100,00 out of the wallet; the balance stays the same.
  assert.equal(walletBalance(restored, 'w', '2026-12-05'), 90000);
  assert.equal(totals(monthlyRows(restored, '2026-12')).expense, 10000);
  assert.equal(totals(monthlyRows(restored, '2026-12')).expectedExpense, 13000);
  assert.equal(notes.length, 3);
  assert.equal(
    financeRows(restored).some((r) => r.entity === 'finance_cards'),
    false,
  );
});
test('backup antigo com fatura paga em parte é recusado em vez de perder o valor pago', () => {
  assert.throws(
    () =>
      readBackup(
        legacyBackup({
          cards: [card],
          entries: [
            entry({
              cardId: 'c',
              purchaseDate: '2026-11-10',
              paid: false,
              paidAmount: 4000,
              remainingAmount: 6000,
            }),
          ],
        }),
      ),
    /paga em parte/,
  );
});
test('registros antigos de cartão vindos do servidor são ignorados na leitura', () => {
  const rows = financeRows(setup());
  const legacy = [
    { entity: 'finance_cards', id: 'c', body: { id: 'c', name: 'Cartão', closing_day: 20 } },
    {
      entity: 'finance_moves',
      id: 'pay1',
      body: { id: 'pay1', kind: 'invoice', from_wallet_id: 'w', card_id: 'c', amount_cents: 1 },
    },
  ];
  assert.ok(legacy.every(isLegacyCardRecord));
  assert.equal(rows.some(isLegacyCardRecord), false);
  const s = readFinance([
    ...rows,
    ...legacy,
    {
      entity: 'finance_entries',
      id: 'x',
      body: {
        id: 'x',
        source: 'manual',
        kind: 'expense',
        name: 'Compra',
        reference_date: '2026-12-05',
        planned_amount_cents: 500,
        settlement_discount_cents: 0,
        category_id: 'D01',
        payment_method_id: 'P2',
        observation: '',
        extra: { cardId: 'c', purchaseDate: '2026-11-10' },
      },
    },
  ]);
  assert.equal(s.cards, undefined);
  assert.equal(s.moves, undefined);
  assert.equal(s.entries.find((e) => e.id === 'x').cardId, undefined);
  assert.equal(s.entries.find((e) => e.id === 'x').purchaseDate, undefined);
});

test('limite global mensal não reescreve categorias, aceita zero e é preservado no mapeamento', () => {
  let s = setup();
  s.monthlyBudgets = { '2026-11': { D01: 1000 } };
  saveLedgerEntry(s, entry({ amount: 1200 }));
  saveMonthlyLimit(s, '2026-11', 2000);
  s = readFinance(financeRows(s));
  assert.equal(overviewData(s, '2026-11').budget.remaining, 800);
  assert.equal(s.monthlyBudgets['2026-11'].D01, 1000);
  saveMonthlyLimit(s, '2026-11', 0);
  assert.equal(overviewData(s, '2026-11').budget.remaining, -1200);
  saveMonthlyLimit(s, '2026-11', null);
  assert.equal(overviewData(s, '2026-11').budget.scope, 'categories');
});

test('encerrar uma série mantém pagamentos e remove apenas parcelas futuras em aberto', () => {
  const s = setup();
  saveLedgerEntry(s, entry(), { mode: 'installments', count: 3 });
  stopSeries(s, s.entries[0].id);
  assert.equal(s.entries.length, 1);
  assert.equal(s.entries[0].paid, true);
});

test('cópia do orçamento mensal preserva zero e não altera o mês anterior', () => {
  const s = setup();
  saveMonthlyLimit(s, '2026-10', 0);
  saveMonthlyLimit(s, '2026-11', 999);
  copyPreviousBudget(s, '2026-11');
  assert.equal(s.monthlyLimits['2026-11'], 0);
  assert.equal(s.monthlyLimits['2026-10'], 0);
});
