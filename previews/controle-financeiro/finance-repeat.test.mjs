// Caracterização de "repeat" sem crédito: documenta o comportamento atual que deve ser preservado.
// Não usa crédito. Escrito antes de qualquer alteração no domínio.
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, saveEntry } from './finance-domain.mjs';
import {
  saveLedgerEntry,
  saveWallet,
  deleteLedgerEntry,
  stopSeries,
  validateLedger,
} from './finance-ledger.mjs';

const setup = () => {
  const s = emptyState();
  saveWallet(s, { id: 'w', name: 'Conta', openingBalance: 100000, openingDate: '2026-01-01' });
  return s;
};
const entry = (over) => ({
  id: 'e',
  name: 'Assinatura',
  type: 'expense',
  date: '2026-01-10',
  amount: 2990,
  categoryId: 'D01',
  paymentMethodId: 'P2',
  paid: true,
  observation: '',
  ...over,
});
const create = (s, over = {}, count = 3) =>
  saveLedgerEntry(s, entry(over), { mode: 'repeat', count });

test('repeat sem crédito: cria N ocorrências com mesmo valor, dia civil e posições 1..N', () => {
  const s = setup();
  create(s, { date: '2026-01-31' });
  assert.deepEqual(
    s.entries.map((e) => e.date),
    ['2026-01-31', '2026-02-28', '2026-03-31'],
  );
  assert.deepEqual(
    s.entries.map((e) => e.amount),
    [2990, 2990, 2990],
  );
  assert.deepEqual(
    s.entries.map((e) => e.seriesIndex),
    [1, 2, 3],
  );
  assert.deepEqual(
    s.entries.map((e) => e.seriesCount),
    [3, 3, 3],
  );
  assert.deepEqual(
    s.entries.map((e) => e.seriesKind),
    ['repeat', 'repeat', 'repeat'],
  );
  assert.deepEqual(
    s.entries.map((e) => e.id),
    ['e:0', 'e:1', 'e:2'],
  );
  assert.ok(s.entries.every((e) => e.seriesId === 'e'));
});

test('repeat sem crédito: só a primeira ocorrência herda o "pago" informado; as demais nascem não pagas', () => {
  const s = setup();
  create(s, { paid: true });
  assert.deepEqual(
    s.entries.map((e) => e.paid),
    [true, false, false],
  );
  const t = emptyState();
  saveWallet(t, { id: 'w', name: 'Conta', openingBalance: 0, openingDate: '2026-01-01' });
  create(t, { paid: false, id: 'f' });
  assert.deepEqual(
    t.entries.map((e) => e.paid),
    [false, false, false],
  );
});

test('repeat sem crédito: conta informada é copiada para todas as ocorrências', () => {
  const s = setup();
  create(s, { walletId: 'w' });
  assert.deepEqual(
    s.entries.map((e) => e.walletId),
    ['w', 'w', 'w'],
  );
});

test('repeat sem crédito: edição de uma ocorrência altera só ela e preserva posições e IDs', () => {
  const s = setup();
  create(s);
  const second = s.entries.find((e) => e.id === 'e:1');
  saveEntry(s, { ...second, amount: 5000 });
  assert.deepEqual(
    s.entries.map((e) => e.amount),
    [2990, 5000, 2990],
  );
  assert.deepEqual(
    s.entries.map((e) => e.seriesIndex),
    [1, 2, 3],
  );
  assert.deepEqual(
    s.entries.map((e) => e.id),
    ['e:0', 'e:1', 'e:2'],
  );
});

test('repeat sem crédito: exclusão individual remove sem renumerar e aceita lacuna em seriesIndex', () => {
  const s = setup();
  create(s);
  deleteLedgerEntry(s, 'e:1');
  assert.deepEqual(
    s.entries.map((e) => e.id),
    ['e:0', 'e:2'],
  );
  assert.deepEqual(
    s.entries.map((e) => e.seriesIndex),
    [1, 3],
  );
  assert.deepEqual(
    s.entries.map((e) => e.seriesCount),
    [3, 3],
  );
  assert.deepEqual(
    s.entries.map((e) => e.amount),
    [2990, 2990],
  );
  assert.doesNotThrow(() => validateLedger(s));
});

test('repeat sem crédito: encerrar remove só ocorrências não pagas a partir da posição escolhida', () => {
  const s = setup();
  create(s, {}, 4);
  stopSeries(s, 'e:1');
  assert.deepEqual(
    s.entries.map((e) => e.id),
    ['e:0'],
  );
  assert.equal(s.entries[0].paid, true);
});

test('repeat sem crédito: encerrar preserva ocorrências pagas no meio da série', () => {
  const s = setup();
  create(s, {}, 4);
  saveEntry(s, { ...s.entries.find((e) => e.id === 'e:2'), paid: true });
  stopSeries(s, 'e:1');
  assert.deepEqual(
    s.entries.map((e) => e.id),
    ['e:0', 'e:2'],
  );
});

test('repeat sem crédito: encerrar sem ocorrências em aberto é recusado com mensagem', () => {
  const s = setup();
  create(s, {}, 2);
  saveEntry(s, { ...s.entries.find((e) => e.id === 'e:1'), paid: true });
  assert.throws(() => stopSeries(s, 'e:1'), /Não há parcelas ou repetições em aberto/);
});

test('repeat sem crédito: encerrar após lacuna remove as posteriores em aberto e mantém IDs', () => {
  const s = setup();
  create(s, {}, 4);
  deleteLedgerEntry(s, 'e:1');
  stopSeries(s, 'e:2');
  assert.deepEqual(
    s.entries.map((e) => e.id),
    ['e:0'],
  );
  assert.equal(s.entries[0].seriesIndex, 1);
});
