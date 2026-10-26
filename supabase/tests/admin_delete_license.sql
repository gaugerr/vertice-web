begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users(id,email,email_confirmed_at) values
 ('90000000-0000-4000-8000-000000000001','delete-owner@example.test',now()),
 ('90000000-0000-4000-8000-000000000002','delete-buyer@example.test',now()),
 ('90000000-0000-4000-8000-000000000003','delete-other@example.test',now()),
 ('90000000-0000-4000-8000-000000000004','delete-admin@example.test',now()),
 ('90000000-0000-4000-8000-000000000005','delete-unverified@example.test',now());
insert into auth.identities(provider_id,user_id,identity_data,provider) values
 ('delete-owner','90000000-0000-4000-8000-000000000001','{"email":"delete-owner@example.test","email_verified":true}','google'),
 ('delete-buyer','90000000-0000-4000-8000-000000000002','{"email":"delete-buyer@example.test","email_verified":true}','google'),
 ('delete-other','90000000-0000-4000-8000-000000000003','{"email":"delete-other@example.test","email_verified":true}','google'),
 ('delete-admin','90000000-0000-4000-8000-000000000004','{"email":"delete-admin@example.test","email_verified":true}','google'),
 ('delete-unverified','90000000-0000-4000-8000-000000000005','{"email":"delete-unverified@example.test","email_verified":false}','google');
insert into access_private.admins(user_id) values
 ('90000000-0000-4000-8000-000000000001'),('90000000-0000-4000-8000-000000000004'),('90000000-0000-4000-8000-000000000005');

select ok(not has_function_privilege('anon','public.access_admin_delete_license(uuid,jsonb)','execute'),'anonymous users cannot delete');
select ok(not has_function_privilege('authenticated','public.access_admin_delete_license(uuid,jsonb)','execute'),'customers cannot invoke deletion directly');
select ok(has_function_privilege('service_role','public.access_admin_delete_license(uuid,jsonb)','execute'),'server can invoke deletion');
select ok(not (select prosecdef from pg_proc where oid='public.access_admin_delete_license(uuid,jsonb)'::regprocedure),'deletion uses invoker rights');

set local role service_role;
select public.access_admin('90000000-0000-4000-8000-000000000001','{"action":"grant","email":"delete-owner@example.test"}');
select public.access_license_check('90000000-0000-4000-8000-000000000001');
select public.access_admin('90000000-0000-4000-8000-000000000001','{"action":"grant","email":"delete-admin@example.test"}');
select public.access_admin('90000000-0000-4000-8000-000000000001','{"action":"grant","email":"delete-buyer@example.test"}');
select public.access_license_check('90000000-0000-4000-8000-000000000002');
select public.access_admin('90000000-0000-4000-8000-000000000001','{"action":"grant","email":"delete-other@example.test"}');
reset role;
create temporary table delete_fixture as select id,email,to_jsonb(l) as snapshot from public.licenses l where email like 'delete-%@example.test';
grant select on delete_fixture to service_role;

set local role service_role;
select throws_ok(format('select public.access_admin_delete_license(%L,%L::jsonb)',
  '90000000-0000-4000-8000-000000000003',jsonb_build_object('action','delete','id',(select id from delete_fixture where email='delete-buyer@example.test'),'confirmEmail','delete-buyer@example.test')::text),
  '42501','Administrator required','customer cannot delete even through a server request');
select throws_ok(format('select public.access_admin_delete_license(%L,%L::jsonb)',
  '90000000-0000-4000-8000-000000000005',jsonb_build_object('action','delete','id',(select id from delete_fixture where email='delete-buyer@example.test'),'confirmEmail','delete-buyer@example.test')::text),
  '28000','Verified Google identity required','admin membership requires verified Google identity');
select throws_ok(format('select public.access_admin_delete_license(%L,%L::jsonb)',
  '90000000-0000-4000-8000-000000000001',jsonb_build_object('action','delete','id',(select id from delete_fixture where email='delete-buyer@example.test'),'confirmEmail','wrong@example.test')::text),
  '22023','Exact email confirmation required','wrong confirmation never deletes a license');
select throws_ok(format('select public.access_admin_delete_license(%L,%L::jsonb)',
  '90000000-0000-4000-8000-000000000001',jsonb_build_object('action','delete','id',(select id from delete_fixture where email='delete-owner@example.test'),'confirmEmail','delete-owner@example.test')::text),
  '42501','Administrator licenses cannot be deleted','own bound admin license is protected');
select throws_ok(format('select public.access_admin_delete_license(%L,%L::jsonb)',
  '90000000-0000-4000-8000-000000000001',jsonb_build_object('action','delete','id',(select id from delete_fixture where email='delete-admin@example.test'),'confirmEmail','delete-admin@example.test')::text),
  '42501','Administrator licenses cannot be deleted','another admin is protected before first license claim');
