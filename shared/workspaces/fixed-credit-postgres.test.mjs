// @vitest-environment node
import 'fake-indexeddb/auto';
import { test, expect, vi, afterEach } from 'vitest';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { postgresFixture } from './postgres-fixture.mjs';
import { workspaceHandler } from '../../supabase/functions/workspaces/handler.ts';
import { HttpWorkspaceTransport } from './http.mjs';
import { WorkspaceClient } from './core.mjs';
import { DEMO_ACTORS } from './demo.mjs';
import { saveFixed, adjustFixed } from '../../previews/controle-financeiro/finance-domain.mjs';

const CREDIT = (over = {}) => ({
  id: 'academia',
  name: 'Academia',
  startMonth: '2026-01',
  endMonth: null,
  from: '2026-01',
  amount: 8990,
  categoryId: 'D01',
  paymentMethodId: 'P4',
  dueDay: 15,
  ...over,
});
// Competência corrente do fuso informado, pelo relógio real do servidor de teste.
const SP = 'America/Sao_Paulo';

const cleanup = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  for (const fn of cleanup.splice(0).reverse()) await fn();
});

async function world() {
  const backend = postgresFixture(process.env.POSTGRES_CONTAINER);
  cleanup.push(() => backend.close());
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
      new Request(url, { ...options, headers: { ...options.headers, origin: 'https://app.test' } }),
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
  const shared = await owner.request('create', { name: 'Nossa casa' });
  const invite = await owner.request('invite', {
    workspace_id: shared.id,
    email: DEMO_ACTORS[1].email,
  });
  await guest.request('accept', { token: invite.token });
  const clients = [];
  for (let i = 0; i < 2; i++) {
    const space = (await transports[i].request('list')).find((s) => s.id === shared.id);
    clients.push(
      await new WorkspaceClient({
        project: 'pg17',
        actor: DEMO_ACTORS[i],
        space,
        transport: transports[i],
        timeZone: SP,
      }).initialize(),
    );
  }
  cleanup.push(() => Promise.all(clients.map((c) => c.close())));
  const [a, b] = clients;
  const count = async (sql) => Number(backend.query(sql));
  const cur = backend.query(`select to_char(now() at time zone '${SP}','YYYY-MM')`);
  return { backend, owner, a, b, space: shared, count, cur, deviceSpace: a.space };
}

test.skipIf(!process.env.POSTGRES_CONTAINER)(
  'PostgreSQL: ação explícita cria a ocorrência de crédito uma única vez e a repetição não duplica',
  async () => {
    const w = await world();
    await w.a.commitFinance((s) => saveFixed(s, CREDIT()));
    await w.a.flush();
    await w.a.flush();
    const rows = await w.count(
      `select count(*) from public.finance_entries where workspace_id='${w.space.id}' and id='academia:${w.cur}' and payment_method_id='P4'`,
    );
    expect(rows).toBe(1);
    expect(
      await w.count(
        `select count(*) from public.finance_payments where entry_id='academia:${w.cur}'`,
      ),
    ).toBe(0);
  },
);

test.skipIf(!process.env.POSTGRES_CONTAINER)(
  'PostgreSQL: abrir e visualizar mês não grava ocorrência',
  async () => {
    const w = await world();
    await w.a.commitFinance((s) =>
      saveFixed(s, CREDIT({ id: 'luz', name: 'Luz', paymentMethodId: 'P2' })),
    );
    await w.a.flush();
    await w.b.pull();
    await w.b.finance();
    const before = await w.count(
      `select count(*) from public.finance_entries where workspace_id='${w.space.id}'`,
    );
    await w.b.finance();
    await w.a.finance();
    expect(
      await w.count(
        `select count(*) from public.finance_entries where workspace_id='${w.space.id}'`,
      ),
    ).toBe(before);
  },
);

test.skipIf(!process.env.POSTGRES_CONTAINER)(
  'PostgreSQL: conta comum não gera ocorrência de crédito',
  async () => {
    const w = await world();
    await w.a.commitFinance((s) =>
      saveFixed(s, CREDIT({ id: 'luz', name: 'Luz', paymentMethodId: 'P2' })),
    );
    await w.a.flush();
    expect(
      await w.count(`select count(*) from public.finance_entries where id='luz:${w.cur}'`),
    ).toBe(0);
  },
);

test.skipIf(!process.env.POSTGRES_CONTAINER)(
  'PostgreSQL: a linha materializada chega ao outro dispositivo pelo pull',
  async () => {
    const w = await world();
    await w.a.commitFinance((s) => saveFixed(s, CREDIT()));
    await w.a.flush();
    await w.b.pull();
    expect(await w.b.db.workspaceRecords.get('finance_entries/academia:' + w.cur)).toBeDefined();
  },
);

test.skipIf(!process.env.POSTGRES_CONTAINER)(
  'PostgreSQL: competência passada é recusada pelo servidor sem gravar',
  async () => {
    const w = await world();
    await w.a.commitFinance((s) => saveFixed(s, CREDIT()), undefined, undefined, {
      materialize: false,
    });
    await w.a.flush();
    const r = await w.owner.request('materialize_fixed_credit', {
      workspace_id: w.space.id,
      generation: w.a.space.generation,
      operation_id: crypto.randomUUID(),
      account_id: 'academia',
      competence_month: '2025-12',
      time_zone: SP,
    });
    expect(r.status).toBe('not_current');
    expect(
      await w.count(`select count(*) from public.finance_entries where id='academia:2025-12'`),
    ).toBe(0);
  },
);

test.skipIf(!process.env.POSTGRES_CONTAINER)(
  'PostgreSQL: mesma operação com conteúdo diferente é recusada',
  async () => {
    const w = await world();
    await w.a.commitFinance((s) => saveFixed(s, CREDIT()), undefined, undefined, {
      materialize: false,
    });
    await w.a.flush();
    const input = {
      workspace_id: w.space.id,
      generation: w.a.space.generation,
      operation_id: crypto.randomUUID(),
      account_id: 'academia',
      competence_month: w.cur,
      time_zone: SP,
    };
    const first = await w.owner.request('materialize_fixed_credit', input);
    expect(first.status).toBe('inserted');
    await expect(
      w.owner.request('materialize_fixed_credit', { ...input, account_id: 'outra' }),
    ).rejects.toThrow();
    // O handler só expõe códigos conhecidos: a recusa é erro genérico e nada é gravado.
    expect(
      await w.count(`select count(*) from public.finance_entries where id='outra:${w.cur}'`),
    ).toBe(0);
  },
);

test.skipIf(!process.env.POSTGRES_CONTAINER)(
  'PostgreSQL: ajuste da competência atual é gravado pelo fluxo normal sem materialização separada',
  async () => {
    const w = await world();
    await w.a.commitFinance((s) => saveFixed(s, CREDIT()));
    await w.a.flush();
    await w.a.commitFinance((s) => adjustFixed(s, 'academia', w.cur, 9500));
    await w.a.flush();
    expect(
      await w.count(
        `select count(*) from public.finance_entries where id='academia:${w.cur}' and planned_amount_cents=9500`,
      ),
    ).toBe(1);
  },
);
