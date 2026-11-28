// @vitest-environment node
import 'fake-indexeddb/auto';
import { test, expect, afterEach } from 'vitest';
import { WorkspaceClient, WorkspaceFinanceStore, WorkspaceError } from './core.mjs';
import { DemoTransport, DEMO_ACTORS } from './demo.mjs';
import { saveFixed, adjustFixed } from '../../previews/controle-financeiro/finance-domain.mjs';

const resources = [];
afterEach(async () => {
  // Aguarda envios em andamento (flush disparado por gravações) antes de fechar os bancos.
  for (const r of resources.splice(0).reverse()) {
    while (r.running) await r.running.catch(() => {});
    r.close?.();
  }
});

const CREDIT = (over = {}) => ({
  id: 'academia',
  name: 'Academia',
  startMonth: '2026-10',
  endMonth: null,
  from: '2026-10',
  amount: 8990,
  categoryId: 'D01',
  paymentMethodId: 'P4',
  dueDay: 15,
  ...over,
});
const createFixed = (over) => (s) => saveFixed(s, CREDIT(over));
const mats = (calls) => calls.filter((c) => c.action === 'materialize_fixed_credit');

// Dispositivos de um mesmo casal. Cada transporte registra chamadas e aceita falhas injetadas.
async function setup() {
  const name = 'fixed-' + crypto.randomUUID();
  let now = Date.parse('2026-11-15T12:00:00-03:00'),
    online = true;
  const options = { name, clock: () => now, online: () => online };
  const owner = new DemoTransport(DEMO_ACTORS[0], options),
    guest = new DemoTransport(DEMO_ACTORS[1], options);
  resources.push(owner, guest);
  const shared = await owner.request('create', { name: 'Nossa casa' });
  const invite = await owner.request('invite', {
    workspace_id: shared.id,
    email: DEMO_ACTORS[1].email,
  });
  await guest.request('accept', { token: invite.token });
  const os = (await owner.request('list')).find((s) => s.id === shared.id),
    gs = (await guest.request('list'))[0];
  const calls = [],
    faults = {};
  const spy = (t) => ({
    request: async (action, input) => {
      calls.push({ action, input });
      if (faults[action]) return faults[action](input);
      return t.request(action, input);
    },
  });
  const a = new WorkspaceClient({
    project: 'test',
    actor: DEMO_ACTORS[0],
    space: os,
    transport: spy(owner),
    clock: () => now,
    timeZone: 'America/Sao_Paulo',
  });
  const b = new WorkspaceClient({
    project: 'test',
    actor: DEMO_ACTORS[1],
    space: gs,
    transport: spy(guest),
    clock: () => now,
    timeZone: 'America/Sao_Paulo',
  });
  resources.push(a, b);
  await a.initialize();
  await b.initialize();
  return {
    a,
    b,
    owner,
    guest,
    calls,
    faults,
    online: (v) => (online = v),
    setNow: (t) => (now = t),
    now: () => now,
    clock: () => now,
    advance: (ms) => (now += ms),
  };
}
const offline = () => {
  throw new WorkspaceError('network', 'Sem conexão.');
};
const queueOf = async (c) => (await c.db.workspaceMeta.get('materialize-fixed'))?.value ?? [];
const localEntry = async (c, id) => c.db.workspaceRecords.get('finance_entries/' + id);

test('abrir e visualizar meses não chama a RPC', async () => {
  const f = await setup();
  await f.a.commitFinance(createFixed());
  await f.a.flush();
  f.calls.length = 0;
  await f.b.refresh();
  await f.b.finance();
  await new WorkspaceFinanceStore(f.b).load();
  await f.a.finance();
  await f.a.flush();
  expect(mats(f.calls)).toEqual([]);
});

