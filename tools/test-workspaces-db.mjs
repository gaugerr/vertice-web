// Disposable PostgreSQL only. Never accepts a hosted URL, key or production UID.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';

const container = process.env.POSTGRES_CONTAINER;
assert(container, 'Set POSTGRES_CONTAINER to a disposable PostgreSQL container');
const docker = (args, input) =>
  execFileSync('docker', ['--host=unix:///var/run/docker.sock', ...args], {
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
const inspection = JSON.parse(docker(['inspect', container]))[0];
assert.equal(
  inspection.HostConfig.NetworkMode,
  'none',
  'Only an isolated local container is allowed',
);
assert.equal(
  Object.keys(inspection.NetworkSettings.Ports ?? {}).filter(
    (k) => inspection.NetworkSettings.Ports[k],
  ).length,
  0,
);
const database = 'workspace_test_' + randomUUID().replaceAll('-', '');
docker(['exec', container, 'createdb', '-U', 'postgres', database]);
let checks = 0;
const check = (value, expected, label) => {
  assert.deepEqual(value, expected, label);
  checks++;
};
const literal = (value) =>
  "'" +
  String(typeof value === 'object' ? JSON.stringify(value) : value).replaceAll("'", "''") +
  "'";
const sql = (query, role = 'postgres', uid = '') => {
  try {
    return docker(
      [
        'exec',
        '-i',
        container,
        'psql',
        '-X',
        '-q',
        '-t',
        '-A',
        '-v',
        'ON_ERROR_STOP=1',
        '-v',
        'VERBOSITY=verbose',
        '-U',
        'postgres',
        '-d',
        database,
      ],
      `set role ${role};set request.jwt.claim.sub=${literal(uid)};\n` + query,
    );
  } catch (error) {
    const message = error.stderr?.toString() ?? error.message;
    const failure = new Error(message);
    failure.code = message.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1];
    throw failure;
  }
};
const json = (query, role, uid) =>
  JSON.parse(
    sql(`select to_jsonb(q.value) from (${query.trim().replace(/;$/, '')}) q(value)`, role, uid),
  );
const rejected = (run, code) => {
  assert.throws(run, (error) => error.code === code, 'Expected SQLSTATE ' + code);
  checks++;
};
const A = '11111111-1111-4111-8111-111111111111',
  B = '22222222-2222-4222-8222-222222222222',
  C = '33333333-3333-4333-8333-333333333333';
const rpc = (actor, action, input = {}) =>
  json(
    `select public.workspace_command(${literal(actor)}::uuid,${literal(action)},${literal(input)}::jsonb)`,
    'service_role',
  );
const access = (actor) =>
  json(`select public.access_license_check(${literal(actor)}::uuid)`, 'service_role');
const capture = (id, email, refund = false) => {
  const event = {
    event_key: createHash('sha256')
      .update(id + email + refund)
      .digest('hex'),
    event_name: refund ? 'refund' : 'purchase_approved',
    order_id: id,
    product_id: 'local-only-test-product',
    customer_email: email,
    order_status: refund ? 'refunded' : 'paid',
    created_at_source: '2026-11-09T12:00:00Z',
    ...(refund ? { refunded_at: '2026-11-09T13:00:00Z' } : { paid_at: '2026-11-09T12:01:00Z' }),
  };
  return json(`select public.cakto_capture_events(${literal([event])}::jsonb)`, 'service_role');
};
const processPending = () => json('select public.cakto_process_pending(true,20)', 'service_role');
const fingerprint = () =>
  json(readFileSync(new URL('./sql/access-fingerprint.sql', import.meta.url), 'utf8'));
const version = (space, entity, id) =>
  json(
    `select row_version from public.${entity} where workspace_id=${literal(space)} and id=${literal(id)}`,
  );
const change = (entity, id, body, expected_version = 0) => ({ entity, id, body, expected_version });
const apply = (actor, space, changes, guards = [], generation = 1, id = randomUUID()) =>
  rpc(actor, 'apply', { workspace_id: space, operation: { id, generation, changes, guards } });

try {
  sql(`do $$begin
    if not exists(select from pg_roles where rolname='anon') then create role anon nologin;end if;
    if not exists(select from pg_roles where rolname='authenticated') then create role authenticated nologin;end if;
    if not exists(select from pg_roles where rolname='service_role') then create role service_role nologin bypassrls;end if;
    end $$;
    create schema auth;
    create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
    create table auth.identities(user_id uuid references auth.users,provider text,identity_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated,service_role;
    insert into auth.users values('${A}',now()),('${B}',now()),('${C}',now());
    insert into auth.identities values
    ('${A}','google','{"email":"titular@example.test","email_verified":true}'),
    ('${B}','google','{"email":"parceiro@example.test","email_verified":true}'),
    ('${C}','google','{"email":"comprador@example.test","email_verified":true}');`);
  const directory = new URL('../supabase/migrations/', import.meta.url);
  const files = readdirSync(directory)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const migration = files.find((f) => f.endsWith('_shared_shopping_finance_workspaces.sql'));
  assert(migration);
  for (const file of files.filter(
    (f) => f !== migration && !f.includes('enable_cakto_cron_scheduler'),
  )) {
    sql('begin;\n' + readFileSync(new URL(file, directory), 'utf8') + '\ncommit;');
  }
  sql(`insert into public.licenses(email,user_id) values('titular@example.test','${A}');
       insert into access_private.cakto_products values('local-only-test-product',true);`);
  check(
    capture('before', 'comprador@example.test'),
    { inserted: 1, duplicates: 0 },
    'capture before migration',
  );
  check(processPending().failed, 0, 'processing before migration');
  check(access(C).status, 'active', 'automatic license before migration');
  const before = fingerprint();
  sql('begin;\n' + readFileSync(new URL(migration, directory), 'utf8') + '\ncommit;');
  check(
    fingerprint(),
    before,
    'Existing Auth/license/Cakto definitions, permissions and license rows unchanged',
  );
  check(
    capture('before', 'comprador@example.test'),
    { inserted: 0, duplicates: 1 },
    'deduplication after migration',
  );
  capture('before', 'comprador@example.test', true);
  check(processPending().failed, 0, 'refund processing after migration');
  check(access(C).status, 'revoked', 'automatic refund still revokes');
  capture('after', 'comprador@example.test');
  processPending();
  check(access(C).status, 'active', 'new purchase still reactivates');
  capture('manual', 'titular@example.test', true);
  processPending();
  check(access(A).status, 'active', 'Cakto preserves manual licenses');
  const protectedAfterCakto = fingerprint();
  const personal = rpc(A, 'list')[0];
  check(personal.kind, 'personal');
  check(rpc(B, 'list'), [], 'partner does not need a license');
  const shared = rpc(A, 'create', { name: 'Nossa casa', workspace_id: randomUUID() });
  const invited = {
    workspace_id: shared.id,
    email: 'parceiro@example.test',
    token_hash: 'a'.repeat(64),
  };
  rpc(A, 'invite', invited);
  rejected(() => rpc(C, 'accept', { token_hash: invited.token_hash }), '42501');
  rpc(B, 'accept', { token_hash: invited.token_hash });
  check(rpc(B, 'list').length, 1, 'guest sees only the shared space');
  rejected(() => rpc(B, 'create', { name: 'Outro' }), '42501');
  rejected(() => rpc(A, 'create', { name: 'Outro' }), '23505');
  rejected(() => rpc(B, 'invite', invited), '42501');
  const category = change('finance_categories', 'D01', { name: 'Moradia', kind: 'expense' });
  const method = change('finance_payment_methods', 'P2', { name: 'Pix' });
  const entry = change('finance_entries', 'bill', {
    source: 'manual',
    kind: 'expense',
    name: 'Conta',
    competence_month: '2026-11-01',
    reference_date: '2026-11-09',
    planned_amount_cents: 10000,
    category_id: 'D01',
    payment_method_id: 'P2',
  });
  const firstId = randomUUID();
  const first = apply(A, shared.id, [category, method, entry], [], 1, firstId);
  check(apply(A, shared.id, [category, method, entry], [], 1, firstId), first, 'idempotent batch');
  rejected(() => apply(B, shared.id, [change('finance_entries', 'bill', entry.body, 0)]), '40001');
  rejected(
    () =>
      apply(B, shared.id, [
        change('finance_payments', 'p', {
          entry_id: 'bill',
          payment_date: '2026-11-09',
          amount_cents: 6000,
        }),
      ]),
    'P0001',
  );
  apply(
    B,
    shared.id,
    [
      change('finance_payments', 'p', {
        entry_id: 'bill',
        payment_date: '2026-11-09',
        amount_cents: 6000,
      }),
    ],
    [{ entity: 'finance_entries', id: 'bill', expected_version: 1 }],
  );
  check(
    json(
      `select paid_cents from public.finance_entry_totals where workspace_id=${literal(shared.id)}`,
    ),
    6000,
    'partial payment counted once',
  );
  rejected(
    () =>
      apply(
        A,
        shared.id,
        [
          change('finance_payments', 'p2', {
            entry_id: 'bill',
            payment_date: '2026-11-09',
            amount_cents: 4000,
          }),
        ],
        [{ entity: 'finance_entries', id: 'bill', expected_version: 1 }],
      ),
    '40001',
  );
  const v = version(shared.id, 'finance_entries', 'bill');
  apply(
    A,
    shared.id,
    [
      change('finance_payments', 'p2', {
        entry_id: 'bill',
        payment_date: '2026-11-09',
        amount_cents: 4000,
      }),
    ],
    [{ entity: 'finance_entries', id: 'bill', expected_version: v }],
  );
  check(
    json(
      `select paid_cents from public.finance_entry_totals where workspace_id=${literal(shared.id)}`,
    ),
    10000,
    'remaining payment counted once',
  );
  check(
    json('select count(*)::int from public.finance_entries', 'authenticated', B),
    1,
    'member RLS',
  );
  check(
    json('select count(*)::int from public.finance_entries', 'authenticated', C),
    0,
    'other user RLS',
  );
  rejected(() => sql('select * from public.finance_entries', 'anon'), '42501');
  rejected(() => rpc(C, 'pull', { workspace_id: shared.id }), '42501');
  rejected(
    () => sql(`select public.workspace_command('${A}','list','{}')`, 'authenticated', B),
    '42501',
  );
  rejected(
    () =>
      sql(
        `insert into public.finance_categories(workspace_id,id,name,kind) values('${shared.id}','hacked','Hacked','expense')`,
        'authenticated',
        B,
      ),
    '42501',
  );
  rejected(
    () =>
      rpc(A, 'copy', {
        workspace_id: shared.id,
        source_id: personal.id,
        area: 'both',
        operation_id: randomUUID(),
      }),
    '23505',
  );
  const listId = randomUUID(),
    catId = randomUUID(),
    itemId = randomUUID();
  apply(B, shared.id, [
    change('shopping_lists', listId, {
      store_name: 'Mercado',
      reference_date: '2026-11-09',
      budget_cents: 12000,
    }),
    change('shopping_categories', catId, {
      shopping_list_id: listId,
      title: 'Carnes',
      position: 0,
    }),
    change('shopping_items', itemId, {
      shopping_list_id: listId,
      category_id: catId,
      name: 'Carne',
      unit_price: '25.55',
      quantity: '2',
      unit: 'kg',
      is_purchased: true,
    }),
  ]);
  check(
    json(
      `select line_total_cents from public.shopping_items where workspace_id=${literal(shared.id)}`,
    ),
    5110,
    'exact decimal shopping total',
  );
  check(
    json(
      `select count(*)::int from public.shopping_lists where workspace_id=${literal(personal.id)}`,
    ),
    0,
    'personal space remains separate',
  );
  rejected(
    () =>
      apply(A, shared.id, [
        change('shopping_categories', randomUUID(), {
          shopping_list_id: randomUUID(),
          title: 'Errada',
          position: 0,
        }),
      ]),
    '23503',
  );
  rpc(A, 'remove', { workspace_id: shared.id, user_id: B });
  rejected(() => rpc(B, 'pull', { workspace_id: shared.id }), '42501');
  check(
    json('select count(*)::int from public.shopping_lists', 'authenticated', B),
    0,
    'removed member loses RLS access',
  );
  rpc(A, 'invite', { ...invited, token_hash: 'b'.repeat(64) });
  rpc(B, 'accept', { token_hash: 'b'.repeat(64) });
  check(rpc(B, 'list')[0].generation, 3, 'rejoin has a fresh generation');
  rejected(
    () =>
      apply(B, shared.id, [change('finance_payment_methods', 'old', { name: 'Antiga' })], [], 1),
    '42501',
  );
  check(
    fingerprint(),
    protectedAfterCakto,
    'Workspace operations did not modify licenses or Cakto',
  );
  // A real synthetic Cakto license owns this second space. Refund must block writes,
  // preserve existing rows and allow reading; no triggers are added to licenses.
  const automaticPersonal = rpc(C, 'list')[0];
  apply(C, automaticPersonal.id, [change('finance_payment_methods', 'pix', { name: 'Pix' })]);
  capture('after', 'comprador@example.test', true);
  processPending();
  check(access(C).status, 'revoked');
  check(
    rpc(C, 'access', { workspace_id: automaticPersonal.id }).writable,
    false,
    'refund changes workspace access immediately online',
  );
  rejected(
    () =>
      apply(C, automaticPersonal.id, [
        change('finance_payment_methods', 'cash', { name: 'Dinheiro' }),
      ]),
    '42501',
  );
  check(
    rpc(C, 'pull', { workspace_id: automaticPersonal.id }).batches.length,
    1,
    'refund preserves readable records',
  );
  check(
    json("select count(*)::int from public.licenses where email='parceiro@example.test'"),
    0,
    'invites never create licenses',
  );
  check(
    json(
      "select bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'",
    ),
    true,
    'all public tables use RLS',
  );
  check(
    json(
      "select bool_and(not has_table_privilege('anon',format('%I.%I',n.nspname,c.relname),'SELECT')) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in ('workspace_private','user_data_private')",
    ),
    true,
    'private tables hidden',
  );
  console.log(
    JSON.stringify(
      {
        status: 'passed',
        checks,
        engine: sql('select version()'),
        scope:
          'disposable local PostgreSQL; real licensing migrations; synthetic identities and Cakto events',
      },
      null,
      2,
    ),
  );
} finally {
  docker(['exec', container, 'dropdb', '-U', 'postgres', database]);
}
