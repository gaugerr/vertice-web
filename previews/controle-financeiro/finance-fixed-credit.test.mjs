// Contas fixas com forma Crédito: regras globais de crédito, geração de ocorrências e cálculos.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState,
  saveFixed,
  fixedRows,
  monthClassification,
  payFixed,
  monthlyRows,
  adjustFixed,
} from './finance-domain.mjs';
import { validateLedger } from './finance-ledger.mjs';

const TODAY = '2026-11-27';
const fixedCredit = (over) => ({
  id: 'f',
  name: 'Academia',
  startMonth: '2026-11',
  endMonth: null,
  from: '2026-11',
  amount: 8990,
  categoryId: 'D06',
  paymentMethodId: 'P4',
  dueDay: 15,
  ...over,
});

test('conta fixa de crédito: ocorrências nascem reconhecidas, com valor e sem pagamento pendente', () => {
  const s = emptyState();
  saveFixed(s, fixedCredit());
  const [row] = fixedRows(s, '2026-11');
  assert.equal(row.paid, true);
  assert.equal(row.paidAmount, 8990);
  assert.equal(row.remainingAmount, 0);
  assert.equal(row.date, '2026-11-15');
});

test('conta fixa de crédito gera ocorrências em todos os meses de vigência, todas reconhecidas', () => {
  const s = emptyState();
  saveFixed(s, fixedCredit({ endMonth: '2027-01' }));
  for (const month of ['2026-11', '2026-12', '2027-01']) {
    const [row] = fixedRows(s, month);
    assert.equal(row.paid, true, month);
    assert.equal(row.paidAmount, 8990, month);
  }
  assert.equal(fixedRows(s, '2027-02').length, 0);
});

test('conta fixa de crédito entra em lançadas no mês da data e em previstas no mês futuro', () => {
  const s = emptyState();
  saveFixed(s, fixedCredit({ endMonth: '2026-12' }));
  const nov = monthClassification(s, '2026-11', TODAY);
  assert.equal(nov.creditRecognized, 8990);
  assert.equal(nov.creditForecast, 0);
  assert.equal(nov.quantoSobrou, -8990);
  const dez = monthClassification(s, '2026-12', TODAY);
  assert.equal(dez.creditForecast, 8990);
  assert.equal(dez.quantoSobrou, -8990);
});

test('conta fixa de crédito não aceita pagamento: a ação é recusada com explicação', () => {
  const s = emptyState();
  saveFixed(s, fixedCredit());
  assert.throws(
    () => payFixed(s, 'f', '2026-11', { date: '2026-11-15', amount: 8990 }),
    /reconhecida automaticamente/,
  );
  assert.equal(s.occurrences['f:2026-11'], undefined);
});

test('conta fixa de crédito com pagamento registrado é recusada na validação', () => {
  const s = emptyState();
  saveFixed(s, fixedCredit());
  s.occurrences['f:2026-11'] = {
    payment: { date: '2026-11-15', amount: 8990, settled: true, snapshot: {}, history: [] },
  };
  assert.throws(() => validateLedger(s), /não tem pagamento registrado/);
});

test('conta fixa comum (não crédito) mantém pagamento manual e classificação anterior', () => {
  const s = emptyState();
  saveFixed(s, fixedCredit({ paymentMethodId: 'P2' }));
  const [row] = fixedRows(s, '2026-11');
  assert.equal(row.paid, false);
  assert.equal(row.remainingAmount, 8990);
  const x = monthClassification(s, '2026-11', TODAY);
  assert.equal(x.unpaid, 8990);
  assert.equal(x.creditRecognized, 0);
});

test('contas fixas futuras não entram em compromissos futuros: divergência documentada, sem alteração de cálculo', () => {
  const s = emptyState();
  saveFixed(s, fixedCredit({ endMonth: '2027-06' }));
  assert.equal(monthClassification(s, '2026-11', TODAY).compromissosFuturos.count, 0);
  assert.ok(monthlyRows(s, '2026-12').length > 0);
});

test('ajuste de uma competência de conta fixa de crédito altera só esse mês, preservando a versão e a coerência paid/paidAmount', () => {
  const s = emptyState();
  saveFixed(s, fixedCredit({ endMonth: '2026-12' }));
  adjustFixed(s, 'f', '2026-12', 9990, 'reajuste de dezembro');
  const dez = fixedRows(s, '2026-12')[0];
  assert.equal(dez.amount, 9990);
  assert.equal(dez.paid, true);
  assert.equal(dez.paidAmount, 9990);
  assert.equal(dez.remainingAmount, 0);
  assert.equal(fixedRows(s, '2026-11')[0].amount, 8990);
  assert.equal(s.fixedAccounts[0].versions[0].amount, 8990);
  assert.equal(s.occurrences['f:2026-12'].payment, undefined);
  assert.doesNotThrow(() => validateLedger(s));
});

test('ajuste de conta fixa comum já paga continua recusado', () => {
  const s = emptyState();
  saveFixed(s, fixedCredit({ paymentMethodId: 'P2' }));
  payFixed(s, 'f', '2026-11', { date: '2026-11-15', amount: 8990 });
  assert.throws(() => adjustFixed(s, 'f', '2026-11', 9000), /Desfaça os pagamentos/);
});
