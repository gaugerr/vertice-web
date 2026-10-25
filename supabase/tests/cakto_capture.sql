begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into public.licenses(email, status) values
  ('capture-existing@example.test', 'active'), ('capture-revoked@example.test', 'revoked');
create temporary table capture_fixture as select jsonb_build_object(
  'event_key', repeat('a',64), 'event_name', 'purchase_approved',
  'order_id', 'capture-fixture-order', 'product_id', 'capture-fixture-product',
  'offer_id', null, 'customer_email', 'capture-buyer@example.test', 'order_status', 'paid',
  'created_at_source', '2026-10-25T12:00:00Z', 'paid_at', null,
  'refunded_at', null, 'chargedback_at', null
) as event;
grant select on capture_fixture to service_role;

select ok(not has_function_privilege('anon','public.cakto_capture_events(jsonb)','execute'),'anonymous caller cannot capture');
select ok(not has_function_privilege('authenticated','public.cakto_capture_events(jsonb)','execute'),'customer cannot capture');
select ok(has_function_privilege('service_role','public.cakto_capture_events(jsonb)','execute'),'server can capture');
select ok(not has_table_privilege('anon','access_private.cakto_events','select'),'inbox is hidden from anonymous callers');
select ok(not has_table_privilege('authenticated','access_private.cakto_events','insert'),'customers cannot forge inbox entries');
select ok((select relrowsecurity from pg_class where oid='access_private.cakto_events'::regclass),'inbox has RLS');
select ok(not (select prosecdef from pg_proc where oid='public.cakto_capture_events(jsonb)'::regprocedure),'capture uses invoker rights');

set local role service_role;
select is(public.cakto_capture_events((select jsonb_build_array(event) from capture_fixture)),
  '{"inserted":1,"duplicates":0}'::jsonb,'first delivery is inserted');
select is(public.cakto_capture_events((select jsonb_build_array(event) from capture_fixture)),
  '{"inserted":0,"duplicates":1}'::jsonb,'repeated delivery is deduplicated');
select is((select seen_count::integer from access_private.cakto_events where event_key=repeat('a',64)),2,'duplicate is counted');
select is(public.cakto_capture_events((select jsonb_build_array(event || jsonb_build_object(
  'event_key',repeat('b',64),'event_name','refund','order_status','refunded')) from capture_fixture)),
  '{"inserted":1,"duplicates":0}'::jsonb,'refund for same order is a separate observation');
select is((select count(*)::integer from access_private.cakto_events),2,'both lifecycle observations are retained');
select throws_ok($$select public.cakto_capture_events((select jsonb_build_array(event || '{"secret":"do-not-store"}'::jsonb) from capture_fixture))$$,
  '22023','Unexpected capture field','additional raw fields cannot be stored');
select throws_ok($$select public.cakto_capture_events('[]'::jsonb)$$,
  '22023','Invalid capture batch','empty batches are rejected');
select throws_ok($$select public.cakto_capture_events((select jsonb_build_array(
  event || jsonb_build_object('event_key',repeat('c',64)),
  event || jsonb_build_object('event_key',repeat('d',64),'customer_email','invalid')
) from capture_fixture))$$,'23514',null,'invalid member rolls back the entire batch');
select is((select count(*)::integer from access_private.cakto_events),2,'failed batch left no partial capture');
select is((select count(*)::integer from public.licenses where email like 'capture-%@example.test'),2,'capture did not create a license');
select is((select status from public.licenses where email='capture-revoked@example.test'),'revoked','capture did not reactivate a revoked license');
reset role;
select * from finish();
rollback;