test('ação explícita de criar conta fixa de crédito chama a RPC uma única vez com competência e fuso do aparelho', async () => {
  const f = await setup();
  await f.a.commitFinance(createFixed());
  await f.a.flush();
  await f.a.flush();
  const calls = mats(f.calls);
  expect(calls).toHaveLength(1);
  expect(calls[0].input).toEqual({
    workspace_id: expect.any(String),
    generation: expect.any(Number),
    operation_id: expect.any(String),
    account_id: 'academia',
    competence_month: '2026-11',
    time_zone: 'America/Sao_Paulo',
  });
  expect(await localEntry(f.a, 'academia:2026-11')).toBeDefined();
  expect(await queueOf(f.a)).toEqual([]);
});

test('repetir a sincronização ou gravar outra alteração não cria novas chamadas nem duplicações', async () => {
  const f = await setup();
  await f.a.commitFinance(createFixed());
  await f.a.flush();
  await f.a.commitFinance((s) => saveFixed(s, CREDIT({ id: 'outra', name: 'Outra', amount: 100 })));
  await f.a.flush();
  await f.a.flush();
  expect(mats(f.calls).map((c) => c.input.account_id)).toEqual(['academia', 'outra']);
  const rows = await f.a.db.workspaceRecords.where('entity').equals('finance_entries').toArray();
  expect(rows.filter((r) => r.body.fixed_account_id === 'academia')).toHaveLength(1);
});

test('ajuste da competência atual é gravado pelo fluxo normal e não gera materialização separada', async () => {
  const f = await setup();
  await f.a.commitFinance(createFixed());
  await f.a.flush();
  f.calls.length = 0;
  await f.a.commitFinance((s) => adjustFixed(s, 'academia', '2026-11', 9500));
  await f.a.flush();
  expect(mats(f.calls)).toEqual([]);
  expect((await localEntry(f.a, 'academia:2026-11')).body.planned_amount_cents).toBe(9500);
});

test('conta fixa comum não é afetada', async () => {
  const f = await setup();
  await f.a.commitFinance((s) =>
    saveFixed(s, CREDIT({ id: 'luz', name: 'Luz', paymentMethodId: 'P2' })),
  );
  await f.a.flush();
  expect(mats(f.calls)).toEqual([]);
  expect(await localEntry(f.a, 'luz:2026-11')).toBeUndefined();
});

test('competências futuras e passadas não são materializadas', async () => {
  const f = await setup();
  await f.a.commitFinance((s) =>
    saveFixed(s, CREDIT({ id: 'futura', startMonth: '2026-12', from: '2026-12' })),
  );
  await f.a.commitFinance((s) =>
    saveFixed(
      s,
      CREDIT({ id: 'passada', startMonth: '2026-09', from: '2026-09', endMonth: '2026-10' }),
    ),
  );
  await f.a.flush();
  expect(mats(f.calls)).toEqual([]);
});

test('"exists" é sucesso: não há erro, não há duplicação e a fila esvazia', async () => {
  const f = await setup();
  f.faults.materialize_fixed_credit = offline;
  await f.a.commitFinance(createFixed());
  await f.a.flush();
  expect(await queueOf(f.a)).toHaveLength(1);
  f.advance(300000); // passa o intervalo de espera
  delete f.faults.materialize_fixed_credit;
  await f.owner.request('materialize_fixed_credit', {
    workspace_id: f.a.space.id,
    generation: f.a.space.generation,
    operation_id: crypto.randomUUID(),
    account_id: 'academia',
    competence_month: '2026-11',
    time_zone: 'America/Sao_Paulo',
  });
  await f.a.flush();
  expect(await queueOf(f.a)).toEqual([]);
  expect(f.a.status ? await f.a.status() : 'ok').not.toMatch(/erro|conflito/i);
});

