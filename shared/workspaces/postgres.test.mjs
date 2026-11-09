import 'fake-indexeddb/auto';
import { test, expect, vi } from 'vitest';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { listSchema, itemSchema } from '../../src/domain/schemas/shopping.ts';
import { postgresFixture } from './postgres-fixture.mjs';
import { workspaceHandler } from '../../supabase/functions/workspaces/handler.ts';
import { HttpWorkspaceTransport } from './http.mjs';
import { WorkspaceClient, WorkspaceFinanceStore } from './core.mjs';
import { DEMO_ACTORS } from './demo.mjs';
import {
  saveBudget,
  saveFixed,
  payFixed,
  totals,
  monthlyRows,
} from '../../previews/controle-financeiro/finance-domain.mjs';
test.skipIf(!process.env.POSTGRES_CONTAINER)(
  'cliente IndexedDB → serviço HTTP → PostgreSQL 17: compras, financeiro e dois participantes',
  async () => {
    const backend = postgresFixture(process.env.POSTGRES_CONTAINER),
      clients = [];
    try {
      const { privateKey, publicKey } = await generateKeyPair('ES256');
      const deps = {
        enabled: true,
        allowedOrigins: ['https://app.test'],
        authenticate: async (token) =>
          DEMO_ACTORS.slice(0, 2).some((a) => a.uid === token) ? { uid: token } : null,
        command: backend.command,
        randomToken: () =>
          crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', ''),
        hash: async (s) =>
          Array.from(
            new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))),
            (n) => n.toString(16).padStart(2, '0'),
          ).join(''),
        sign: async (uid, origin, a) =>
          new SignJWT({
            workspaceId: a.workspace_id,
            kind: a.kind,
            generation: a.generation,
            writable: a.writable,
          })
            .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'vertice-workspace-v1' })
            .setSubject(uid)
            .setIssuer('test')
            .setAudience(origin)
            .setIssuedAt()
            .setExpirationTime('24h')
            .sign(privateKey),
      };
      vi.stubGlobal('fetch', async (url, options) =>
        workspaceHandler(
          new Request(url, {
            ...options,
            headers: { ...options.headers, origin: 'https://app.test' },
          }),
          deps,
        ),
      );
      const transports = await Promise.all(
        DEMO_ACTORS.slice(0, 2).map(
          async (actor) =>
            new HttpWorkspaceTransport({
              client: {
                auth: {
                  getSession: async () => ({
                    data: { session: { access_token: actor.uid, user: { id: actor.uid } } },
                  }),
                },
              },
              endpoint: 'https://edge.test',
              publicKey: await exportJWK(publicKey),
              issuer: 'test',
              audience: 'https://app.test',
            }),
        ),
      );
      const [owner, guest] = transports;
      await owner.request('list');
      const space = await owner.request('create', { name: 'Nossa casa' }),
        invite = await owner.request('invite', {
          workspace_id: space.id,
          email: DEMO_ACTORS[1].email,
        });
      await guest.request('accept', { token: invite.token });
      for (let i = 0; i < 2; i++) {
        const s = (await transports[i].request('list')).find((s) => s.id === space.id);
        clients.push(
          await new WorkspaceClient({
            project: 'pg17',
            actor: DEMO_ACTORS[i],
            space: s,
            transport: transports[i],
          }).initialize(),
        );
      }
      const [a, b] = clients;
      const personal = (await owner.request('list')).find((s) => s.kind === 'personal');
      const source = await new WorkspaceClient({
        project: 'pg17',
        actor: DEMO_ACTORS[0],
        space: personal,
        transport: owner,
      }).initialize();
      clients.push(source);
      await source.commitFinance((s) => saveBudget(s, '2026-11', 'D01', 10000));
      const copiedList = await source
        .shopping()
        .createListWithCategories({
          storeName: 'Lista pessoal copiada',
          date: '2026-11-09',
          description: '',
          budgetCents: null,
        });
      await source.flush();
      const copyInput = {
        workspace_id: space.id,
        source_id: personal.id,
        area: 'both',
        operation_id: crypto.randomUUID(),
      };
      const copied = await owner.request('copy', copyInput);
      expect(await owner.request('copy', copyInput)).toEqual(copied);
      await b.refresh();
      expect((await b.shopping().getLists()).some((l) => l.id === copiedList)).toBe(true);
      expect((await b.finance()).monthlyBudgets['2026-11'].D01).toBe(10000);
      expect((await source.shopping().getLists()).some((l) => l.id === copiedList)).toBe(true);

      const list = await a.shopping().createListWithCategories({
        storeName: 'Mercado',
        date: '2026-11-09',
        description: '',
        budgetCents: 12000,
      });
      await a.flush();
      await b.refresh();
      expect((await b.shopping().getLists()).some((l) => l.id === list)).toBe(true);
      const category = (await b.shopping().getCategories(list))[0];
      const item = await b.shopping().addItem(list, category.id, 'Carne');
      await b.flush();
      await b.shopping().updateItem(item, {
        name: 'Carne',
        unitPrice: '25.5',
        quantity: '2',
        unit: 'kg',
        brand: null,
        packageContent: null,
      });
      await b.flush();
      await a.refresh();
      expect((await a.shopping().getItemsForList(list))[0].unitPrice).toBe('25.5');
      const snapshot = await a.shopping().exportSnapshot();
      expect(listSchema.safeParse(snapshot.lists.find((l) => l.id === list)).success).toBe(true);
      expect(itemSchema.safeParse(snapshot.items[0]).success).toBe(true);
      const store = new WorkspaceFinanceStore(a);
      await store.load();
      await store.commit((s) =>
        saveFixed(s, {
          id: 'bill',
          name: 'Internet',
          startMonth: '2026-11',
          endMonth: null,
          from: '2026-11',
          amount: 10000,
          categoryId: 'D01',
          paymentMethodId: 'P2',
          dueDay: 10,
        }),
      );
      await a.flush();
      await b.refresh();
      const second = new WorkspaceFinanceStore(b);
      await second.load();
      await second.commit((s) =>
        payFixed(s, 'bill', '2026-11', { date: '2026-12-05', amount: 6000 }),
      );
      await b.flush();
      await a.refresh();
      const current = await a.finance();
      expect(totals(monthlyRows(current, '2026-11')).expense).toBe(6000);
      expect(totals(monthlyRows(current, '2026-11')).expectedExpense).toBe(10000);
      expect(await a.status()).toBe('Sincronizado');
      expect(await b.status()).toBe('Sincronizado');
    } finally {
      for (const client of clients) client.close();
      backend.close();
      vi.unstubAllGlobals();
    }
  },
  60000,
);
