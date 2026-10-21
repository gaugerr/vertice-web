begin;
create extension if not exists pgtap with schema extensions;
select plan(16);
insert into auth.users(id, email, email_confirmed_at) values
 ('00000000-0000-4000-8000-000000000001','owner@example.test',now()),
 ('00000000-0000-4000-8000-000000000002','buyer@example.test',now()),
 ('00000000-0000-4000-8000-000000000003','other@example.test',now());
insert into auth.identities(provider_id,user_id,identity_data,provider) values
 ('owner-fixture','00000000-0000-4000-8000-000000000001','{"email":"owner@example.test","email_verified":true,"sub":"owner-fixture"}','google'),
 ('buyer-fixture','00000000-0000-4000-8000-000000000002','{"email":"Buyer@example.test","email_verified":true,"sub":"buyer-fixture"}','google'),
 ('other-fixture','00000000-0000-4000-8000-000000000003','{"email":"other@example.test","email_verified":true,"sub":"other-fixture"}','google');
insert into access_private.admins(user_id) values('00000000-0000-4000-8000-000000000001');
select ok(not has_function_privilege('anon','public.access_license_check(uuid)','execute'),'anon cannot claim through RPC');
select ok(not has_function_privilege('authenticated','public.access_admin(uuid,jsonb)','execute'),'customers cannot administer RPC');
select ok(not has_table_privilege('authenticated','public.licenses','insert'),'customers cannot grant licenses');
select ok(not has_schema_privilege('authenticated','access_private','usage'),'private audit/admin schema is inaccessible');
set local role service_role;
select is(public.access_license_check('00000000-0000-4000-8000-000000000002')->>'status','absent','unknown customer is not licensed');
select lives_ok($$select public.access_admin('00000000-0000-4000-8000-000000000001','{"action":"grant","email":" Buyer@example.test "}')$$,'admin grants normalized email');
select is(public.access_license_check('00000000-0000-4000-8000-000000000002')->>'status','active','verified Google email claims active license');
select is((select user_id::text from public.licenses where email='buyer@example.test'),'00000000-0000-4000-8000-000000000002','license bound to actual UID');
select throws_ok($$select public.access_admin('00000000-0000-4000-8000-000000000003','{"action":"list"}')$$,'42501','Administrator required','other customer cannot administer');
select lives_ok(format('select public.access_admin(%L,%L::jsonb)','00000000-0000-4000-8000-000000000001',jsonb_build_object('action','revoke','id',(select id from public.licenses where email='buyer@example.test'))::text),'admin revokes');
select is(public.access_license_check('00000000-0000-4000-8000-000000000002')->>'status','revoked','claim cannot undo revocation');
select is((select version from public.licenses where email='buyer@example.test'),2,'revocation increments version');
reset role;
select is((select count(*)::integer from access_private.audit),3,'grant, claim, revoke are audited transactionally');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select is((select count(*)::integer from public.licenses),0,'RLS hides another customer license');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select is((select count(*)::integer from public.licenses),1,'RLS exposes only linked own license');
reset role;
update auth.identities set identity_data=jsonb_set(identity_data,'{email}', '"buyer@example.test"') where user_id='00000000-0000-4000-8000-000000000003';
set local role service_role;
select is(public.access_license_check('00000000-0000-4000-8000-000000000003')->>'status','absent','bound license never reassigns by changed email');
reset role;
select * from finish();
rollback;