test('"not_current", "not_eligible" e "tombstoned" não alteram dados locais nem a fila financeira', async () => {
  for (const status of ['not_current', 'not_eligible', 'tombstoned']) {
    const f = await setup();
    f.faults.materialize_fixed_credit = () => ({ status });
    await f.a.commitFinance(createFixed());
    await f.a.flush();
    expect(await queueOf(f.a), status).toEqual([]);
    expect(await localEntry(f.a, 'academia:2026-11'), status).toBeUndefined();
    expect(await f.a.db.workspaceOutbox.count(), status).toBe(0);
  }
});

test('revisão publicada pela RPC chega ao outro dispositivo pelo pull existente', async () => {
  const f = await setup();
  await f.a.commitFinance(createFixed());
  await f.a.flush();
  expect(await localEntry(f.b, 'academia:2026-11')).toBeUndefined();
  await f.b.pull();
  expect(await localEntry(f.b, 'academia:2026-11')).toBeDefined();
});

test('falha de rede na RPC não bloqueia gravações financeiras nem perde alterações locais', async () => {
  const f = await setup();
  f.faults.materialize_fixed_credit = offline;
  await f.a.commitFinance(createFixed());
  await f.a.flush();
  await f.a.commitFinance((s) =>
    saveFixed(
      s,
      CREDIT({ id: 'streaming', name: 'Streaming', paymentMethodId: 'P2', amount: 3000 }),
    ),
  );
  await f.a.flush();
  await f.b.refresh();
  expect((await f.b.finance()).fixedAccounts.map((x) => x.id)).toEqual(
    expect.arrayContaining(['academia', 'streaming']),
  );
  expect(await f.a.db.workspaceOutbox.count()).toBe(0);
  expect(await queueOf(f.a)).toHaveLength(1);
  const firstOp = (await queueOf(f.a))[0].operation_id;
  f.advance(300000); // passa o intervalo de espera
  delete f.faults.materialize_fixed_credit;
  await f.a.flush();
  expect(await queueOf(f.a)).toEqual([]);
  expect(
    mats(f.calls)
      .filter((c) => c.input.account_id === 'academia')
      .map((c) => c.input.operation_id),
  ).toEqual([firstOp, firstOp]); // falhas e reenvio reutilizam o mesmo operation_id
});

test('falha de rede da RPC mantém a fila local após reinício do cliente', async () => {
  const f = await setup();
  f.faults.materialize_fixed_credit = offline;
  await f.a.commitFinance(createFixed());
  await f.a.flush();
  f.a.close();
  const reopened = new WorkspaceClient({
    project: 'test',
    actor: DEMO_ACTORS[0],
    space: f.a.space,
    transport: f.a.transport,
    clock: f.a.clock,
    timeZone: 'America/Sao_Paulo',
  });
  resources.push(reopened);
  expect(await queueOf(reopened)).toHaveLength(1);
});

test('identidade de crédito é o ID P4: método com nome de crédito e outro ID não é materializado', async () => {
  const f = await setup();
  await f.a.commitFinance((s) =>
    saveFixed(s, CREDIT({ id: 'falso', name: 'Cartão de Crédito', paymentMethodId: 'P6' })),
  );
  await f.a.flush();
  expect(mats(f.calls)).toEqual([]);
});

test('materialização não exige carteira nem forma de pagamento além de P4', async () => {
  const f = await setup();
  await f.a.commitFinance(createFixed());
  await f.a.flush();
  const [call] = mats(f.calls);
  expect(Object.keys(call.input).sort()).toEqual(
    [
      'account_id',
      'competence_month',
      'generation',
      'operation_id',
      'time_zone',
      'workspace_id',
    ].sort(),
  );
  expect((await localEntry(f.a, 'academia:2026-11')).body.payment_method_id).toBe('P4');
});

