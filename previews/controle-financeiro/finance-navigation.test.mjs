import test from 'node:test';
import assert from 'node:assert/strict';
import { financeView, financeRoute, financeGroup, financeTitles } from './finance-navigation.mjs';
test('rotas antigas e novas apontam às mesmas telas e aos cinco grupos', () => {
  for (const view of Object.keys(financeTitles)) {
    assert.equal(financeView(view), view);
    assert.equal(financeView(financeRoute(view)), view);
  }
  assert.equal(financeView('planning'), 'budget');
  assert.equal(financeView('planning/invalid'), null);
  assert.equal(financeView('unknown'), null);
  assert.deepEqual([...new Set(Object.keys(financeTitles).map(financeGroup))].sort(), [
    'analysis',
    'more',
    'overview',
    'planning',
    'transactions',
  ]);
  assert.equal(financeGroup('fixed'), 'planning');
  assert.equal(financeGroup('wealth'), 'more');
});
