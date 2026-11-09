import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const require = createRequire(new URL('../user-data/validation/package.json', import.meta.url));
const container = process.env.POSTGRES_CONTAINER;
const databaseName = 'test_' + crypto.randomUUID().replaceAll('-', '');
if (container)
  execFileSync('docker', [
    '--host=unix:///var/run/docker.sock',
    'exec',
    container,
    'createdb',
    '-U',
    'postgres',
    databaseName,
  ]);
let role = 'postgres',
  uid = '';
const literal = (v) =>
  v === null
    ? 'null'
    : typeof v === 'number'
      ? String(v)
      : "'" + String(typeof v === 'object' ? JSON.stringify(v) : v).replaceAll("'", "''") + "'";
function pg(sql) {
  try {
    return execFileSync(
      'docker',
      [
        '--host=unix:///var/run/docker.sock',
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
        databaseName,
      ],
      { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();
  } catch (e) {
    const message = e.stderr?.toString() ?? String(e);
    const error = new Error(message);
    error.code = message.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1];
    throw error;
  }
}
const db = container
  ? {
      exec: async (sql) => pg(sql),
      query: async (sql, params = []) => {
        sql = sql.replace(/\$(\d+)/g, (_, n) => literal(params[Number(n) - 1]));
        const prefix = `set role ${role};set request.jwt.claim.sub=${literal(uid)};`;
        if (/^\s*select/i.test(sql)) {
          const rows = JSON.parse(
            pg(prefix + `select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (${sql}) t;`),
          );
          return { rows };
        }
        pg(prefix + sql);
        return { rows: [] };
      },
      close: async () => {},
    }
  : new (require('@electric-sql/pglite').PGlite)();
let checks = 0;
const A = '11111111-1111-4111-8111-111111111111',
  B = '22222222-2222-4222-8222-222222222222',
  C = '33333333-3333-4333-8333-333333333333';
async function q(sql, params = []) {
  return db.query(sql, params);
}
async function acting(next, user = '') {
  role = next;
  uid = user;
  if (!container) {
    await db.exec('reset role;set role ' + next + ';');
    await q("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
  }
}
async function rpc(actor, action, input = {}) {
  const r = await q('select public.workspace_command($1::uuid,$2,$3::jsonb) as value', [
    actor,
    action,
    JSON.stringify(input),
  ]);
  return r.rows[0].value;
}
async function rejects(fn, code) {
  let error;
  try {
    await fn();
  } catch (e) {
    error = e;
  }
  assert(error, 'Expected rejection');
  if (code) assert.equal(error.code, code, error.message);
  checks++;
}
const check = (value, expected) => {
  assert.deepEqual(value, expected);
  checks++;
};
const setup = `do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin;end if;if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin;end if;if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls;end if;end $$;
create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz);create table auth.identities(user_id uuid references auth.users,provider text,identity_data jsonb);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to service_role,authenticated,anon;grant select on auth.users,auth.identities to service_role;
insert into auth.users values('${A}',now()),('${B}',now()),('${C}',now());
insert into auth.identities values('${A}','google','{"email":"titular@exemplo.test","email_verified":true,"full_name":"Titular"}'),('${B}','google','{"email":"parceiro@exemplo.test","email_verified":true,"full_name":"Parceiro"}'),('${C}','google','{"email":"outra@exemplo.test","email_verified":true,"full_name":"Outra"}');
create table public.licenses(id uuid primary key default gen_random_uuid(),user_id uuid unique references auth.users(id),status text);insert into public.licenses(user_id,status) values('${A}','active');alter table public.licenses enable row level security;revoke all on public.licenses from public,anon,authenticated;grant select on public.licenses to authenticated;grant all on public.licenses to service_role;create policy own_license on public.licenses for select to authenticated using(user_id=(select auth.uid()));
create schema access_private;create table access_private.cakto_events(id int primary key,value text);insert into access_private.cakto_events values(1,'synthetic preserved');`;
await db.exec(setup);
await db.exec(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
await acting('service_role');
const personal = (await rpc(A, 'list'))[0];
check(personal.kind, 'personal');
check(await rpc(B, 'list'), []);
const shared = await rpc(A, 'create', { name: 'Nossa casa' });
await rpc(A, 'invite', {
  workspace_id: shared.id,
  email: 'parceiro@exemplo.test',
  token_hash: 'a'.repeat(64),
});
await rejects(() => rpc(C, 'accept', { token_hash: 'a'.repeat(64) }), '42501');
await rpc(B, 'accept', { token_hash: 'a'.repeat(64) });
check((await rpc(B, 'list')).length, 1);
await rejects(() => rpc(B, 'accept', { token_hash: 'a'.repeat(64) }), '42501');
await rejects(() => rpc(A, 'create', { name: 'Outra' }), '23505');
await rejects(
  () =>
    rpc(B, 'invite', {
      workspace_id: shared.id,
      email: 'outra@exemplo.test',
      token_hash: 'b'.repeat(64),
    }),
  '42501',
);
const op = (changes, guards = []) => ({ id: crypto.randomUUID(), generation: 1, changes, guards });
const change = (entity, id, body, version = 0) => ({
  entity,
  id,
  body: { id, ...body },
  expected_version: version,
});
let operation = op([
  change('finance_categories', 'D01', { name: 'Moradia', kind: 'expense' }),
  change('finance_payment_methods', 'P2', { name: 'Pix' }),
  change('finance_entries', 'e', {
    source: 'manual',
    kind: 'expense',
    name: 'Conta',
    competence_month: '2026-11-01',
    reference_date: '2026-11-09',
    planned_amount_cents: 10000,
    category_id: 'D01',
    payment_method_id: 'P2',
  }),
]);
let result = await rpc(A, 'apply', { workspace_id: shared.id, operation });
check(result.revision, 1);
check(await rpc(A, 'apply', { workspace_id: shared.id, operation }), result);
await rejects(() => rpc(C, 'pull', { workspace_id: shared.id }), '42501');
await acting('authenticated', B);
check((await q('select count(*)::int as n from public.finance_entries')).rows[0].n, 1);
check((await q('select count(*)::int as n from public.finance_entry_totals')).rows[0].n, 1);
await rejects(
  () =>
    q(
      "insert into public.finance_categories(workspace_id,id,name,kind) values($1,'hacked','Hacked','expense')",
      [shared.id],
    ),
  '42501',
);
await rejects(() => q("select public.workspace_command($1::uuid,'list','{}')", [A]), '42501');
await acting('authenticated', C);
check((await q('select count(*)::int as n from public.finance_entries')).rows[0].n, 0);
await acting('anon');
await rejects(() => q('select * from public.finance_entry_totals'), '42501');
await acting('service_role');
operation = op(
  [
    change('finance_payments', 'pay', {
      entry_id: 'e',
      payment_date: '2026-12-05',
      amount_cents: 6000,
      sequence_no: 0,
    }),
  ],
  [{ entity: 'finance_entries', id: 'e', expected_version: 1 }],
);
result = await rpc(B, 'apply', { workspace_id: shared.id, operation });
check(result.revision, 2);
await acting('authenticated', A);
let total = (
  await q(
    'select paid_cents::int,pending_cents::int,expected_cents::int,competence_month::text from public.finance_entry_totals',
  )
).rows[0];
check(total, {
  paid_cents: 6000,
  pending_cents: 4000,
  expected_cents: 10000,
  competence_month: '2026-11-01',
});
await acting('service_role');
await rejects(
  () =>
    rpc(A, 'apply', {
      workspace_id: shared.id,
      operation: op(
        [
          change('finance_payments', 'duplicate', {
            entry_id: 'e',
            payment_date: '2026-12-05',
            amount_cents: 10000,
            sequence_no: 1,
          }),
        ],
        [{ entity: 'finance_entries', id: 'e', expected_version: 1 }],
      ),
    }),
  '40001',
);
result = await rpc(A, 'apply', {
  workspace_id: shared.id,
  operation: op(
    [
      change('finance_payments', 'rest', {
        entry_id: 'e',
        payment_date: '2026-12-06',
        amount_cents: 4000,
        sequence_no: 1,
      }),
    ],
    [{ entity: 'finance_entries', id: 'e', expected_version: 2 }],
  ),
});
check(result.revision, 3);
await acting('authenticated', B);
check((await q('select pending_cents::int as n from public.finance_entry_totals')).rows[0].n, 0);
await acting('service_role');
const pull = await rpc(B, 'pull', { workspace_id: shared.id, cursor: 0 });
check(pull.revision, 3);
check(pull.batches.length, 3);
check((await rpc(B, 'access', { workspace_id: shared.id })).generation, 1);
await rpc(A, 'remove', { workspace_id: shared.id, user_id: B });
await rejects(() => rpc(B, 'pull', { workspace_id: shared.id }), '42501');
await acting('authenticated', B);
check((await q('select count(*)::int as n from public.finance_entries')).rows[0].n, 0);
await acting('service_role');
await rpc(A, 'invite', {
  workspace_id: shared.id,
  email: 'parceiro@exemplo.test',
  token_hash: 'c'.repeat(64),
});
await rpc(B, 'accept', { token_hash: 'c'.repeat(64) });
check((await rpc(B, 'access', { workspace_id: shared.id })).generation, 3);
await rejects(
  () =>
    rpc(B, 'apply', {
      workspace_id: shared.id,
      operation: op([change('finance_goals', 'g', { name: 'Meta', target_cents: 10000 })]),
    }),
  '42501',
);
await acting('postgres');
await q("update public.licenses set status='revoked' where user_id=$1", [A]);
await acting('service_role');
check((await rpc(B, 'access', { workspace_id: shared.id })).writable, false);
await rejects(
  () =>
    rpc(B, 'apply', {
      workspace_id: shared.id,
      operation: {
        ...op([change('finance_goals', 'g', { name: 'Meta', target_cents: 10000 })]),
        generation: 3,
      },
    }),
  '42501',
);
check((await rpc(B, 'pull', { workspace_id: shared.id })).revision, 3);
await rpc(B, 'leave', { workspace_id: shared.id });
await acting('postgres');
check((await q('select count(*)::int as n from access_private.cakto_events')).rows[0].n, 1);
check(
  (
    await q(
      "select count(*)::int as n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prosecdef and n.nspname='workspace_private'",
    )
  ).rows[0].n,
  1,
);
const version = (await q('select version() as version')).rows[0].version;
const report = {
  status: 'passed',
  checks,
  engine: version,
  scope: 'isolated synthetic identities; production unchanged',
};
console.log(JSON.stringify(report, null, 2));
if (process.env.REPORT_PATH)
  await writeFile(process.env.REPORT_PATH, JSON.stringify(report, null, 2));
await db.close();
