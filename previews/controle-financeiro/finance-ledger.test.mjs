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
  saveCard,
  saveMove,
  saveLedgerEntry,
  deleteLedgerEntry,
  walletBalance,
  invoice,
  invoiceMonth,
} from './finance-ledger.mjs';
import { financeRows, readFinance } from '../../shared/workspaces/mapping.mjs';
import { createBackup, readBackup } from './finance-backup.mjs';
const setup = () => {
  const s = emptyState();
  saveWallet(s, { id: 'w', name: 'Conta', openingBalance: 100000, openingDate: '2026-01-01' });
  saveWallet(s, { id: 'w2', name: 'Outra', openingBalance: 0, openingDate: '2026-01-01' });
  saveCard(s, { id: 'c', name: 'Cartão', closingDay: 20, dueDay: 5 });
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
test('fechamento é exclusivo e vencimento usa data civil inclusive fevereiro', () => {
  const c = { closingDay: 20, dueDay: 5 };
  assert.equal(invoiceMonth(c, '2026-11-19'), '2026-12');
  assert.equal(invoiceMonth(c, '2026-11-20'), '2027-01');
  assert.equal(invoiceMonth({ closingDay: 5, dueDay: 10 }, '2026-11-04'), '2026-11');
});
test('fatura parcial liquida compras existentes, sem duplicar despesa nem débito bancário', () => {
  let s = setup();
  saveLedgerEntry(s, entry({ cardId: 'c', purchaseDate: '2026-11-10', paid: false }), {
    mode: 'installments',
    count: 3,
  });
  saveMove(s, {
    id: 'pay1',
    kind: 'invoice',
    fromWalletId: 'w',
    cardId: 'c',
    month: '2026-12',
    amount: 1000,
    date: '2026-12-05',
  });
  s = readFinance(financeRows(s));
  assert.equal(totals(monthlyRows(s, '2026-12')).expense, 1000);
  assert.equal(totals(monthlyRows(s, '2026-12')).expectedExpense, 3334);
  assert.equal(walletBalance(s, 'w', '2026-12-05'), 99000);
  assert.equal(invoice(s, 'c', '2026-12').remaining, 2334);
  assert.throws(() => deleteLedgerEntry(s, s.entries[0].id), /Desfaça/);
  saveMove(s, {
    id: 'pay2',
    kind: 'invoice',
    fromWalletId: 'w',
    cardId: 'c',
    month: '2026-12',
    amount: 2334,
    date: '2026-12-06',
  });
  s = readFinance(financeRows(s));
  assert.equal(totals(monthlyRows(s, '2026-12')).expense, 3334);
  assert.equal(walletBalance(s, 'w', '2026-12-06'), 96666);
  assert.throws(() =>
    saveMove(s, {
      id: 'over',
      kind: 'invoice',
      fromWalletId: 'w',
      cardId: 'c',
      month: '2026-12',
      amount: 1,
      date: '2026-12-06',
    }),
  );
  s.moves = [];
  s = readFinance(financeRows(s));
  assert.equal(totals(monthlyRows(s, '2026-12')).expense, 0);
  assert.equal(walletBalance(s, 'w', '2026-12-06'), 100000);
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
test('backup mantém contas, cartões e movimentos; legado continua válido', () => {
  const s = setup();
  s.revision = 0;
  validateState(s);
  const restored = readBackup(createBackup(s));
  assert.equal(restored.wallets.length, 2);
  assert.equal(restored.cards.length, 1);
  validateState(emptyState());
  assert.throws(() => validateState({ ...s, wallets: [{ ...s.wallets[0], openingBalance: NaN }] }));
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
