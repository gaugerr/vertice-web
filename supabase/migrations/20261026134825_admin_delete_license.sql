-- Keep administrative and Cakto history when only the license is deleted.
alter table access_private.audit alter column license_id drop not null;
alter table access_private.audit drop constraint audit_license_id_fkey;
alter table access_private.audit add constraint audit_license_id_fkey
  foreign key (license_id) references public.licenses(id) on delete set null;
alter table access_private.audit drop constraint audit_action_check;
alter table access_private.audit add constraint audit_action_check
  check (action in ('grant', 'revoke', 'reactivate', 'claim', 'delete'));
alter table access_private.cakto_license_changes alter column license_id drop not null;
alter table access_private.cakto_license_changes drop constraint cakto_license_changes_license_id_fkey;
alter table access_private.cakto_license_changes add constraint cakto_license_changes_license_id_fkey
  foreign key (license_id) references public.licenses(id) on delete set null;

create function public.access_admin_delete_license(actor uuid, input jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare account public.licenses;
begin
  if not exists(select 1 from access_private.admins where user_id = actor) then
    raise exception 'Administrator required' using errcode = '42501';
  end if;
  if not exists(select 1 from auth.identities i join auth.users u on u.id = i.user_id
    where i.user_id = actor and i.provider = 'google'
      and i.identity_data->>'email_verified' = 'true' and u.email_confirmed_at is not null) then
    raise exception 'Verified Google identity required' using errcode = '28000';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('vertice-cakto-processor', 0));
  select * into account from public.licenses where id = (input->>'id')::uuid for update;
  if not found then raise exception 'License not found' using errcode = '22023'; end if;
  if input->>'action' is distinct from 'delete'
    or input->>'confirmEmail' is distinct from account.email then
    raise exception 'Exact email confirmation required' using errcode = '22023';
  end if;
  if exists(select 1 from access_private.admins a where a.user_id = account.user_id)
    or exists(select 1 from access_private.admins a join auth.identities i on i.user_id = a.user_id
      where i.provider = 'google' and i.identity_data->>'email_verified' = 'true'
        and lower(btrim(i.identity_data->>'email')) = account.email) then
    raise exception 'Administrator licenses cannot be deleted' using errcode = '42501';
  end if;
  insert into access_private.audit(actor_id, license_id, action, before_value, after_value)
    values (actor, account.id, 'delete', to_jsonb(account), '{"deleted":true}'::jsonb);
  delete from public.licenses where id = account.id;
  return jsonb_build_object('deleted', true);
end $$;
revoke all on function public.access_admin_delete_license(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.access_admin_delete_license(uuid,jsonb) to service_role;
