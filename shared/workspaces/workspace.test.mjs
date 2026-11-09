import 'fake-indexeddb/auto';
import { test, expect, afterEach } from 'vitest';
import { WorkspaceClient, WorkspaceFinanceStore, workspaceDatabase } from './core.mjs';
import { DemoTransport, DEMO_ACTORS } from './demo.mjs';
import { financeRows, readFinance, shoppingRows, readShopping } from './mapping.mjs';
import {
  initialState,
  saveFixed,
  payFixed,
  totals,
  monthlyRows,
  saveBudget,
  saveContribution,
} from '../../previews/controle-financeiro/finance-domain.mjs';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { verifyWorkspaceLease } from './lease.mjs';
import { workspaceHandler } from '../../supabase/functions/workspaces/handler.ts';
const resources = [];
test('reentrada com download interrompido não apresenta snapshot antigo como completo', async () => {
  const f = await setup();
  await f.owner.request('remove', { workspace_id: f.shared.id, user_id: DEMO_ACTORS[1].uid });
  const invite = await f.owner.request('invite', {
    workspace_id: f.shared.id,
    email: DEMO_ACTORS[1].email,
  });
  await f.guest.request('accept', { token: invite.token });
  const space = (await f.guest.request('list'))[0];
  const c = new WorkspaceClient({
    project: 'test',
    actor: DEMO_ACTORS[1],
    space,
    transport: {
      request: (action, input) =>
        action === 'pull' ? Promise.reject(Error('interrupted')) : f.guest.request(action, input),
    },
  });
  resources.push(c);
  await expect(c.initialize({ preferCache: true })).rejects.toThrow('interrupted');
  expect(await c.db.workspaceMeta.get('snapshot-ready')).toBeUndefined();
});
test('cache completo abre sem esperar rede, inclusive espaço vazio', async () => {
  const f = await setup();
  let requests = 0;
  const client = new WorkspaceClient({
    project: 'test',
    actor: DEMO_ACTORS[0],
    space: f.a.space,
    transport: {
      request: async () => {
        requests++;
        throw Error('network unavailable');
      },
    },
  });
  resources.push(client);
  await client.initialize({ preferCache: true });
  expect(requests).toBe(0);
  expect(client.fromCache).toBe(true);
  expect((await client.finance()).entries).toEqual([]);
});
test('cache expirado, revogado ou de outra geração não abre sem validação', async () => {
  const f = await setup();
  const original = (await f.a.db.workspaceMeta.get('access')).value;
  for (const access of [
    { ...original, expiresAt: 1 },
    { ...original, generation: 99 },
  ]) {
    await f.a.db.workspaceMeta.put({ key: 'access', value: access });
    const c = new WorkspaceClient({
      project: 'test',
      actor: DEMO_ACTORS[0],
      space: f.a.space,
      transport: {
        request: async () => {
          throw Error('offline');
        },
      },
    });
    resources.push(c);
    await expect(c.initialize({ preferCache: true })).rejects.toBeDefined();
  }
  await f.a.db.workspaceMeta.put({ key: 'access', value: original });
  await f.a.db.workspaceMeta.put({ key: 'revoked', value: true, generation: 1 });
  await expect(f.a.assertRead()).rejects.toMatchObject({ code: 'removed' });
});
test('primeiro download incompleto não é cache pronto; falha não informa sincronizado', async () => {
  const f = await setup();
  await f.a.flush();
  expect((await f.a.db.workspaceMeta.get('last-synced')).value).toBeGreaterThan(0);
  f.online(false);
  await f.a.flush();
  expect(await f.a.status()).toBe('Não foi possível atualizar');
  await f.a.db.workspaceMeta.delete('snapshot-ready');
  const c = new WorkspaceClient({
    project: 'test',
    actor: DEMO_ACTORS[0],
    space: f.a.space,
    transport: {
      request: async () => {
        throw Error('offline');
      },
    },
  });
  resources.push(c);
  await expect(c.initialize({ preferCache: true })).rejects.toThrow('offline');
});
test('sessão rejeitada bloqueia leitura mas preserva a fila', async () => {
  const f = await setup();
  f.online(false);
  await f.a.commitFinance((s) => saveBudget(s, '2026-11', 'D01', 1));
  await f.a.authenticationFailed();
  await expect(f.a.finance()).rejects.toMatchObject({ code: 'unauthorized' });
  expect(await f.a.db.workspaceOutbox.count()).toBe(1);
});
afterEach(() => {
  for (const r of resources.splice(0)) r.close?.();
});
async function setup() {
  const name = 'test-' + crypto.randomUUID();
  let now = Date.now(),
    online = true;
  const options = { name, clock: () => now, online: () => online };
  const owner = new DemoTransport(DEMO_ACTORS[0], options),
    guest = new DemoTransport(DEMO_ACTORS[1], options),
    other = new DemoTransport(DEMO_ACTORS[2], options);
  resources.push(owner, guest, other);
  const personal = (await owner.request('list'))[0],
    shared = await owner.request('create', { name: 'Nossa casa' }),
    invite = await owner.request('invite', {
      workspace_id: shared.id,
      email: DEMO_ACTORS[1].email,
    });
  await guest.request('accept', { token: invite.token });
  const os = (await owner.request('list')).find((s) => s.id === shared.id),
    gs = (await guest.request('list'))[0];
  const a = new WorkspaceClient({
      project: 'test',
      actor: DEMO_ACTORS[0],
      space: os,
      transport: owner,
      clock: () => now,
    }),
    b = new WorkspaceClient({
      project: 'test',
      actor: DEMO_ACTORS[1],
      space: gs,
      transport: guest,
      clock: () => now,
    });
  resources.push(a, b);
  await a.initialize();
  await b.initialize();
  return {
    owner,
    guest,
    other,
    personal,
    shared,
    invite,
    a,
    b,
    online: (v) => (online = v),
    advance: (ms) => (now += ms),
  };
}
test('normalização preserva valores, pagamentos, orçamento e metas sem duplicação', () => {
  const s = initialState();
  saveFixed(s, {
    id: 'bill',
    name: 'Conta',
    startMonth: '2026-11',
    endMonth: null,
    from: '2026-11',
    amount: 10000,
    categoryId: 'D01',
    paymentMethodId: 'P2',
    dueDay: 31,
  });
  payFixed(s, 'bill', '2026-11', { amount: 6000, date: '2026-12-05' });
  saveBudget(s, '2026-11', 'D01', 0);
  saveContribution(s, 'reserve', { id: 'c', date: '2026-11-01', amount: 100 });
  const restored = readFinance(financeRows(s));
  expect(totals(monthlyRows(restored, '2026-11'))).toEqual(totals(monthlyRows(s, '2026-11')));
  expect(restored.monthlyBudgets).toEqual(s.monthlyBudgets);
  expect(restored.goals[0].current).toBe(s.goals[0].current);
  expect(restored.occurrences['bill:2026-11'].payment.amount).toBe(6000);
  expect(readShopping(shoppingRows({ lists: [], categories: [], items: [] }))).toEqual({
    lists: [],
    categories: [],
    items: [],
  });
});
test('duas pessoas compartilham; terceira conta e dados pessoais ficam isolados', async () => {
  const f = await setup();
  await f.a.commitFinance((s) => {
    s.entries.push({
      id: 'e',
      name: 'Compra',
      amount: 10000,
      type: 'expense',
      paid: false,
      date: '2026-11-09',
      categoryId: 'D01',
      paymentMethodId: 'P2',
      observation: '',
    });
  });
  await f.a.flush();
  await f.b.refresh();
  expect((await f.b.finance()).entries).toHaveLength(1);
  await expect(f.other.request('pull', { workspace_id: f.shared.id })).rejects.toMatchObject({
    code: 'removed',
  });
  await expect(f.guest.request('pull', { workspace_id: f.personal.id })).rejects.toMatchObject({
    code: 'removed',
  });
  expect(await f.guest.request('list')).toHaveLength(1);
});
test('fila persiste offline, usa escopo próprio e sincroniza sem duplicar', async () => {
  const f = await setup();
  f.online(false);
  await f.a.commitFinance((s) => saveBudget(s, '2026-11', 'D01', 0));
  expect(await f.a.status()).toBe('Pendente de envio');
  expect(await f.a.db.workspaceOutbox.count()).toBe(1);
  f.online(true);
  await f.a.flush();
  await f.a.flush();
  await f.b.refresh();
  expect((await f.b.finance()).monthlyBudgets['2026-11'].D01).toBe(0);
  expect(await f.a.status()).toBe('Sincronizado');
  expect(f.a.db.name).not.toBe(f.b.db.name);
});
test('autorização compartilhada expira em 24h e relógio retrocedido bloqueia edição', async () => {
  const f = await setup();
  f.online(false);
  f.advance(86400001);
  await expect(f.a.commitFinance((s) => saveBudget(s, '2026-11', 'D01', 1))).rejects.toMatchObject({
    code: 'read_only',
  });
});
test('remoção bloqueia envio, preserva fila e novo convite não reaplica operações antigas', async () => {
  const f = await setup();
  f.online(false);
  await f.b.commitFinance((s) => saveBudget(s, '2026-11', 'D01', 1));
  f.online(true);
  await f.owner.request('remove', { workspace_id: f.shared.id, user_id: DEMO_ACTORS[1].uid });
  await f.b.flush();
  expect(await f.b.status()).toBe('Precisa de atenção');
  expect(await f.b.db.workspaceOutbox.count()).toBe(1);
  const invite = await f.owner.request('invite', {
    workspace_id: f.shared.id,
    email: DEMO_ACTORS[1].email,
  });
  await f.guest.request('accept', { token: invite.token });
  await expect(
    f.guest.request('apply', {
      workspace_id: f.shared.id,
      operation: (await f.b.db.workspaceOutbox.toArray())[0],
    }),
  ).rejects.toMatchObject({ code: 'generation' });
});
test('edições simultâneas geram conflito e preservam a versão local para recuperação', async () => {
  const f = await setup();
  await f.a.commitFinance((s) => saveBudget(s, '2026-11', 'D01', 100));
  await f.a.flush();
  await f.b.refresh();
  f.online(false);
  await f.a.commitFinance((s) => saveBudget(s, '2026-11', 'D01', 200));
  await f.b.commitFinance((s) => saveBudget(s, '2026-11', 'D01', 300));
  await f.a.flush();
  await f.b.flush();
  f.online(true);
  await f.a.flush();
  await f.b.flush();
  expect(await f.b.status()).toBe('Precisa de atenção');
  expect((await f.b.finance()).monthlyBudgets['2026-11'].D01).toBe(300);
  await f.b.discardConflicts();
  expect((await f.b.finance()).monthlyBudgets['2026-11'].D01).toBe(200);
  expect((await f.b.recovery()).operations.length).toBeGreaterThan(0);
});
test('convites vinculados ao e-mail, uso único, rotação e limite de um casal', async () => {
  const name = 'inv-' + crypto.randomUUID(),
    owner = new DemoTransport(DEMO_ACTORS[0], { name }),
    guest = new DemoTransport(DEMO_ACTORS[1], { name }),
    other = new DemoTransport(DEMO_ACTORS[2], { name });
  resources.push(owner, guest, other);
  await owner.request('list');
  const w = await owner.request('create', { name: 'Casa' }),
    old = await owner.request('invite', { workspace_id: w.id, email: DEMO_ACTORS[1].email }),
    next = await owner.request('invite', { workspace_id: w.id, email: DEMO_ACTORS[1].email });
  await expect(guest.request('accept', { token: old.token })).rejects.toMatchObject({
    code: 'invalid_invite',
  });
  await expect(other.request('accept', { token: next.token })).rejects.toMatchObject({
    code: 'wrong_account',
  });
  await guest.request('accept', { token: next.token });
  await expect(guest.request('accept', { token: next.token })).rejects.toMatchObject({
    code: 'invalid_invite',
  });
  await expect(owner.request('create', { name: 'Outra casa' })).rejects.toMatchObject({
    code: 'conflict',
  });
  const raw = JSON.stringify(await owner.db.table('state').toArray());
  expect(raw).not.toContain(next.token);
});
test('licença do titular inativa permite consulta e remoção, mas não gravações', async () => {
  const f = await setup();
  await f.owner.request('demo_license', { active: false });
  await f.b.refresh();
  await expect(f.b.commitFinance((s) => saveBudget(s, '2026-11', 'D01', 1))).rejects.toMatchObject({
    code: 'read_only',
  });
  expect(await f.guest.request('pull', { workspace_id: f.shared.id })).toHaveProperty('revision');
  await f.owner.request('remove', { workspace_id: f.shared.id, user_id: DEMO_ACTORS[1].uid });
});
test('cópia só para destino vazio, preserva origem e é idempotente', async () => {
  const f = await setup();
  const p = new WorkspaceClient({
    project: 'test',
    actor: DEMO_ACTORS[0],
    space: f.personal,
    transport: f.owner,
  });
  resources.push(p);
  await p.initialize();
  await p.commitFinance((s) => saveBudget(s, '2026-11', 'D01', 100));
  await p.flush();
  const input = {
    workspace_id: f.shared.id,
    source_id: f.personal.id,
    area: 'both',
    operation_id: crypto.randomUUID(),
  };
  const result = await f.owner.request('copy', input);
  expect(await f.owner.request('copy', input)).toEqual(result);
  await f.a.pull();
  expect((await f.a.finance()).monthlyBudgets['2026-11'].D01).toBe(100);
  expect((await p.finance()).monthlyBudgets['2026-11'].D01).toBe(100);
  await expect(
    f.owner.request('copy', { ...input, operation_id: crypto.randomUUID() }),
  ).rejects.toMatchObject({ code: 'not_empty' });
});
test('JWT do espaço verifica identidade, origem, geração, prazo e chave', async () => {
  const { privateKey, publicKey } = await generateKeyPair('ES256'),
    now = Math.floor(Date.now() / 1000);
  const signed = async (exp = 86400) =>
    new SignJWT({ workspaceId: 'space', kind: 'shared', generation: 1, writable: true })
      .setProtectedHeader({ alg: 'ES256', kid: 'vertice-workspace-v1', typ: 'JWT' })
      .setSubject('uid')
      .setIssuer('issuer')
      .setAudience('origin')
      .setIssuedAt(now)
      .setExpirationTime(now + exp)
      .sign(privateKey);
  const config = {
    uid: 'uid',
    workspaceId: 'space',
    generation: 1,
    publicKey: await exportJWK(publicKey),
    issuer: 'issuer',
    audience: 'origin',
  };
  expect((await verifyWorkspaceLease(await signed(), config)).writable).toBe(true);
  await expect(verifyWorkspaceLease(await signed(86401), config)).rejects.toThrow();
  await expect(
    verifyWorkspaceLease(await signed(), { ...config, generation: 2 }),
  ).rejects.toThrow();
  await expect(verifyWorkspaceLease(await signed(), { ...config, uid: 'other' })).rejects.toThrow();
});
test('serviço só confia na identidade verificada e não expõe token de convite ao banco', async () => {
  let input, actor;
  const deps = {
    enabled: true,
    allowedOrigins: ['https://test.local'],
    authenticate: async () => ({ uid: 'verified' }),
    command: async (a, action, i) => {
      actor = a;
      input = i;
      return { ok: true };
    },
    sign: async () => '',
    randomToken: () => 'a'.repeat(64),
    hash: async () => 'b'.repeat(64),
  };
  const req = (body) =>
    new Request('https://edge.local', {
      method: 'POST',
      headers: { origin: 'https://test.local', authorization: 'Bearer valid' },
      body: JSON.stringify(body),
    });
  const response = await workspaceHandler(
    req({
      action: 'invite',
      input: { workspace_id: 's', actor: 'forged', email: ' PARTNER@TEST.LOCAL ' },
    }),
    deps,
  );
  expect(response.status).toBe(200);
  expect(actor).toBe('verified');
  expect(input).not.toHaveProperty('actor');
  expect(input.token_hash).toBe('b'.repeat(64));
  expect(input).not.toHaveProperty('token');
  expect((await response.json()).token).toBe('a'.repeat(64));
  expect(
    (await workspaceHandler(req({ action: 'list', input: {} }), { ...deps, enabled: false }))
      .status,
  ).toBe(404);
  expect(
    (
      await workspaceHandler(req({ action: 'list', input: {} }), {
        ...deps,
        authenticate: async () => null,
      })
    ).status,
  ).toBe(401);
});
test('storage identifica escopos inválidos', () => {
  expect(() => workspaceDatabase('bad/slash', 'user', 'space')).toThrow();
});
test('novo aceite abre dados atuais e mantém a fila anterior em recuperação', async () => {
  const f = await setup();
  f.online(false);
  await f.b.commitFinance((s) => saveBudget(s, '2026-11', 'D01', 123));
  await f.b.flush();
  f.online(true);
  await f.owner.request('remove', { workspace_id: f.shared.id, user_id: DEMO_ACTORS[1].uid });
  await f.b.flush();
  const invite = await f.owner.request('invite', {
    workspace_id: f.shared.id,
    email: DEMO_ACTORS[1].email,
  });
  await f.guest.request('accept', { token: invite.token });
  const descriptor = (await f.guest.request('list'))[0];
  const current = new WorkspaceClient({
    project: 'test',
    actor: DEMO_ACTORS[1],
    space: descriptor,
    transport: f.guest,
  });
  resources.push(current);
  await current.initialize();
  expect(await current.finance()).toHaveProperty('version', 2);
  expect(await current.db.workspaceOutbox.count()).toBe(0);
  expect((await current.db.workspaceMeta.get('recovery-epoch-1')).value.operations.length).toBe(1);
  await f.b.flush();
  await expect(f.b.finance()).rejects.toMatchObject({ code: 'removed' });
  expect(await current.finance()).toHaveProperty('version', 2);
});
test('resposta perdida é reconciliada pelo journal sem duplicar operação', async () => {
  const f = await setup();
  const original = f.owner.request.bind(f.owner);
  let drop = true;
  f.owner.request = async (action, input) => {
    const response = await original(action, input);
    if (action === 'apply' && drop) {
      drop = false;
      throw Error('response lost');
    }
    return response;
  };
  await f.a.commitFinance((s) => saveBudget(s, '2026-11', 'D01', 123));
  await f.a.flush();
  await f.a.flush();
  expect(await f.a.status()).toBe('Sincronizado');
  const server = await f.owner.db.table('state').get('server');
  expect(server.spaces.find((w) => w.id === f.shared.id).revision).toBe(1);
});
test('alterações em registros diferentes sincronizam sem conflito', async () => {
  const f = await setup();
  await f.a.commitFinance((s) => {
    s.entries.push(
      ...['a', 'b'].map((id) => ({
        id,
        name: id,
        amount: 100,
        date: '2026-11-09',
        type: 'expense',
        paid: false,
        categoryId: 'D01',
        paymentMethodId: 'P2',
        observation: '',
      })),
    );
  });
  await f.a.flush();
  await f.b.refresh();
  f.online(false);
  await f.a.commitFinance((s) => {
    s.entries.find((e) => e.id === 'a').amount = 200;
  });
  await f.b.commitFinance((s) => {
    s.entries.find((e) => e.id === 'b').amount = 300;
  });
  await f.a.flush();
  await f.b.flush();
  f.online(true);
  await f.a.flush();
  await f.b.flush();
  await f.a.refresh();
  expect(await f.b.status()).toBe('Sincronizado');
  expect((await f.a.finance()).entries.map((e) => e.amount).sort()).toEqual([200, 300]);
});

test('formulário financeiro preserva alterações remotas em outro registro', async () => {
  const f = await setup();
  await f.a.commitFinance((s) => {
    s.entries.push(
      ...['a', 'b'].map((id) => ({
        id,
        name: id,
        amount: 100,
        date: '2026-11-09',
        type: 'expense',
        paid: false,
        categoryId: 'D01',
        paymentMethodId: 'P2',
        observation: '',
      })),
    );
  });
  await f.a.flush();
  await f.b.refresh();
  const form = new WorkspaceFinanceStore(f.a);
  await form.load();
  await f.b.commitFinance((s) => {
    s.entries.find((e) => e.id === 'b').amount = 300;
  });
  await f.b.flush();
  await f.a.refresh();
  await form.commit((s) => {
    s.entries.find((e) => e.id === 'a').amount = 200;
  });
  await f.a.flush();
  expect((await f.a.finance()).entries.map((e) => e.amount).sort()).toEqual([200, 300]);
});
