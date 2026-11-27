import test from 'node:test';
import assert from 'node:assert/strict';
import { budgetStatus, budgetPercent, paymentStatus, dayLabel } from './presentation.mjs';

test('status do orçamento: sem limite, dentro, perto (80%) e acima', () => {
  assert.equal(budgetStatus(100, null).key, 'none');
  assert.equal(budgetStatus(0, 500).key, 'ok');
  assert.equal(budgetStatus(399, 500).key, 'ok');
  assert.equal(budgetStatus(400, 500).key, 'near');
  assert.equal(budgetStatus(500, 500).key, 'near');
  assert.equal(budgetStatus(501, 500).key, 'over');
  assert.equal(budgetStatus(0, 0).key, 'ok');
  assert.equal(budgetStatus(1, 0).key, 'over');
});

test('percentual do orçamento sem arredondamento errado', () => {
  assert.equal(budgetPercent(250, 500), 50);
  assert.equal(budgetPercent(1, null), 0);
  assert.equal(budgetPercent(0, 0), 0);
  assert.equal(budgetPercent(5, 0), 100);
});

test('estado do lançamento diferencia crédito de pago, sem depender de cor', () => {
  assert.equal(paymentStatus({ type: 'expense', paid: true, credit: true }).label, 'No crédito');
  assert.equal(paymentStatus({ type: 'expense', paid: true, credit: false }).label, 'Pago');
  assert.equal(paymentStatus({ type: 'expense', paid: false }).label, 'Pendente');
  assert.equal(paymentStatus({ type: 'expense', paid: false, partial: true }).label, 'Parcial');
  assert.equal(paymentStatus({ type: 'income', paid: true }).label, 'Recebido');
  assert.equal(paymentStatus({ type: 'income', paid: false }).label, 'Previsto');
});

test('cabeçalho de dia usa Hoje, Ontem e data por extenso', () => {
  assert.equal(dayLabel('2026-11-27', '2026-11-27'), 'Hoje');
  assert.equal(dayLabel('2026-11-26', '2026-11-27'), 'Ontem');
  assert.equal(dayLabel('2026-11-20', '2026-11-27'), 'sexta-feira, 20 de novembro');
});