test('competência e fuso são os do aparelho na virada do mês', async () => {
  const f = await setup();
  f.setNow(Date.parse('2026-12-01T01:30:00Z'));
  await f.a.refresh();
  f.a.timeZone = 'America/Sao_Paulo';
  await f.a.commitFinance(createFixed());
  await f.a.flush();
  expect(mats(f.calls).at(-1).input.competence_month).toBe('2026-11');

  f.a.timeZone = 'Asia/Tokyo';
  await f.a.commitFinance((s) => saveFixed(s, CREDIT({ id: 'tokyo', name: 'Tokyo' })));
  await f.a.flush();
  expect(mats(f.calls).at(-1).input).toMatchObject({
    account_id: 'tokyo',
    competence_month: '2026-12',
    time_zone: 'Asia/Tokyo',
  });
});

test('servidor recusa competência que não é a corrente do fuso informado', async () => {
  const f = await setup();
  const base = {
    workspace_id: f.a.space.id,
    generation: f.a.space.generation,
    account_id: 'academia',
    time_zone: 'America/Sao_Paulo',
  };
  const r = await f.owner.request('materialize_fixed_credit', {
    ...base,
    operation_id: crypto.randomUUID(),
    competence_month: '2026-10',
  });
  expect(r.status).toBe('not_current');
});

test('mesma operação repetida devolve o resultado armazenado; conteúdo diferente é erro', async () => {
  const f = await setup();
  const input = {
    workspace_id: f.a.space.id,
    generation: f.a.space.generation,
    operation_id: crypto.randomUUID(),
    account_id: 'academia',
    competence_month: '2026-11',
    time_zone: 'America/Sao_Paulo',
  };
  await f.a.commitFinance(createFixed());
  const first = await f.owner.request('materialize_fixed_credit', input);
  const again = await f.owner.request('materialize_fixed_credit', input);
  expect(again).toEqual(first);
  await expect(
    f.owner.request('materialize_fixed_credit', { ...input, account_id: 'outra' }),
  ).rejects.toMatchObject({ code: 'operation_reused' });
});

test('restauração de backup não dispara materialização', async () => {
  const f = await setup();
  await f.a.commitFinance((s) => saveFixed(s, CREDIT()), undefined, undefined, {
    materialize: false,
  });
  await f.a.flush();
  expect(mats(f.calls)).toEqual([]);
  expect(await queueOf(f.a)).toEqual([]);
});

test('conflito 40001 de gravação preserva o ajuste local e a materialização aguarda sem chamar a RPC', async () => {
  const f = await setup();
  // Conta enviada online, sem materialização, para isolar o cenário de conflito.
  await f.a.commitFinance(createFixed(), undefined, undefined, { materialize: false });
  await f.a.flush();
  f.online(false);
  await f.a.commitFinance((s) => adjustFixed(s, 'academia', '2026-11', 9500));
  await f.a.flush(); // ajuste pendente, sem envio
  f.online(true);
  // Outro dispositivo cria a linha antes do envio: o apply do ajuste recebe 40001.
  await f.owner.request('materialize_fixed_credit', {
    workspace_id: f.a.space.id,
    generation: f.a.space.generation,
    operation_id: crypto.randomUUID(),
    account_id: 'academia',
    competence_month: '2026-11',
    time_zone: 'America/Sao_Paulo',
  });
  f.calls.length = 0;
  await f.a.flush();
  const ops = await f.a.db.workspaceOutbox.toArray();
  expect(ops).toHaveLength(1);
  expect(ops[0].status).toBe('conflict');
  expect(ops[0].changes.find((c) => c.entity === 'finance_entries').body.planned_amount_cents).toBe(
    9500,
  );
  expect(mats(f.calls)).toEqual([]);
  expect(await queueOf(f.a)).toHaveLength(1);
});

