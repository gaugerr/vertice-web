// Validação de séries: operações validam a série tocada; carregamento valida a estrutura geral.
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, saveEntry } from './finance-domain.mjs';
import {
  saveLedgerEntry,
  saveWallet,
  validateLedger,
  validateRepeatSeries,
  validateSeriesSequence,
  deleteLedgerEntry,
} from './finance-ledger.mjs';

const setup = () => {
  const s = emptyState();
  saveWallet(s, { id: 'w', name: 'Banco', openingBalance: 100000, openingDate: '2026-01-01' });
  return s;
};
const base = (over) => ({
  id: 'r',
  name: 'Assinatura',
  type: 'expense',
  date: '2026-11-10',
  amount: 2990,
  categoryId: 'D01',
  paymentMethodId: 'P2',
  paid: true,
  observation: '',
  ...over,
});

test('repeat: aceita lacunas em posições, mas recusa posição duplicada ou fora da contagem', () => {
  const s = setup();
  saveLedgerEntry(s, base(), { mode: 'repeat', count: 4 });
  deleteLedgerEntry(s, 'r:1');
  assert.doesNotThrow(() => validateRepeatSeries(s, 'r'));
  s.entries[1].seriesIndex = 1;
  assert.throws(() => validateRepeatSeries(s, 'r'), /Posições de repetição inconsistentes/);
  s.entries[1].seriesIndex = 9;
  assert.throws(() => validateRepeatSeries(s, 'r'), /Posições de repetição inconsistentes/);
});

test('repeat: recusa contagem divergente e identificador sem o prefixo da série', () => {
  const s = setup();
  saveLedgerEntry(s, base(), { mode: 'repeat', count: 3 });
  s.entries[1].seriesCount = 2;
  assert.throws(() => validateRepeatSeries(s, 'r'), /Série de repetição inconsistente/);
  s.entries[1].seriesCount = 3;
  s.entries[2].id = 'outra:2';
  assert.throws(() => validateRepeatSeries(s, 'r'), /Identificador de repetição inconsistente/);
});

test('parcelas: validação de sequência só é exigida em operações; carregamento aceita lacuna legada', () => {
  const s = setup();
  saveLedgerEntry(s, base({ amount: 4000 }), { mode: 'installments', count: 3 });
  s.entries.splice(1, 1);
  assert.doesNotThrow(() => validateLedger(s), 'carregamento não revalida sequência de parcelas');
  assert.throws(() => validateSeriesSequence(s, 'r'), /Sequência de parcelas inconsistente/);
});

test('operação em uma série não revalida a sequência de outra série legada com lacuna', () => {
  const s = setup();
  saveLedgerEntry(s, base({ id: 'outra', amount: 4000, name: 'Outra' }), {
    mode: 'installments',
    count: 3,
  });
  s.entries.splice(1, 1);
  assert.doesNotThrow(() => validateLedger(s));
  saveLedgerEntry(s, base({ id: 'nova', name: 'Nova', amount: 2000, date: '2026-11-20' }), {
    mode: 'installments',
    count: 2,
  });
  assert.equal(s.entries.filter((e) => e.seriesId === 'nova').length, 2);
});

test('lançamento avulso com metadados de série inválidos continua recusado pelo carregamento', () => {
  const s = setup();
  saveEntry(s, base({ id: 'av' }));
  s.entries[0].seriesId = 'av';
  s.entries[0].seriesKind = 'repeat';
  s.entries[0].seriesIndex = 1;
  s.entries[0].seriesCount = 1;
  assert.throws(() => validateLedger(s), /Série inválida/);
});
