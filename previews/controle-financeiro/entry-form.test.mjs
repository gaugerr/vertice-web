import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState } from './finance-domain.mjs';
import { saveLedgerEntry as saveLedger } from './finance-ledger.mjs';
import {
  seriesPreview,
  seriesSummary,
  paidCopy,
  isCreditMethod,
  formatBRL,
} from './entry-form.mjs';

test('prévia de parcelas e repetições coincide com o que saveLedgerEntry grava', () => {
  const cases = [
    { amount: 10000, count: 3, mode: 'installments', date: '2026-01-31' },
    { amount: 100, count: 3, mode: 'installments', date: '2026-11-27' },
    { amount: 2990, count: 12, mode: 'repeat', date: '2026-11-05' },
    { amount: 90000, count: 120, mode: 'installments', date: '2026-02-28' },
  ];
  for (const c of cases) {
    const s = emptyState();
    saveLedger(
      s,
      {
        id: 'x',
        name: 'Teste',
        amount: c.amount,
        date: c.date,
        categoryId: 'D16',
        paymentMethodId: 'P2',
        type: 'expense',
        paid: false,
        observation: '',
      },
      { mode: c.mode, count: c.count },
    );
    const saved = s.entries.sort((a, b) => a.seriesIndex - b.seriesIndex);
    const p = seriesPreview(c);
    assert.deepEqual(
      p.amounts,
      saved.map((e) => e.amount),
      JSON.stringify(c),
    );
    assert.deepEqual(
      p.dates,
      saved.map((e) => e.date),
      JSON.stringify(c),
    );
    assert.equal(p.total, c.mode === 'repeat' ? c.amount * c.count : c.amount);
  }
});

test('prévia recusa entradas que o domínio também recusa', () => {
  assert.equal(
    seriesPreview({ amount: 2, count: 3, mode: 'installments', date: '2026-01-10' }),
    null,
  );
  assert.equal(
    seriesPreview({ amount: 100, count: 1, mode: 'installments', date: '2026-01-10' }),
    null,
  );
  assert.equal(seriesPreview({ amount: 100, count: 2, mode: 'single', date: '2026-01-10' }), null);
  assert.equal(seriesPreview({ amount: 0, count: 2, mode: 'repeat', date: '2026-01-10' }), null);
  assert.equal(seriesPreview({ amount: 100, count: 2, mode: 'repeat', date: '10/01/2026' }), null);
});

test('resumo explica o efeito da configuração em português', () => {
  const p = seriesPreview({ amount: 10000, count: 3, mode: 'installments', date: '2026-11-27' });
  assert.match(
    seriesSummary(p, 'installments').replace(/\u00a0/g, ' '),
    /^3 parcelas de R\$ 33,34 nas primeiras e R\$ 33,33 nas demais, de 27\/11\/2026 a 27\/01\/2027\. Total R\$ 100,00\.$/,
  );
  const r = seriesPreview({ amount: 2990, count: 2, mode: 'repeat', date: '2026-11-27' });
  assert.equal(
    seriesSummary(r, 'repeat').replace(/\u00a0/g, ' '),
    '2 lançamentos de R$ 29,90, de 27/11/2026 a 27/12/2026.',
  );
  assert.equal(formatBRL(123456).replace(/\u00a0/g, ' '), 'R$ 1.234,56');
});

test('texto de pagamento distingue crédito, despesa e receita', () => {
  assert.equal(
    paidCopy({ type: 'expense', isCredit: true, paid: true }).label,
    'Contar como gasto deste mês',
  );
  assert.equal(paidCopy({ type: 'expense', isCredit: false, paid: true }).label, 'Já foi pago');
  assert.equal(paidCopy({ type: 'income', isCredit: false, paid: true }).label, 'Já foi recebido');
  assert.equal(isCreditMethod({ name: 'Cartão de Crédito' }), true);
  assert.equal(isCreditMethod({ name: 'Cartão de Débito' }), false);
  assert.equal(isCreditMethod(undefined), false);
});
