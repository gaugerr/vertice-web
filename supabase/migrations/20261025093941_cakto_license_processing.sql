-- Existing licenses stay manual. Only newly created automatic licenses are managed by Cakto.
alter table public.licenses
  add column provisioning_source text not null default 'manual'
    check (provisioning_source in ('manual','cakto')),
  add column manual_override text check (manual_override in ('allow','deny'));

create table access_private.cakto_products (
  product_id text primary key check (product_id ~ '^[A-Za-z0-9_.-]{1,120}$'),
  processing_enabled boolean not null default false
);
insert into access_private.cakto_products(product_id)
  values ('988379d3-cbaa-465f-930b-14aa7d48422e');

create table access_private.cakto_orders (
  order_id text primary key,
  product_id text not null references access_private.cakto_products(product_id),
  customer_email text not null,
  state text not null check (state in ('paid','revoked','review')),
  decision text not null check (decision in ('payment_approved','terminal_event','identity_conflict','unsupported_status')),
  updated_at timestamptz not null default now()
);
create index cakto_orders_paid_email_idx on access_private.cakto_orders(customer_email)
  where state = 'paid';

create table access_private.cakto_license_changes (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.licenses(id) on delete restrict,
  order_id text not null references access_private.cakto_orders(order_id),
  action text not null check (action in ('cakto_grant','cakto_revoke','cakto_reactivate')),
  before_status text check (before_status in ('active','revoked')),
  after_status text not null check (after_status in ('active','revoked')),
  created_at timestamptz not null default now()
);
create index cakto_license_changes_license_idx on access_private.cakto_license_changes(license_id, created_at desc, id);

alter table access_private.cakto_products enable row level security;
alter table access_private.cakto_orders enable row level security;
alter table access_private.cakto_license_changes enable row level security;
revoke all on access_private.cakto_products, access_private.cakto_orders,
  access_private.cakto_license_changes from public, anon, authenticated;
grant select, insert, update on access_private.cakto_products,
  access_private.cakto_orders to service_role;
grant select, insert on access_private.cakto_license_changes to service_role;

alter table access_private.cakto_events
  add column processing_status text not null default 'pending'
    check (processing_status in ('pending','applied','review','failed')),
  add column processing_note text,
  add column attempts integer not null default 0 check (attempts between 0 and 5),
  add column next_attempt_at timestamptz default now(),
  add column processed_at timestamptz;
create index cakto_events_pending_idx on access_private.cakto_events(next_attempt_at, received_at)
  where processing_status in ('pending','failed');

-- Internal helper: manual grants and explicit owner decisions always take precedence.
create function access_private.cakto_sync_license(buyer_email text, trigger_order text)
returns void language plpgsql security invoker set search_path = '' as $$
declare account public.licenses; desired text; before_status text; automatic_action text;
begin
  desired := case when exists(select 1 from access_private.cakto_orders
    where customer_email = buyer_email and state = 'paid') then 'active' else 'revoked' end;
  if desired = 'active' then
    insert into public.licenses(email, provisioning_source, order_reference)
      values (buyer_email, 'cakto', trigger_order)
      on conflict(email) do nothing returning * into account;
    if found then
      insert into access_private.cakto_license_changes(license_id,order_id,action,after_status)
        values (account.id,trigger_order,'cakto_grant','active');
      return;
    end if;
  end if;
  select * into account from public.licenses where email = buyer_email for update;
  if not found or account.provisioning_source <> 'cakto' then return; end if;
  if account.manual_override is not null then return; end if;
  if account.status = desired then return; end if;
  before_status := account.status;
  automatic_action := case when desired = 'active' then 'cakto_reactivate' else 'cakto_revoke' end;
  update public.licenses set status = desired, version = version + 1, updated_at = now()
    where id = account.id;
  insert into access_private.cakto_license_changes(license_id,order_id,action,before_status,after_status)
    values(account.id,trigger_order,automatic_action,before_status,desired);
end $$;
revoke all on function access_private.cakto_sync_license(text,text) from public, anon, authenticated;
grant execute on function access_private.cakto_sync_license(text,text) to service_role;

-- Can be called immediately after capture or by a retry job. Both gates default to off.
create function public.cakto_process_pending(apply_changes boolean default false, batch_limit integer default 20)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  target record;
  previous access_private.cakto_orders;
  first_observation access_private.cakto_events;
  observed text[];
  work_keys text[];
  identities integer;
  products integer;
  terminal boolean;
  supported boolean;
  approved boolean;
  next_state text;
  note text;
  processed integer := 0;
  reviewed integer := 0;
  failed integer := 0;
