begin;
create extension if not exists pgtap with schema extensions;
select plan(54);

create function pg_temp.cakto_event(order_ref text, buyer text,
  kind text default 'purchase_approved', status_value text default 'paid', salt text default '')
returns jsonb language sql as $$
  select jsonb_build_object(
    'event_key',md5(order_ref||buyer||kind||status_value||salt)||md5(salt||status_value||kind||buyer||order_ref),
    'event_name',kind,'order_id',order_ref,'product_id','processing-fixture-product',
    'offer_id',null,'customer_email',buyer,'order_status',status_value,
    'created_at_source','2026-10-25T12:00:00Z',
    'paid_at',case when status_value='paid' then '2026-10-25T12:01:00Z' else null end,
    'refunded_at',case when status_value='refunded' then '2026-10-25T13:00:00Z' else null end,
    'chargedback_at',null
  );
$$;
create function pg_temp.deliver(order_ref text, buyer text,
  kind text default 'purchase_approved', status_value text default 'paid', salt text default '')
returns jsonb language plpgsql as $$
begin
  perform public.cakto_capture_events(jsonb_build_array(pg_temp.cakto_event(order_ref,buyer,kind,status_value,salt)));
  return public.cakto_process_pending(true,50);
end $$;

insert into auth.users(id,email,email_confirmed_at) values
 ('10000000-0000-4000-8000-000000000001','processing-owner@example.test',now()),
 ('10000000-0000-4000-8000-000000000002','processing-buyer@example.test',now());
insert into auth.identities(provider_id,user_id,identity_data,provider) values
 ('processing-owner','10000000-0000-4000-8000-000000000001','{"email":"processing-owner@example.test","email_verified":true,"sub":"processing-owner"}','google'),
 ('processing-buyer','10000000-0000-4000-8000-000000000002','{"email":"processing-buyer@example.test","email_verified":true,"sub":"processing-buyer"}','google');
insert into access_private.admins(user_id) values('10000000-0000-4000-8000-000000000001');
insert into public.licenses(email,status) values
 ('processing-manual@example.test','active'),('processing-manual-blocked@example.test','revoked');
insert into access_private.cakto_products(product_id) values('processing-fixture-product');

select ok(not has_function_privilege('anon','public.cakto_process_pending(boolean,integer)','execute'),'anonymous cannot process licenses');
select ok(not has_function_privilege('authenticated','public.cakto_process_pending(boolean,integer)','execute'),'customer cannot process licenses');
select ok(not has_function_privilege('authenticated','access_private.cakto_sync_license(text,text)','execute'),'customer cannot invoke internal license sync');
select ok(not has_table_privilege('authenticated','public.licenses','update'),'customer cannot change source or override');
select ok(not (select processing_enabled from access_private.cakto_products where product_id='988379d3-cbaa-465f-930b-14aa7d48422e'),'real product starts disabled');

set local role service_role;
select is(public.cakto_process_pending(),'{"enabled":false}'::jsonb,'processing is opt-in');
select public.cakto_capture_events(jsonb_build_array(pg_temp.cakto_event('processing-one','processing-buyer@example.test')));
select is(public.cakto_process_pending(true,50)->>'processed','0','disabled product cannot grant');
select is((select count(*)::integer from public.licenses where email='processing-buyer@example.test'),0,'disabled product left no license');
update access_private.cakto_products set processing_enabled=true where product_id='processing-fixture-product';
select is(public.cakto_process_pending(true,50)->>'processed','1','approval is processed');
select is((select status from public.licenses where email='processing-buyer@example.test'),'active','paid order grants access');
select is((select provisioning_source from public.licenses where email='processing-buyer@example.test'),'cakto','automatic source is recorded');
select is((select user_id from public.licenses where email='processing-buyer@example.test'),null::uuid,'grant exists before signup');
select is(public.access_license_check('10000000-0000-4000-8000-000000000002')->>'status','active','existing verified Google login claims automatic license');
select is((select user_id::text from public.licenses where email='processing-buyer@example.test'),'10000000-0000-4000-8000-000000000002','license uses actual Google UID');