// Classes de erro: nenhuma delas encerra a operação; todas reenviam com o mesmo operation_id.
const RETRYABLE = [
  ['rede', () => new WorkspaceError('network', 'Sem conexão.')],
  ['timeout', () => Object.assign(new Error('aborted'), { name: 'AbortError' })],
  ['erro genérico sem código', () => new Error('falha inesperada')],
  ['sessão temporária', () => new WorkspaceError('unauthorized', 'Entre novamente.')],
  ['espaço somente consulta', () => new WorkspaceError('forbidden', 'Somente consulta.')],
  ['validação', () => new WorkspaceError('validation', 'Revise os valores.')],
  ['código desconhecido', () => new WorkspaceError('x_desconhecido', 'Erro.')],
];
for (const [label, makeError] of RETRYABLE) {
  test(`falha (${label}) mantém a operação na fila, reenvia com o mesmo operation_id e não perde dados locais`, async () => {
    const f = await setup();
    f.faults.materialize_fixed_credit = () => {
      throw makeError();
    };
    await f.a.commitFinance(createFixed());
    await f.a.flush();
    const [pending] = await queueOf(f.a);
    expect(pending).toBeDefined();
    await f.a.flush();
    expect(await queueOf(f.a)).toEqual([pending]);
    f.advance(300000); // passa o intervalo de espera
    delete f.faults.materialize_fixed_credit;
    await f.a.flush();
    expect(await queueOf(f.a)).toEqual([]);
    const ids = mats(f.calls).map((c) => c.input.operation_id);
    // Falha + sucesso: a sincronização antes do horário programado não chamou a RPC.
    expect(ids).toHaveLength(2);
    expect(new Set(ids)).toEqual(new Set([pending.operation_id]));
    expect((await f.a.finance()).fixedAccounts.map((x) => x.id)).toContain('academia');
    expect(await f.a.db.workspaceOutbox.count()).toBe(0);
  });
}

test('not_current encerra a tentativa sem mudar a competência; ação futura cria nova operação', async () => {
  const f = await setup();
  f.faults.materialize_fixed_credit = () => ({ status: 'not_current' });
  await f.a.commitFinance(createFixed());
  await f.a.flush();
  expect(await queueOf(f.a)).toEqual([]);
  expect(mats(f.calls).map((c) => c.input.competence_month)).toEqual(['2026-11']);
  expect(await localEntry(f.a, 'academia:2026-11')).toBeUndefined();
  const firstOp = mats(f.calls)[0].input.operation_id;

  f.advance(300000); // passa o intervalo de espera
  delete f.faults.materialize_fixed_credit;
  await f.a.commitFinance((s) => saveFixed(s, CREDIT({ amount: 9000 })));
  await f.a.flush();
  const later = mats(f.calls).at(-1).input;
  expect(later.competence_month).toBe('2026-11');
  expect(later.operation_id).not.toBe(firstOp);
});

// Backoff: relógio controlado; cada tentativa só ocorre no horário programado.
const reopen = (f, c) => {
  const again = new WorkspaceClient({
    project: 'test',
    actor: c.actor,
    space: c.space,
    transport: c.transport,
    clock: f.clock,
    timeZone: 'America/Sao_Paulo',
  });
  resources.push(again);
  return again;
};
const nextGap = async (c, now) => (await queueOf(c))[0].next_attempt_at - now;

test('backoff: intervalos 15s, 30s, 1min, 2min e 5min depois, sem tentativa antes do horário', async () => {
  const f = await setup();
  f.faults.materialize_fixed_credit = offline;
  await f.a.commitFinance(createFixed());
  await f.a.flush();
  const gaps = [];
  for (let i = 0; i < 6; i++) {
    gaps.push(await nextGap(f.a, f.now()));
    const callsBefore = mats(f.calls).length;
    f.setNow((await queueOf(f.a))[0].next_attempt_at - 1);
    await f.a.flush();
    expect(mats(f.calls).length, `antes do horário, tentativa ${i + 2}`).toBe(callsBefore);
    f.setNow((await queueOf(f.a))[0].next_attempt_at);
    await f.a.flush();
  }
  expect(gaps).toEqual([15000, 30000, 60000, 120000, 300000, 300000]);
  expect(await queueOf(f.a)).toHaveLength(1);
  expect(new Set(mats(f.calls).map((c) => c.input.operation_id)).size).toBe(1);
});

