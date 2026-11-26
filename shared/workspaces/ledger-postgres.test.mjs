import { financeRows } from './mapping.mjs';
import 'fake-indexeddb/auto';
import { test, expect } from 'vitest';
import { postgresFixture } from './postgres-fixture.mjs';
import { WorkspaceClient, WorkspaceFinanceStore } from './core.mjs';
import {
  saveMonthlyLimit,
  saveWallet,
  saveMove,
  saveLedgerEntry,
  walletBalance,
} from '../../previews/controle-financeiro/finance-ledger.mjs';
import {
  emptyState,
  monthlyRows,
  totals,
} from '../../previews/controle-financeiro/finance-domain.mjs';
const uid = '11111111-1111-4111-8111-111111111111';
test.skipIf(!process.env.POSTGRES_CONTAINER)(
  'PostgreSQL: contas, transferência e parcelas sem duplicidade, versão antiga bloqueada e conflito preservado',
  async () => {
    const backend = postgresFixture(process.env.POSTGRES_CONTAINER);
    const clients = [];
    try {
      const transport = { request: (action, input = {}) => backend.command(uid, action, input) };
      const space = (await transport.request('list'))[0];
      const a = await new WorkspaceClient({
        project: 'ledger-a',
        actor: { uid },
        space,
        transport,
      }).initialize();
      clients.push(a);
      const store = new WorkspaceFinanceStore(a);
      await store.load();
      await store.commit((s) => {
        saveWallet(s, {
          id: 'w',
          name: 'Conta',
          openingBalance: 100000,
          openingDate: '2026-01-01',
        });
        saveWallet(s, { id: 'w2', name: 'Outra', openingBalance: 0, openingDate: '2026-01-01' });
        saveMonthlyLimit(s, '2026-11', 200000);
      });
      await a.flush();
      expect(a.syncError).toBeNull();
      await store.load();
      await store.commit((s) => {
        saveLedgerEntry(
          s,
          {
            id: 'purchase',
            name: 'Compra',
            type: 'expense',
            amount: 10000,
            date: '2026-11-10',
            categoryId: 'D01',
            paymentMethodId: 'P2',
            paid: false,
            observation: '',
          },
          { mode: 'installments', count: 3 },
        );
        saveMove(s, {
          id: 'transfer',
          kind: 'transfer',
          fromWalletId: 'w',
          toWalletId: 'w2',
          amount: 20000,
          date: '2026-11-11',
        });
      });
      await a.flush();
      expect(a.syncError).toBeNull();
      const saved = await a.finance();
      expect(saved.monthlyLimits['2026-11']).toBe(200000);
      expect(saved.entries).toHaveLength(3);
      expect(totals(monthlyRows(saved, '2026-11')).expectedExpense).toBe(3334);
      expect(walletBalance(saved, 'w', '2026-11-11')).toBe(80000);
      expect(walletBalance(saved, 'w2', '2026-11-11')).toBe(20000);
      const other = await backend.command(uid, 'create', { name: 'Outro espaço' });
      const seed = financeRows(emptyState());
      const foreign = {
        entity: 'finance_entries',
        id: 'foreign',
        expected_version: 0,
        body: {
          id: 'foreign',
          source: 'manual',
          kind: 'expense',
          name: 'Inválido',
          competence_month: '2026-12-01',
          reference_date: '2026-12-05',
          planned_amount_cents: 100,
          settlement_discount_cents: 0,
          category_id: 'D01',
          payment_method_id: 'P2',
          observation: '',
          extra: { cardId: 'c', purchaseDate: '2026-11-10' },
        },
      };
      // Credit cards no longer exist: their metadata is rejected as unknown.
      await expect(
        backend.command(uid, 'apply', {
          workspace_id: other.id,
          operation: {
            id: crypto.randomUUID(),
            ledger_version: 2,
            generation: 1,
            changes: [...seed.map((r) => ({ ...r, expected_version: 0 })), foreign],
          },
        }),
      ).rejects.toThrow('Unknown entry metadata');
      await expect(
        transport.request('apply', {
          workspace_id: space.id,
          operation: {
            id: crypto.randomUUID(),
            generation: space.generation,
            changes: [
              {
                entity: 'finance_wallets',
                id: 'old',
                expected_version: 0,
                body: { name: 'Antigo' },
              },
            ],
          },
        }),
      ).rejects.toThrow('client_update_required');
      const b = await new WorkspaceClient({
        project: 'ledger-b',
        actor: { uid },
        space,
        transport,
      }).initialize();
      clients.push(b);
      const second = new WorkspaceFinanceStore(b);
      await second.load();
      // Both devices rename the same account without learning of the other.
      const rename = (name) => (s) =>
        saveWallet(s, { id: 'w', name, openingBalance: 100000, openingDate: '2026-01-01' });
      b.stopped = true;
      await second.commit(rename('Conta B'));
      await store.load();
      await store.commit(rename('Conta A'));
      await a.flush();
      expect(a.syncError).toBeNull();
      b.stopped = false;
      await b.flush();
      expect(await b.db.workspaceOutbox.count()).toBeGreaterThan(0);
      expect(await b.status()).toBe('Precisa de atenção');
      await a.refresh();
      expect((await a.finance()).wallets.find((w) => w.id === 'w').name).toBe('Conta A');
      expect(walletBalance(await a.finance(), 'w', '2026-11-11')).toBe(80000);
    } finally {
      for (const c of clients) c.close();
      backend.close();
    }
  },
  30000,
);