select pg_temp.deliver('processing-one','processing-buyer@example.test');
select is((select version from public.licenses where email='processing-buyer@example.test'),1,'duplicate does not change version');
select is((select count(*)::integer from access_private.cakto_license_changes),1,'duplicate creates no extra grant audit');
select pg_temp.deliver('processing-two','processing-buyer@example.test');
select pg_temp.deliver('processing-one','processing-buyer@example.test','refund','refunded');
select is((select status from public.licenses where email='processing-buyer@example.test'),'active','another paid order preserves access after refund');
select pg_temp.deliver('processing-two','processing-buyer@example.test','refund','refunded');
select is((select status from public.licenses where email='processing-buyer@example.test'),'revoked','last refund revokes automatic access');
select is((select version from public.licenses where email='processing-buyer@example.test'),2,'automatic revocation invalidates online lease version');
select pg_temp.deliver('processing-one','processing-buyer@example.test','purchase_approved','paid','late-delivery');
select is((select status from public.licenses where email='processing-buyer@example.test'),'revoked','late approval cannot undo a refund');
select pg_temp.deliver('processing-three','processing-buyer@example.test');
select is((select status from public.licenses where email='processing-buyer@example.test'),'active','new valid order can restore access');
select is((select version from public.licenses where email='processing-buyer@example.test'),3,'restoration increments version once');

select public.access_admin('10000000-0000-4000-8000-000000000001',jsonb_build_object('action','revoke','id',(select id from public.licenses where email='processing-buyer@example.test')));
select pg_temp.deliver('processing-four','processing-buyer@example.test');
select is((select status from public.licenses where email='processing-buyer@example.test'),'revoked','admin block wins over another purchase');
select is((select manual_override from public.licenses where email='processing-buyer@example.test'),'deny','admin block is explicit');
select public.access_admin('10000000-0000-4000-8000-000000000001',jsonb_build_object('action','reactivate','id',(select id from public.licenses where email='processing-buyer@example.test')));
select pg_temp.deliver('processing-three','processing-buyer@example.test','refund','refunded');
select pg_temp.deliver('processing-four','processing-buyer@example.test','refund','refunded');
select is((select status from public.licenses where email='processing-buyer@example.test'),'active','explicit admin allowance survives refunds');
select is((select manual_override from public.licenses where email='processing-buyer@example.test'),'allow','manual allowance is explicit');
select ok(exists(select 1 from jsonb_array_elements(public.access_admin('10000000-0000-4000-8000-000000000001',jsonb_build_object('action','audit','id',(select id from public.licenses where email='processing-buyer@example.test')))->'events') e where e->>'action'='cakto_grant'),'admin history includes automatic actions');

select pg_temp.deliver('processing-manual-order','processing-manual@example.test');
select pg_temp.deliver('processing-manual-order','processing-manual@example.test','refund','refunded');
select is((select status from public.licenses where email='processing-manual@example.test'),'active','preexisting manual access is preserved');
select pg_temp.deliver('processing-blocked-order','processing-manual-blocked@example.test');
select is((select status from public.licenses where email='processing-manual-blocked@example.test'),'revoked','preexisting manual revocation is preserved');

select pg_temp.deliver('processing-refund-first','processing-late@example.test','refund','refunded');
select pg_temp.deliver('processing-refund-first','processing-late@example.test');
select is((select count(*)::integer from public.licenses where email='processing-late@example.test'),0,'refund before approval never grants');
select public.cakto_capture_events(jsonb_build_array(
  pg_temp.cakto_event('processing-backlog','processing-backlog@example.test'),
  pg_temp.cakto_event('processing-backlog','processing-backlog@example.test','refund','refunded')));
select public.cakto_process_pending(true,50);
select is((select count(*)::integer from public.licenses where email='processing-backlog@example.test'),0,'complete backlog is evaluated before granting');

