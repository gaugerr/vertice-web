import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const files = (await readdir(root)).filter((f) =>
  /^\d{14}_user_owned_shopping_finance.sql$/.test(f),
);
assert.equal(files.length, 1);
const db = new PGlite();
let checks = 0;
const A = '11111111-1111-4111-8111-111111111111',
  B = '22222222-2222-4222-8222-222222222222';
const LA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  LB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CA = 'aaaaaaaa-1111-4111-8111-111111111111',
  CB = 'bbbbbbbb-1111-4111-8111-111111111111';
const q = (sql, params = []) => db.query(sql, params);
async function equal(sql, expected) {
  const r = await q(sql);
  assert.equal(Object.values(r.rows[0])[0], expected, sql);
  checks++;
}
async function rejects(sql, code) {
  try {
    await q(sql);
    assert.fail('Expected rejection: ' + sql);
  } catch (e) {
    if (e.code === undefined) throw e;
    if (code) assert.equal(e.code, code, sql);
    checks++;
  }
}
async function as(uid) {
  await db.exec('reset role;set role authenticated;');
  await q("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
}
await db.exec(`
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to anon,authenticated,service_role;
grant execute on function auth.uid() to anon,authenticated,service_role;
insert into auth.users values('${A}'),('${B}');
create table public.licenses(id uuid primary key default gen_random_uuid(),user_id uuid unique references auth.users(id),status text not null,provisioning_source text not null default 'cakto');
insert into public.licenses(user_id,status) values('${A}','active'),('${B}','active');
alter table public.licenses enable row level security;
revoke all on public.licenses from public,anon,authenticated;
grant select on public.licenses to authenticated;
create policy own_license on public.licenses for select to authenticated using(user_id=(select auth.uid()));
create schema access_private;
create table access_private.cakto_events(id integer primary key,payload text);
insert into access_private.cakto_events values(1,'synthetic untouched fixture');
`);
const licenseBefore = await q('select * from public.licenses order by user_id');
const caktoBefore = await q('select * from access_private.cakto_events');
await db.exec(await readFile(new URL(files[0], root), 'utf8'));
assert.deepEqual(await q('select * from public.licenses order by user_id'), licenseBefore);
checks++;
assert.deepEqual(await q('select * from access_private.cakto_events'), caktoBefore);
checks++;
await equal(
  "select count(*)::int from pg_tables where schemaname='public' and tablename<>'licenses' and rowsecurity",
  15,
);
await equal(
  "select count(*)::int from pg_views where schemaname='public' and viewname in ('finance_entry_totals','finance_goal_totals')",
  2,
);
await as(A);
await q(
  `insert into public.shopping_lists(id,store_name,reference_date) values('${LA}','Lista A','2026-11-09')`,
);
await q(
  `insert into public.shopping_categories(id,shopping_list_id,title,position) values('${CA}','${LA}','Carnes',0)`,
);
await q(
  `insert into public.shopping_items(id,shopping_list_id,category_id,name,unit_price,quantity,unit) values(gen_random_uuid(),'${LA}','${CA}','Carne',0.335,3,'kg')`,
);
await equal('select line_total_cents::int from public.shopping_items', 101);
await as(B);
await q(
  `insert into public.shopping_lists(id,store_name,reference_date) values('${LB}','Lista B','2026-11-09')`,
);
await q(
  `insert into public.shopping_categories(id,shopping_list_id,title,position) values('${CB}','${LB}','Mercado',0)`,
);
await equal('select count(*)::int from public.shopping_lists', 1);
await equal(`select count(*)::int from public.shopping_lists where id='${LA}'`, 0);
await equal(
  `with changed as(update public.shopping_lists set store_name='Hacked' where id='${LA}' returning id) select count(*)::int from changed`,
  0,
);
await rejects(
  `insert into public.shopping_categories(user_id,id,shopping_list_id,title,position) values('${A}',gen_random_uuid(),'${LA}','Foreign',0)`,
);
await rejects(
  `insert into public.shopping_items(id,shopping_list_id,category_id,name,unit_price,quantity,unit) values(gen_random_uuid(),'${LB}','${CA}','Foreign category',1,1,'un')`,
  '23503',
);
await rejects(`update public.shopping_lists set user_id='${A}' where id='${LB}'`, '23514');
await rejects(`delete from public.shopping_lists where id='${LB}'`, '42501');
await db.exec('reset role;set role anon;');
await rejects('select * from public.shopping_lists', '42501');
await rejects('select * from public.finance_entry_totals', '42501');
for (const user of [A, B]) {
  await as(user);
  await q(
    "insert into public.finance_categories(id,name,kind) values('D01','Moradia','expense'),('R01','Salário','income')",
  );
  await q("insert into public.finance_payment_methods(id,name) values('P2','Pix')");
}
await as(A);
await q(
  "insert into public.finance_fixed_accounts(id,name,start_month) values('rent','Aluguel','2026-11-01')",
);
await q(
  "insert into public.finance_fixed_versions(id,fixed_account_id,effective_month,amount_cents,due_day,category_id,payment_method_id) values('rent:v1','rent','2026-11-01',10000,31,'D01','P2')",
);
await q(
  "insert into public.finance_entries(id,source,kind,name,competence_month,reference_date,planned_amount_cents,category_id,payment_method_id,fixed_account_id,fixed_version_id) values('rent:2026-11','fixed','expense','Aluguel','2026-11-01','2026-11-30',10000,'D01','P2','rent','rent:v1')",
);
await q(
  "insert into public.finance_payments(id,entry_id,payment_date,amount_cents) values('p1','rent:2026-11','2026-12-05',6000)",
);
await equal('select paid_cents::int from public.finance_entry_totals', 6000);
await equal('select pending_cents::int from public.finance_entry_totals', 4000);
await equal('select expected_cents::int from public.finance_entry_totals', 10000);
await equal(
  "select sum(paid_cents)::int from public.finance_entry_totals where competence_month='2026-11-01'",
  6000,
);
await equal(
  "select count(*)::int from public.finance_entry_totals where competence_month='2026-12-01'",
  0,
);
await rejects(
  "update public.finance_entries set planned_amount_cents=12000 where id='rent:2026-11'",
  '23514',
);
await q(
  "insert into public.finance_payments(id,entry_id,payment_date,amount_cents) values('p2','rent:2026-11','2026-12-06',4000)",
);
await equal('select pending_cents::int from public.finance_entry_totals', 0);
await equal('select is_settled from public.finance_entry_totals', true);
await q(
  "insert into public.finance_payments(id,entry_id,payment_date,movement_type,amount_cents) values('adjust','rent:2026-11','2026-12-07','adjustment',-5000)",
);
await equal('select pending_cents::int from public.finance_entry_totals', 5000);
await rejects(
  "insert into public.finance_payments(id,entry_id,payment_date,movement_type,amount_cents) values('bad','rent:2026-11','2026-12-07','adjustment',-9000)",
  '23514',
);
await equal('select paid_cents::int from public.finance_entry_totals', 5000);
await q("update public.finance_entries set settlement_discount_cents=5000 where id='rent:2026-11'");
await equal('select expected_cents::int from public.finance_entry_totals', 5000);
await equal('select pending_cents::int from public.finance_entry_totals', 0);
await as(B);
await equal('select count(*)::int from public.finance_entry_totals', 0);
await rejects(
  "insert into public.finance_payments(id,entry_id,payment_date,amount_cents) values('foreign','rent:2026-11','2026-11-09',10)",
  '23503',
);
await rejects(
  "insert into public.finance_entries(id,source,kind,name,competence_month,reference_date,planned_amount_cents,category_id) values('bad-kind','manual','income','Bad','2026-11-01','2026-11-09',100,'D01')",
  '23503',
);
await rejects("update public.finance_categories set kind='income' where id='D01'", '23514');
await as(A);
await rejects(
  "insert into public.finance_entries(id,source,kind,name,competence_month,reference_date,planned_amount_cents,category_id,payment_method_id,fixed_account_id,fixed_version_id) values('duplicate','fixed','expense','Aluguel','2026-11-01','2026-11-30',10000,'D01','P2','rent','rent:v1')",
  '23505',
);
await q(
  "insert into public.finance_goals(id,name,target_cents,opening_amount_cents) values('reserve','Reserva',100000,10000)",
);
await q(
  "insert into public.finance_goal_contributions(id,goal_id,contribution_date,amount_cents) values('c1','reserve','2026-11-09',5000)",
);
await equal('select current_cents::int from public.finance_goal_totals', 15000);
await q("update public.finance_goal_contributions set amount_cents=2500 where id='c1'");
await equal('select current_cents::int from public.finance_goal_totals', 12500);
await q("update public.finance_goal_contributions set deleted_at=now() where id='c1'");
await equal('select current_cents::int from public.finance_goal_totals', 10000);
await equal('select count(*)::int from public.finance_entries', 1);
await rejects(
  "insert into public.finance_goal_contributions(id,goal_id,contribution_date,amount_cents) values('big','reserve','2026-11-09',9999999999)",
  '23514',
);
await q(
  "insert into public.finance_budget_months(id,month) values('cccccccc-cccc-4ccc-8ccc-cccccccccccc','2026-11-01'),('dddddddd-dddd-4ddd-8ddd-dddddddddddd','2026-12-01')",
);
await q(
  "insert into public.finance_budget_limits(id,budget_month_id,category_id,limit_cents) values('nov','cccccccc-cccc-4ccc-8ccc-cccccccccccc','D01',0),('dec','dddddddd-dddd-4ddd-8ddd-dddddddddddd','D01',20000)",
);
await equal("select limit_cents::int from public.finance_budget_limits where id='nov'", 0);
await q("update public.finance_budget_limits set limit_cents=30000 where id='dec'");
await equal("select limit_cents::int from public.finance_budget_limits where id='nov'", 0);
await q(
  "insert into public.user_import_batches(source_kind,source_scope,source_sha256,imported_records) values('local_finance','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',repeat('a',64),3)",
);
await rejects(
  "insert into public.user_import_batches(source_kind,source_scope,source_sha256,imported_records) values('local_finance','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',repeat('a',64),3)",
  '23505',
);
const beforeVersion = await q(
  `select row_version,created_at from public.shopping_lists where id='${LA}'`,
);
await q(
  `update public.shopping_lists set description='Updated',row_version=999,created_at='1900-01-01' where id='${LA}'`,
);
const afterVersion = await q(
  `select row_version,created_at from public.shopping_lists where id='${LA}'`,
);
assert.equal(
  Number(afterVersion.rows[0].row_version),
  Number(beforeVersion.rows[0].row_version) + 1,
);
checks++;
assert.equal(afterVersion.rows[0].created_at.getTime(), beforeVersion.rows[0].created_at.getTime());
checks++;
await q(`update public.shopping_lists set deleted_at=now() where id='${LA}'`);
await equal(
  `select count(*)::int from public.shopping_lists where id='${LA}' and deleted_at is not null`,
  1,
);
await db.exec('reset role;');
await q(`update public.licenses set status='revoked' where user_id='${A}'`);
await as(A);
await equal('select count(*)::int from public.shopping_lists', 1);
await rejects(
  "insert into public.finance_goals(id,name,target_cents) values('blocked','Blocked',100)",
  '42501',
);
await equal(
  "with changed as(update public.finance_goals set name='Blocked' returning id) select count(*)::int from changed",
  0,
);
await db.exec('reset role;');
await equal(
  "select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='user_data_private' and p.prosecdef",
  0,
);
await equal(
  "select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v' and 'security_invoker=true'=any(c.reloptions)",
  2,
);
const version = (await q('select version() as version')).rows[0].version;
console.log(
  JSON.stringify(
    {
      status: 'passed',
      checks,
      engine: version,
      scope: 'isolated synthetic PostgreSQL; production not modified',
      migration: files[0],
    },
    null,
    2,
  ),
);
await db.close();
