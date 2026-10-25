-- Passive inbox only. No trigger or routine in this migration writes to licenses.
create table access_private.cakto_events (
  event_key text primary key check (event_key ~ '^[a-f0-9]{64}$'),
  event_name text not null check (event_name in ('purchase_approved', 'refund', 'chargeback')),
  order_id text not null check (order_id ~ '^[A-Za-z0-9_.-]{1,120}$'),
  product_id text not null check (product_id ~ '^[A-Za-z0-9_.-]{1,120}$'),
  offer_id text check (offer_id ~ '^[A-Za-z0-9_.-]{1,120}$'),
  customer_email text not null check (
    customer_email = lower(btrim(customer_email)) and length(customer_email) between 3 and 254
    and customer_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  order_status text not null check (order_status ~ '^[A-Za-z_]{1,40}$'),
  created_at_source timestamptz not null,
  paid_at timestamptz,
  refunded_at timestamptz,
  chargedback_at timestamptz,
  received_at timestamptz not null default clock_timestamp(),
  last_received_at timestamptz not null default clock_timestamp(),
  seen_count bigint not null default 1 check (seen_count > 0)
);
alter table access_private.cakto_events enable row level security;
revoke all on access_private.cakto_events from public, anon, authenticated;
grant select, insert, update on access_private.cakto_events to service_role;
create index cakto_events_received_idx on access_private.cakto_events (received_at desc, event_key);
create index cakto_events_order_idx on access_private.cakto_events (order_id, received_at desc);

-- Invoker rights, service role only; accessible through RPC without exposing the private schema.
create function public.cakto_capture_events(events jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  event jsonb;
  saved integer;
  inserted integer := 0;
  duplicates integer := 0;
begin
  if jsonb_typeof(events) is distinct from 'array' then
    raise exception 'Invalid capture batch' using errcode = '22023';
  end if;
  if jsonb_array_length(events) not between 1 and 25 then
    raise exception 'Invalid capture batch' using errcode = '22023';
  end if;
  -- Stable lock ordering for concurrent overlapping batches.
  for event in select value from jsonb_array_elements(events) order by value->>'event_key' loop
    if jsonb_typeof(event) is distinct from 'object' then
      raise exception 'Invalid captured event' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_object_keys(event) as k(key)
      where key not in ('event_key','event_name','order_id','product_id','offer_id',
        'customer_email','order_status','created_at_source','paid_at','refunded_at','chargedback_at')
    ) then
      raise exception 'Unexpected capture field' using errcode = '22023';
    end if;
    insert into access_private.cakto_events (
      event_key, event_name, order_id, product_id, offer_id, customer_email,
      order_status, created_at_source, paid_at, refunded_at, chargedback_at
    ) values (
      event->>'event_key', event->>'event_name', event->>'order_id', event->>'product_id',
      event->>'offer_id', event->>'customer_email', event->>'order_status',
      (event->>'created_at_source')::timestamptz, (event->>'paid_at')::timestamptz,
      (event->>'refunded_at')::timestamptz, (event->>'chargedback_at')::timestamptz
    ) on conflict (event_key) do nothing;
    get diagnostics saved = row_count;
    if saved = 1 then
      inserted := inserted + 1;
    else
      update access_private.cakto_events
      set seen_count = seen_count + 1, last_received_at = clock_timestamp()
      where event_key = event->>'event_key';
      duplicates := duplicates + 1;
    end if;
  end loop;
  return jsonb_build_object('inserted', inserted, 'duplicates', duplicates);
end $$;
revoke all on function public.cakto_capture_events(jsonb) from public, anon, authenticated;
grant execute on function public.cakto_capture_events(jsonb) to service_role;
