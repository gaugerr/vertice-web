-- Generated migration destination is filled by `supabase migration new google_licenses`.
create schema if not exists access_private;
revoke all on schema access_private from public, anon, authenticated;
grant usage on schema access_private to service_role;
-- Server-only identity reads; no grant to browser roles.
grant select (id, email_confirmed_at) on auth.users to service_role;
grant select (user_id, provider, identity_data) on auth.identities to service_role;

create table public.licenses (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(btrim(email)) and length(email) between 3 and 254 and position('@' in email) > 1),
  user_id uuid unique references auth.users(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'revoked')),
  version integer not null default 1 check (version > 0),
  order_reference text check (length(order_reference) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.licenses enable row level security;
revoke all on public.licenses from anon, authenticated;
grant select on public.licenses to authenticated;
grant all on public.licenses to service_role;
create policy own_license on public.licenses for select to authenticated using (user_id = (select auth.uid()));
create index licenses_created_idx on public.licenses (created_at desc, id);

create table access_private.admins (
  user_id uuid primary key references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table access_private.audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id),
  license_id uuid not null references public.licenses(id),
  action text not null check (action in ('grant', 'revoke', 'reactivate', 'claim')),
  before_value jsonb,
  after_value jsonb not null,
  created_at timestamptz not null default now()
);
alter table access_private.admins enable row level security;
alter table access_private.audit enable row level security;
revoke all on all tables in schema access_private from public, anon, authenticated;
grant select on access_private.admins to service_role;
grant select, insert on access_private.audit to service_role;
grant usage on sequence access_private.audit_id_seq to service_role;

-- Only service_role can invoke these routines. The caller UID comes from auth.getUser
-- in the Edge Function; verified Google email is always read from auth.identities.
create function public.access_license_check(actor uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare verified_email text; account public.licenses; previous jsonb;
begin
  select lower(btrim(i.identity_data->>'email')) into verified_email
  from auth.identities i join auth.users u on u.id = i.user_id
  where i.user_id = actor and i.provider = 'google'
    and i.identity_data->>'email_verified' = 'true' and u.email_confirmed_at is not null
  limit 1;
  if verified_email is null then raise exception 'Verified Google identity required' using errcode = '28000'; end if;
  -- Serialize claims for this UID, including concurrent claims of different emails.
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 0));
  select * into account from public.licenses where user_id = actor for update;
  if not found then
    select * into account from public.licenses where email = verified_email for update;
    if not found or account.user_id is not null then return jsonb_build_object('status', 'absent'); end if;
    if account.status = 'active' then
      previous := to_jsonb(account);
      update public.licenses set user_id = actor, updated_at = now() where id = account.id returning * into account;
      insert into access_private.audit(actor_id, license_id, action, before_value, after_value)
      values (actor, account.id, 'claim', previous, to_jsonb(account));
    end if;
  end if;
  return jsonb_build_object('status', account.status, 'id', account.id, 'version', account.version,
    'email', verified_email, 'admin', exists(select 1 from access_private.admins where user_id = actor));
end $$;

create function public.access_admin(actor uuid, input jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare operation text := input->>'action'; account public.licenses; previous jsonb;
  normalized text; offset_rows integer; result jsonb;
begin
  if not exists(select 1 from access_private.admins where user_id = actor) then
    raise exception 'Administrator required' using errcode = '42501';
  end if;
  if not exists(select 1 from auth.identities where user_id = actor and provider = 'google'
    and identity_data->>'email_verified' = 'true') then
    raise exception 'Verified Google identity required' using errcode = '28000';
  end if;
  if operation = 'list' then
    normalized := lower(btrim(coalesce(input->>'search', '')));
    if length(normalized) > 254 then raise exception 'Invalid search'; end if;
    offset_rows := greatest(0, least(coalesce((input->>'page')::integer, 0), 100000)) * 20;
    select jsonb_build_object('licenses', coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb),
      'hasMore', count(*) > 20) into result from (
      select * from public.licenses where position(normalized in email) > 0
      order by created_at desc, id offset offset_rows limit 21
    ) l;
    return result;
  elsif operation = 'audit' then
    select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) into result from (
      select id, action, created_at from access_private.audit where license_id = (input->>'id')::uuid
      order by id desc limit 20
    ) a;
    return jsonb_build_object('events', result);
  elsif operation = 'grant' then
    normalized := lower(btrim(input->>'email'));
    if normalized is null or length(normalized) not between 3 and 254 or position('@' in normalized) < 2 then
      raise exception 'Invalid email';
    end if;
    insert into public.licenses(email, order_reference) values (normalized, nullif(btrim(input->>'orderReference'), ''))
      on conflict(email) do nothing returning * into account;
    if not found then raise exception 'Email already licensed; reactivate the existing license'; end if;
  elsif operation in ('revoke', 'reactivate') then
    select * into account from public.licenses where id = (input->>'id')::uuid for update;
    if not found then raise exception 'License not found'; end if;
    previous := to_jsonb(account);
    if account.status = (case when operation = 'revoke' then 'revoked' else 'active' end) then
      return jsonb_build_object('license', to_jsonb(account));
    end if;
    update public.licenses set status = case when operation = 'revoke' then 'revoked' else 'active' end,
      version = version + 1, updated_at = now() where id = account.id returning * into account;
  else raise exception 'Invalid operation'; end if;
  insert into access_private.audit(actor_id, license_id, action, before_value, after_value)
    values (actor, account.id, operation, previous, to_jsonb(account));
  return jsonb_build_object('license', to_jsonb(account));
end $$;
revoke all on function public.access_license_check(uuid) from public, anon, authenticated;
revoke all on function public.access_admin(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.access_license_check(uuid) to service_role;
grant execute on function public.access_admin(uuid, jsonb) to service_role;