select pg_temp.deliver('processing-med','processing-med@example.test');
select pg_temp.deliver('processing-med','processing-med@example.test','chargeback','MED');
select is((select status from public.licenses where email='processing-med@example.test'),'revoked','MED suspends automatic access');
select pg_temp.deliver('processing-med','processing-med@example.test','purchase_approved','paid','after-med');
select is((select status from public.licenses where email='processing-med@example.test'),'revoked','MED recovery needs explicit review');
select pg_temp.deliver('processing-pending','processing-unpaid@example.test','purchase_approved','waiting_payment');
select is((select count(*)::integer from public.licenses where email='processing-unpaid@example.test'),0,'pending payment never grants');
select is((select state from access_private.cakto_orders where order_id='processing-pending'),'review','contradictory status is reviewed');

select pg_temp.deliver('processing-conflict','processing-original@example.test');
select pg_temp.deliver('processing-conflict','processing-other@example.test');
select is((select state from access_private.cakto_orders where order_id='processing-conflict'),'review','conflicting identities require review');
select is((select count(*)::integer from public.licenses where email='processing-other@example.test'),0,'identity is not transferred');
select is((select status from public.licenses where email='processing-original@example.test'),'revoked','conflicting order no longer grants automatic access');
select is((select customer_email from access_private.cakto_orders where order_id='processing-conflict'),'processing-original@example.test','original order identity stays pinned');

-- Fail audit persistence after the license insert; everything must roll back together.
reset role;
create function pg_temp.fail_cakto_audit() returns trigger language plpgsql as $$
begin
  if new.order_id in ('processing-retry','processing-exhausted') then
    raise exception 'Simulated private error containing buyer email' using errcode='23514';
  end if;
  return new;
end $$;
create trigger processing_failure before insert on access_private.cakto_license_changes
  for each row execute function pg_temp.fail_cakto_audit();
set local role service_role;
select pg_temp.deliver('processing-retry','processing-retry@example.test');
select is((select count(*)::integer from public.licenses where email='processing-retry@example.test'),0,'failed audit rolls back license grant');
select is((select count(*)::integer from access_private.cakto_orders where order_id='processing-retry'),0,'failed audit rolls back order decision');
select is((select processing_status from access_private.cakto_events where order_id='processing-retry'),'failed','failed order stays recoverable');
select is((select processing_note from access_private.cakto_events where order_id='processing-retry'),'processing_failed','private SQL error text is not persisted');
select ok((select next_attempt_at>now() from access_private.cakto_events where order_id='processing-retry'),'retry is delayed');
select pg_temp.deliver('processing-exhausted','processing-exhausted@example.test');
do $$ begin
  for i in 1..4 loop
    update access_private.cakto_events set next_attempt_at=now() where order_id='processing-exhausted';
    perform public.cakto_process_pending(true,50);
  end loop;
end $$;
select is((select attempts from access_private.cakto_events where order_id='processing-exhausted'),5,'processing retries are bounded');
select is((select processing_status from access_private.cakto_events where order_id='processing-exhausted'),'review','exhausted retries require review');
select is((select next_attempt_at from access_private.cakto_events where order_id='processing-exhausted'),null::timestamptz,'exhausted retry has no timer');
reset role;
drop trigger processing_failure on access_private.cakto_license_changes;
set local role service_role;
update access_private.cakto_events set next_attempt_at=now() where order_id='processing-retry';
select public.cakto_process_pending(true,50);
select is((select status from public.licenses where email='processing-retry@example.test'),'active','retry recovers after failure is removed');
select is((select attempts from access_private.cakto_events where order_id='processing-retry'),2,'successful retry is counted');
select is((select count(*)::integer from access_private.cakto_license_changes a join public.licenses l on l.id=a.license_id where l.email='processing-retry@example.test'),1,'retry creates a single auditable grant');
select throws_ok($$select public.cakto_process_pending(true,0)$$,'22023','Invalid processing batch size','unbounded worker invocation is rejected');
select ok(not exists(select 1 from access_private.cakto_license_changes a join public.licenses l on l.id=a.license_id where l.provisioning_source='manual'),'automation never writes manual license history');
select is((select status from public.licenses where email='processing-manual@example.test'),'active','manual active license still unchanged after worker retries');
select is((select status from public.licenses where email='processing-manual-blocked@example.test'),'revoked','manual blocked license still unchanged after worker retries');
reset role;
select * from finish();
rollback;