select is((select to_jsonb(l) from public.licenses l where email='delete-buyer@example.test'),
  (select snapshot from delete_fixture where email='delete-buyer@example.test'),'denied deletions leave the license unchanged');
select is(public.access_admin_delete_license('90000000-0000-4000-8000-000000000001',
  jsonb_build_object('action','delete','id',(select id from delete_fixture where email='delete-buyer@example.test'),'confirmEmail','delete-buyer@example.test')),
  '{"deleted":true}'::jsonb,'admin deletes the confirmed license');
select is((select count(*)::integer from public.licenses where email='delete-buyer@example.test'),0,'only the target license is removed');
select is(public.access_license_check('90000000-0000-4000-8000-000000000002')->>'status','absent','existing Google account has no access after deletion');
select is((select count(*)::integer from access_private.audit where before_value->>'email'='delete-buyer@example.test' or after_value->>'email'='delete-buyer@example.test'),3,'grant, claim and deletion history remain');
select is((select count(*)::integer from access_private.audit where action='delete' and license_id is null and before_value->>'email'='delete-buyer@example.test'),1,'deletion is audited without retaining a license FK');
select is((select to_jsonb(l) from public.licenses l where email='delete-other@example.test'),
  (select snapshot from delete_fixture where email='delete-other@example.test'),'other customer is unchanged');
select throws_ok(format('select public.access_admin_delete_license(%L,%L::jsonb)',
  '90000000-0000-4000-8000-000000000001',jsonb_build_object('action','delete','id',(select id from delete_fixture where email='delete-buyer@example.test'),'confirmEmail','delete-buyer@example.test')::text),
  '22023','License not found','stale repeated deletion does not touch a different license');
reset role;
select is((select count(*)::integer from auth.users where id='90000000-0000-4000-8000-000000000002'),1,'Auth account remains');
select is((select count(*)::integer from auth.identities where user_id='90000000-0000-4000-8000-000000000002'),1,'Google identity remains');

insert into access_private.cakto_products(product_id,processing_enabled) values('delete-fixture-product',true);
set local role service_role;
select public.cakto_capture_events('[{"event_key":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","event_name":"purchase_approved","order_id":"delete-fixture-order","product_id":"delete-fixture-product","customer_email":"delete-buyer@example.test","order_status":"paid","created_at_source":"2026-10-26T12:00:00Z","paid_at":"2026-10-26T12:01:00Z"}]');
select public.cakto_process_pending(true,20);
select public.access_license_check('90000000-0000-4000-8000-000000000002');
select public.access_admin_delete_license('90000000-0000-4000-8000-000000000001',
  jsonb_build_object('action','delete','id',(select id from public.licenses where email='delete-buyer@example.test'),'confirmEmail','delete-buyer@example.test'));
select is((select count(*)::integer from public.licenses where email='delete-buyer@example.test'),0,'automatic license can also be deleted');
select is((select count(*)::integer from access_private.cakto_events where order_id='delete-fixture-order'),1,'Cakto event remains');
select is((select state from access_private.cakto_orders where order_id='delete-fixture-order'),'paid','Cakto purchase remains unchanged');
select is((select count(*)::integer from access_private.cakto_license_changes where order_id='delete-fixture-order' and license_id is null),1,'Cakto history remains without blocking deletion');
select public.cakto_process_pending(true,20);
select is((select count(*)::integer from public.licenses where email='delete-buyer@example.test'),0,'already applied events are not immediately reprocessed');
select public.access_admin('90000000-0000-4000-8000-000000000001','{"action":"grant","email":"delete-buyer@example.test"}');
select is(public.access_license_check('90000000-0000-4000-8000-000000000002')->>'status','active','new manual license reuses the original Google account');
select is((select user_id::text from public.licenses where email='delete-buyer@example.test'),'90000000-0000-4000-8000-000000000002','UID used for local data is preserved');
reset role;

create function pg_temp.reject_license_delete() returns trigger language plpgsql as $$
begin raise exception 'Simulated deletion failure'; end $$;
create trigger delete_rollback_fixture before delete on public.licenses
  for each row execute function pg_temp.reject_license_delete();
create temporary table delete_audit_count as select count(*) as total from access_private.audit;
grant select on delete_audit_count to service_role;
set local role service_role;
select throws_ok(format('select public.access_admin_delete_license(%L,%L::jsonb)',
  '90000000-0000-4000-8000-000000000001',jsonb_build_object('action','delete','id',(select id from public.licenses where email='delete-buyer@example.test'),'confirmEmail','delete-buyer@example.test')::text),
  'P0001','Simulated deletion failure','a failure aborts the whole deletion');
select is((select count(*) from access_private.audit),(select total from delete_audit_count),'failed deletion does not commit a false audit entry');
select is((select count(*)::integer from public.licenses where email='delete-buyer@example.test'),1,'failed deletion preserves the license');
reset role;
select * from finish();
rollback;
