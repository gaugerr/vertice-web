import { test, expect } from 'vitest';
import { changesBetween, financeRows, readFinance } from './mapping.mjs';
import {
  emptyState,
  saveFixed,
  payFixed,
  undoFixed,
  fixedRows,
} from '../../previews/controle-financeiro/finance-domain.mjs';

test('pagar novamente após desfazer limpa a exclusão no protocolo de atualização do servidor', () => {
  const state = emptyState();
  saveFixed(state, {
    id: 'rent',
    name: 'Aluguel',
    startMonth: '2026-11',
    endMonth: null,
    from: '2026-11',
    amount: 122600,
    categoryId: 'D01',
    paymentMethodId: 'P2',
    dueDay: 5,
  });
  payFixed(state, 'rent', '2026-11', { date: '2026-11-11', amount: 122600 });
  const server = new Map(financeRows(state).map((r) => [r.entity + '/' + r.id, r]));
  // SQL UPDATE preserves any column omitted from the command body.
  const apply = (changes) => {
    for (const row of changes) {
      const key = row.entity + '/' + row.id;
      const previous = server.get(key);
      server.set(key, {
        ...row,
        body: {
          ...previous?.body,
          ...row.body,
          row_version: (previous?.body.row_version ?? 0) + 1,
        },
      });
    }
  };
  undoFixed(state, 'rent', '2026-11');
  apply(changesBetween([...server.values()], financeRows(state)));
  expect(fixedRows(readFinance([...server.values()]), '2026-11')[0].paid).toBe(false);
  payFixed(state, 'rent', '2026-11', { date: '2026-11-12', amount: 122600 });
  const commands = changesBetween([...server.values()], financeRows(state));
  const payment = commands.find((r) => r.entity === 'finance_payments');
  expect(payment.body.deleted_at).toBeNull();
  apply(commands);
  const restored = fixedRows(readFinance([...server.values()]), '2026-11')[0];
  expect(restored.paid).toBe(true);
  expect(restored.paidAmount).toBe(122600);
  expect(restored.remainingAmount).toBe(0);
});