test('backoff: reinício do aplicativo mantém contador e horário', async () => {
  const f = await setup();
  f.faults.materialize_fixed_credit = offline;
  await f.a.commitFinance(createFixed());
  await f.a.flush();
  const [saved] = await queueOf(f.a);
  f.a.close();
  const again = reopen(f, f.a);
  expect(await queueOf(again)).toEqual([saved]);
  f.setNow(saved.next_attempt_at - 1);
  f.calls.length = 0;
  await again.flush();
  expect(mats(f.calls)).toEqual([]);
  f.setNow(saved.next_attempt_at);
  delete f.faults.materialize_fixed_credit;
  await again.flush();
  expect(mats(f.calls).map((c) => c.input.operation_id)).toEqual([saved.operation_id]);
  expect(await queueOf(again)).toEqual([]);
});

test('backoff: contador reinicia após sucesso; a próxima operação começa em 15s', async () => {
  const f = await setup();
  f.faults.materialize_fixed_credit = offline;
  await f.a.commitFinance(createFixed());
  await f.a.flush();
  f.setNow((await queueOf(f.a))[0].next_attempt_at);
  await f.a.flush();
  f.setNow((await queueOf(f.a))[0].next_attempt_at);
  delete f.faults.materialize_fixed_credit;
  await f.a.flush();
  expect(await queueOf(f.a)).toEqual([]);
  f.faults.materialize_fixed_credit = offline;
  // Conta nova: a anterior já está confirmada no servidor e não gera nova operação.
  await f.a.commitFinance((s) => saveFixed(s, CREDIT({ id: 'nova', name: 'Nova', amount: 100 })));
  await f.a.flush();
  const [fresh] = await queueOf(f.a);
  expect(fresh.attempts).toBe(1);
  expect(fresh.next_attempt_at - f.now()).toBe(15000);
});

test('backoff: erros diferentes seguem o mesmo intervalo', async () => {
  for (const [, makeError] of RETRYABLE) {
    const f = await setup();
    f.faults.materialize_fixed_credit = () => {
      throw makeError();
    };
    await f.a.commitFinance(createFixed());
    await f.a.flush();
    expect(await nextGap(f.a, f.now())).toBe(15000);
    f.setNow((await queueOf(f.a))[0].next_attempt_at);
    await f.a.flush();
    expect(await nextGap(f.a, f.now())).toBe(30000);
  }
});

test('backoff: fila financeira segue normal enquanto a materialização aguarda', async () => {
  const f = await setup();
  f.faults.materialize_fixed_credit = offline;
  await f.a.commitFinance(createFixed());
  await f.a.flush();
  const callsBefore = mats(f.calls).length;
  await f.a.commitFinance((s) =>
    saveFixed(s, CREDIT({ id: 'luz', name: 'Luz', paymentMethodId: 'P2' })),
  );
  await f.a.flush();
  await f.b.refresh();
  expect((await f.b.finance()).fixedAccounts.map((x) => x.id)).toContain('luz');
  expect(await f.a.db.workspaceOutbox.count()).toBe(0);
  expect(mats(f.calls).length).toBe(callsBefore);
});

test('backoff: operações pendentes de contas diferentes são preservadas com seus contadores', async () => {
  const f = await setup();
  f.faults.materialize_fixed_credit = offline;
  await f.a.commitFinance(createFixed());
  await f.a.commitFinance((s) => saveFixed(s, CREDIT({ id: 'outra', name: 'Outra', amount: 100 })));
  await f.a.flush();
  f.setNow((await queueOf(f.a))[0].next_attempt_at);
  await f.a.flush();
  const queue = await queueOf(f.a);
  // A rede interrompe o lote: a segunda operação ainda não foi tentada e segue na fila.
  expect(queue.map((q) => q.attempts)).toEqual([2, undefined]);
  const again = reopen(f, f.a);
  expect(await queueOf(again)).toEqual(queue);
});