begin
  if apply_changes is distinct from true then return jsonb_build_object('enabled',false); end if;
  if batch_limit is null or batch_limit not between 1 and 50 then
    raise exception 'Invalid processing batch size' using errcode = '22023';
  end if;
  -- One short worker transaction at a time. Other invocations leave the durable inbox intact.
  if not pg_try_advisory_xact_lock(hashtextextended('vertice-cakto-processor',0)) then
    return jsonb_build_object('busy',true);
  end if;
  for target in
    select e.order_id from access_private.cakto_events e
    join access_private.cakto_products p on p.product_id=e.product_id and p.processing_enabled
    where e.processing_status in ('pending','failed') and e.attempts < 5
      and e.next_attempt_at <= now()
    group by e.order_id order by min(e.received_at), e.order_id limit batch_limit
  loop
    select array_agg(event_key order by event_key) into observed
      from access_private.cakto_events where order_id=target.order_id;
    select array_agg(event_key order by event_key) into work_keys
      from access_private.cakto_events where event_key=any(observed)
      and processing_status in ('pending','failed') and attempts < 5 and next_attempt_at <= now();
    begin
      select * into previous from access_private.cakto_orders where order_id=target.order_id;
      select * into first_observation from access_private.cakto_events
        where event_key=any(observed) order by received_at,event_key limit 1;
      select count(distinct customer_email),count(distinct product_id),
        bool_or((event_name='refund' and order_status='refunded')
          or (event_name='chargeback' and lower(order_status) in ('chargedback','med'))
          or refunded_at is not null or chargedback_at is not null),
        bool_and((event_name='purchase_approved' and order_status='paid')
          or (event_name='refund' and order_status='refunded')
          or (event_name='chargeback' and lower(order_status) in ('chargedback','med'))),
        bool_or(event_name='purchase_approved' and order_status='paid')
      into identities,products,terminal,supported,approved
      from access_private.cakto_events where event_key=any(observed);
      if previous.state='revoked' or terminal then
        next_state := 'revoked'; note := 'terminal_event';
      elsif identities <> 1 or products <> 1 then
        next_state := 'review'; note := 'identity_conflict';
      elsif not supported or not approved then
        next_state := 'review'; note := 'unsupported_status';
      else
        next_state := 'paid'; note := 'payment_approved';
      end if;
      insert into access_private.cakto_orders(order_id,product_id,customer_email,state,decision)
        values (target.order_id,first_observation.product_id,first_observation.customer_email,next_state,note)
        on conflict(order_id) do update set state=excluded.state,decision=excluded.decision,updated_at=now();
      -- Identity is pinned on first processing. Never silently transfer access to a different email.
      perform access_private.cakto_sync_license(
        coalesce(previous.customer_email,first_observation.customer_email),target.order_id);
      update access_private.cakto_events set
        processing_status=case when next_state='review' then 'review' else 'applied' end,
        processing_note=note, attempts=attempts+1, processed_at=now(),next_attempt_at=null
        where event_key=any(work_keys);
      if next_state='review' then reviewed := reviewed+1; else processed := processed+1; end if;
    exception when others then
      -- This block rolls back order, license and audit together. Never persist SQLERRM (PII).
      update access_private.cakto_events set attempts=attempts+1,
        processing_status=case when attempts+1 >= 5 then 'review' else 'failed' end,
        processing_note=case when attempts+1 >= 5 then 'retry_exhausted' else 'processing_failed' end,
        next_attempt_at=case when attempts+1 >= 5 then null
          else now()+interval '1 minute'*power(2,attempts) end
        where event_key=any(work_keys);
      failed := failed+1;
    end;
  end loop;
  return jsonb_build_object('processed',processed,'reviewed',reviewed,'failed',failed);
end $$;
revoke all on function public.cakto_process_pending(boolean,integer) from public, anon, authenticated;
grant execute on function public.cakto_process_pending(boolean,integer) to service_role;

-- Keep the existing admin identity checks; manual decisions are explicit overrides.
create or replace function public.access_admin(actor uuid, input jsonb) returns jsonb
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
      select * from (
        select 'manual-' || id::text as id, action, created_at from access_private.audit
          where license_id = (input->>'id')::uuid
        union all
        select 'cakto-' || id::text as id, action, created_at from access_private.cakto_license_changes
          where license_id = (input->>'id')::uuid
      ) history order by created_at desc, id desc limit 20
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
    if account.status = (case when operation = 'revoke' then 'revoked' else 'active' end)
      and account.manual_override is not distinct from (case when operation = 'revoke' then 'deny' else 'allow' end) then
      return jsonb_build_object('license', to_jsonb(account));
    end if;
    update public.licenses set status = case when operation = 'revoke' then 'revoked' else 'active' end,
      manual_override = case when operation = 'revoke' then 'deny' else 'allow' end,
      version = version + case when status <> (case when operation = 'revoke' then 'revoked' else 'active' end) then 1 else 0 end,
      updated_at = now() where id = account.id returning * into account;
  else raise exception 'Invalid operation'; end if;
  insert into access_private.audit(actor_id, license_id, action, before_value, after_value)
    values (actor, account.id, operation, previous, to_jsonb(account));
  return jsonb_build_object('license', to_jsonb(account));
end $$;
