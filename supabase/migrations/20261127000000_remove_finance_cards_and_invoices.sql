-- Removes credit cards and invoices from the finance ledger. One transaction.
--
-- It never rewrites financial rows (devices sync through workspace_private.changes, which a
-- direct table update would leave out of step). Instead it stops, rolling everything back, when
-- a card purchase or an invoice payment is still live, so no value can be lost or double
-- counted. Convert such records first: the app turns them into ordinary expenses and folds
-- invoice payments into the account's opening balance when a legacy backup is restored.
-- Card settings and soft-deleted invoice rows are archived (service role only) before the
-- structures are dropped; that archive table can be dropped later.

do $$
begin
 if exists(select 1 from public.finance_entries where deleted_at is null and extra ? 'cardId') then
  raise exception 'Card purchases still exist; convert them before removing cards' using errcode='23514';
 end if;
 if exists(select 1 from public.finance_moves where kind='invoice' and deleted_at is null) then
  raise exception 'Invoice payments still exist; convert them before removing cards' using errcode='23514';
 end if;
 if exists(select 1 from public.finance_payments where invoice_move_id is not null and deleted_at is null) then
  raise exception 'Invoice allocations still exist; convert them before removing cards' using errcode='23514';
 end if;
end $$;

create table public.finance_legacy_card_archive(
 workspace_id uuid not null,
 source text not null check(source in ('card','invoice_move','invoice_payment')),
 source_id text not null,
 data jsonb not null,
 archived_at timestamptz not null default now(),
 primary key(workspace_id,source,source_id)
);
alter table public.finance_legacy_card_archive enable row level security;
revoke all on public.finance_legacy_card_archive from public,anon,authenticated;
grant all on public.finance_legacy_card_archive to service_role;
insert into public.finance_legacy_card_archive(workspace_id,source,source_id,data)
 select workspace_id,'card',id,to_jsonb(c) from public.finance_cards c;
insert into public.finance_legacy_card_archive(workspace_id,source,source_id,data)
 select workspace_id,'invoice_move',id,to_jsonb(m) from public.finance_moves m where kind='invoice';
insert into public.finance_legacy_card_archive(workspace_id,source,source_id,data)
 select workspace_id,'invoice_payment',id,to_jsonb(p) from public.finance_payments p where invoice_move_id is not null;

drop trigger guard_card_snapshot on public.finance_entries;
drop function user_data_private.guard_card_snapshot();

-- Dropping the column also drops its foreign key and index.
alter table public.finance_payments drop column invoice_move_id;
delete from public.finance_moves where kind='invoice';
do $$
declare c record;
begin
 for c in select conname from pg_constraint where conrelid='public.finance_moves'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%invoice%' loop
  execute format('alter table public.finance_moves drop constraint %I',c.conname);
 end loop;
end $$;
alter table public.finance_moves drop column card_id, drop column invoice_month;
alter table public.finance_moves alter column to_wallet_id set not null;
alter table public.finance_moves add constraint finance_moves_transfer check(kind='transfer' and to_wallet_id<>from_wallet_id);
drop table public.finance_cards;

create or replace function workspace_private.entity_names() returns text[] language sql immutable set search_path='' as $$select array['shopping_lists','shopping_categories','shopping_items','finance_categories','finance_payment_methods','finance_wallets','finance_moves','finance_fixed_accounts','finance_fixed_versions','finance_entries','finance_payments','finance_budget_defaults','finance_budget_months','finance_budget_limits','finance_goals','finance_goal_contributions']::text[]$$;

create or replace function public.workspace_command(p_actor uuid,p_action text,p_input jsonb default '{}'::jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; target uuid; op jsonb; e record;
begin
 if p_action in ('apply','copy') then
  op:=case when p_action='apply' then p_input->'operation' else p_input end;
  if coalesce(op->>'ledger_version','')<>'2' and (
   exists(select 1 from jsonb_array_elements(coalesce(op->'changes','[]')) x where x->>'entity' in ('finance_wallets','finance_moves') or (x->'body'->'extra') <> '{}'::jsonb)
   or exists(select 1 from jsonb_array_elements(coalesce(op->'changes','[]')) x join public.finance_entries ent on ent.workspace_id=(p_input->>'workspace_id')::uuid and ent.id=case when x->>'entity'='finance_entries' then x->>'id' when x->>'entity'='finance_payments' then x->'body'->>'entry_id' end where ent.extra<>'{}'::jsonb)
   or (p_action='copy' and exists(select 1 from public.finance_wallets where workspace_id=(p_input->>'source_id')::uuid and deleted_at is null))
  ) then raise exception 'client_update_required' using errcode='23514';end if;
 end if;
 result:=workspace_private.workspace_command_ledger_base(p_actor,p_action,p_input);
 if p_action not in ('apply','copy') then return result;end if;
 if p_action='apply' and not exists(select 1 from jsonb_array_elements(coalesce(op->'changes','[]')) x where x->>'entity' like 'finance_%') then return result;end if;
 target:=(p_input->>'workspace_id')::uuid;
 -- Every reference is scoped to the same workspace, including JSON metadata.
 for e in select r.* from public.finance_entries r where r.workspace_id=target and r.deleted_at is null and (p_action='copy' or exists(select 1 from jsonb_array_elements(coalesce(op->'changes','[]')) x where (x->>'entity'='finance_entries' and x->>'id'=r.id) or (x->>'entity'='finance_payments' and x->'body'->>'entry_id'=r.id) or (x->>'entity'='finance_wallets' and x->>'id'=r.extra->>'walletId'))) loop
  if exists(select 1 from jsonb_object_keys(e.extra) k where k not in ('walletId','seriesId','seriesKind','seriesIndex','seriesCount')) then raise exception 'Unknown entry metadata' using errcode='23514';end if;
  if e.extra ? 'walletId' and not exists(select 1 from public.finance_wallets where workspace_id=target and id=e.extra->>'walletId' and deleted_at is null) then raise exception 'Invalid wallet reference' using errcode='23503';end if;
  if e.extra ? 'seriesId' and (coalesce(e.extra->>'seriesKind','') not in ('repeat','installments') or (e.extra->>'seriesIndex')::int not between 1 and (e.extra->>'seriesCount')::int or (e.extra->>'seriesCount')::int not between 2 and 120) then raise exception 'Invalid installment series' using errcode='23514';end if;
 end loop;
 if exists(select 1 from public.finance_moves m join public.finance_wallets w on w.workspace_id=m.workspace_id and w.id=m.from_wallet_id where m.workspace_id=target and m.deleted_at is null and (w.deleted_at is not null or m.movement_date<w.opening_date)) then raise exception 'Invalid movement date or wallet' using errcode='23514';end if;
 return result;
end $$;
revoke all on function public.workspace_command(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.workspace_command(uuid,text,jsonb) to service_role;
