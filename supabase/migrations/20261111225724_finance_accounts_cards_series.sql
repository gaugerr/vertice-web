alter table public.finance_budget_months add column total_limit_cents bigint check(total_limit_cents between 0 and 9999999999);
-- Additive ledger support. Existing identities, licenses and payment automation are untouched.
create table public.finance_wallets (
 workspace_id uuid not null references workspace_private.spaces(id), id text not null check(length(id) between 1 and 160 and id not in ('__proto__','constructor','prototype')),
 name text not null check(length(btrim(name)) between 1 and 80), opening_balance_cents bigint not null check(abs(opening_balance_cents)<=9999999999), opening_date date not null,
 is_archived boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid not null default workspace_private.actor() references auth.users(id), updated_by uuid not null default workspace_private.actor() references auth.users(id), row_version bigint not null default 1, deleted_at timestamptz,
 primary key(workspace_id,id)
);
create table public.finance_cards (
 workspace_id uuid not null references workspace_private.spaces(id), id text not null check(length(id) between 1 and 160 and id not in ('__proto__','constructor','prototype')), name text not null check(length(btrim(name)) between 1 and 80), closing_day smallint not null check(closing_day between 1 and 31), due_day smallint not null check(due_day between 1 and 31),
 is_archived boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid not null default workspace_private.actor() references auth.users(id), updated_by uuid not null default workspace_private.actor() references auth.users(id), row_version bigint not null default 1, deleted_at timestamptz,
 primary key(workspace_id,id)
);
create table public.finance_moves (
 workspace_id uuid not null references workspace_private.spaces(id), id text not null check(length(id) between 1 and 160 and id not in ('__proto__','constructor','prototype')), kind text not null check(kind in ('transfer','invoice')),
 from_wallet_id text not null, to_wallet_id text, card_id text, invoice_month date,
 amount_cents bigint not null check(amount_cents between 1 and 9999999999), movement_date date not null, observation text not null default '' check(length(observation)<=1000),
 check((kind='transfer' and to_wallet_id is not null and to_wallet_id<>from_wallet_id and card_id is null and invoice_month is null) or (kind='invoice' and to_wallet_id is null and card_id is not null and invoice_month is not null and extract(day from invoice_month)=1)),
 foreign key(workspace_id,from_wallet_id) references public.finance_wallets(workspace_id,id), foreign key(workspace_id,to_wallet_id) references public.finance_wallets(workspace_id,id), foreign key(workspace_id,card_id) references public.finance_cards(workspace_id,id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid not null default workspace_private.actor() references auth.users(id), updated_by uuid not null default workspace_private.actor() references auth.users(id), row_version bigint not null default 1, deleted_at timestamptz,
 primary key(workspace_id,id)
);
alter table public.finance_entries add column extra jsonb not null default '{}'::jsonb check(jsonb_typeof(extra)='object');
alter table public.finance_payments add column wallet_id text, add column invoice_move_id text,
 add foreign key(workspace_id,wallet_id) references public.finance_wallets(workspace_id,id),
 add foreign key(workspace_id,invoice_move_id) references public.finance_moves(workspace_id,id);
create index finance_payment_invoice_move on public.finance_payments(workspace_id,invoice_move_id) where invoice_move_id is not null;
create index finance_payment_wallet on public.finance_payments(workspace_id,wallet_id) where wallet_id is not null;
create index finance_moves_source on public.finance_moves(workspace_id,from_wallet_id,movement_date);
create index finance_moves_target on public.finance_moves(workspace_id,to_wallet_id) where to_wallet_id is not null;
create index finance_moves_card on public.finance_moves(workspace_id,card_id,invoice_month) where card_id is not null;
do $$ declare entity text; begin
 foreach entity in array array['finance_wallets','finance_cards','finance_moves'] loop
 execute format('alter table public.%I enable row level security',entity);
 execute format('revoke all on public.%I from public,anon,authenticated',entity);
 execute format('grant select on public.%I to authenticated',entity);
 execute format('grant all on public.%I to service_role',entity);
 execute format('create policy member_read on public.%I for select to authenticated using(workspace_private.can_read(workspace_id))',entity);
 execute format('create trigger stamp_row before insert or update on public.%I for each row execute function user_data_private.stamp_row()',entity);
 execute format('create index %I on public.%I(workspace_id,updated_at,id)',entity||'_updated',entity);
 execute format('create index %I on public.%I(created_by)',entity||'_creator',entity);
 execute format('create index %I on public.%I(updated_by)',entity||'_editor',entity);
 end loop;
end $$;
create or replace function workspace_private.entity_names() returns text[] language sql immutable set search_path='' as $$select array['shopping_lists','shopping_categories','shopping_items','finance_categories','finance_payment_methods','finance_wallets','finance_cards','finance_moves','finance_fixed_accounts','finance_fixed_versions','finance_entries','finance_payments','finance_budget_defaults','finance_budget_months','finance_budget_limits','finance_goals','finance_goal_contributions']::text[]$$;
-- Protect paid snapshots. Reversing the invoice in the same transaction releases the guard.
create function user_data_private.guard_card_snapshot() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.extra ? 'cardId' and (new.name,new.kind,new.reference_date,new.planned_amount_cents,new.category_id,new.extra,new.deleted_at) is distinct from (old.name,old.kind,old.reference_date,old.planned_amount_cents,old.category_id,old.extra,old.deleted_at)
 and exists(select 1 from public.finance_payments where workspace_id=old.workspace_id and entry_id=old.id and deleted_at is null) then raise exception 'Reverse invoice payments before editing a paid card purchase' using errcode='23514';end if;
 return new;
end $$;
create constraint trigger guard_card_snapshot after update on public.finance_entries deferrable initially deferred for each row execute function user_data_private.guard_card_snapshot();
alter function public.workspace_command(uuid,text,jsonb) rename to workspace_command_ledger_base;
alter function public.workspace_command_ledger_base(uuid,text,jsonb) set schema workspace_private;
revoke all on function workspace_private.workspace_command_ledger_base(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function workspace_private.workspace_command_ledger_base(uuid,text,jsonb) to service_role;
create function public.workspace_command(p_actor uuid,p_action text,p_input jsonb default '{}'::jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; target uuid; op jsonb; e record; c public.finance_cards; month date; closing date; purchase date; expected date;
begin
 if p_action in ('apply','copy') then
  op:=case when p_action='apply' then p_input->'operation' else p_input end;
  if coalesce(op->>'ledger_version','')<>'2' and (
   exists(select 1 from jsonb_array_elements(coalesce(op->'changes','[]')) x where x->>'entity' in ('finance_wallets','finance_cards','finance_moves') or (x->'body'->'extra') <> '{}'::jsonb)
   or exists(select 1 from jsonb_array_elements(coalesce(op->'changes','[]')) x join public.finance_entries ent on ent.workspace_id=(p_input->>'workspace_id')::uuid and ent.id=case when x->>'entity'='finance_entries' then x->>'id' when x->>'entity'='finance_payments' then x->'body'->>'entry_id' end where ent.extra<>'{}'::jsonb)
   or (p_action='copy' and exists(select 1 from public.finance_wallets where workspace_id=(p_input->>'source_id')::uuid and deleted_at is null))
  ) then raise exception 'client_update_required' using errcode='23514';end if;
 end if;
 result:=workspace_private.workspace_command_ledger_base(p_actor,p_action,p_input);
 if p_action not in ('apply','copy') then return result;end if;
 if p_action='apply' and not exists(select 1 from jsonb_array_elements(coalesce(op->'changes','[]')) x where x->>'entity' like 'finance_%') then return result;end if;
 target:=(p_input->>'workspace_id')::uuid;
 -- Every reference is scoped to the same workspace, including JSON metadata.
 for e in select r.* from public.finance_entries r where r.workspace_id=target and r.deleted_at is null and (p_action='copy' or exists(select 1 from jsonb_array_elements(coalesce(op->'changes','[]')) x where (x->>'entity'='finance_entries' and x->>'id'=r.id) or (x->>'entity'='finance_payments' and x->'body'->>'entry_id'=r.id) or (x->>'entity'='finance_cards' and x->>'id'=r.extra->>'cardId') or (x->>'entity'='finance_wallets' and x->>'id'=r.extra->>'walletId'))) loop
  if exists(select 1 from jsonb_object_keys(e.extra) k where k not in ('walletId','cardId','purchaseDate','seriesId','seriesKind','seriesIndex','seriesCount')) then raise exception 'Unknown entry metadata' using errcode='23514';end if;
  if e.extra ? 'walletId' and not exists(select 1 from public.finance_wallets where workspace_id=target and id=e.extra->>'walletId' and deleted_at is null) then raise exception 'Invalid wallet reference' using errcode='23503';end if;
  if e.extra ? 'seriesId' and (coalesce(e.extra->>'seriesKind','') not in ('repeat','installments') or (e.extra->>'seriesIndex')::int not between 1 and (e.extra->>'seriesCount')::int or (e.extra->>'seriesCount')::int not between 2 and 120) then raise exception 'Invalid installment series' using errcode='23514';end if;
  if e.extra ? 'cardId' then
   select * into c from public.finance_cards where workspace_id=target and id=e.extra->>'cardId' and deleted_at is null;
   if not found or e.kind<>'expense' or e.extra ? 'walletId' then raise exception 'Invalid card purchase' using errcode='23514';end if;
   purchase:=(e.extra->>'purchaseDate')::date;
   if purchase is null then raise exception 'Missing purchase date' using errcode='23514';end if;
   month:=date_trunc('month',purchase)::date;
   closing:=month+least(c.closing_day,extract(day from (month+interval '1 month - 1 day'))::int)-1;
   if purchase>=closing then month:=(month+interval '1 month')::date;end if;
   if c.due_day<=c.closing_day then month:=(month+interval '1 month')::date;end if;
   month:=(month+make_interval(months=>coalesce((e.extra->>'seriesIndex')::int,1)-1))::date;
   expected:=month+least(c.due_day,extract(day from(month+interval '1 month - 1 day'))::int)-1;
   if e.reference_date<>expected then raise exception 'Invalid card competence' using errcode='23514';end if;
   if exists(select 1 from public.finance_payments where workspace_id=target and entry_id=e.id and deleted_at is null and invoice_move_id is null) then raise exception 'A card purchase is settled through its invoice' using errcode='23514';end if;
   if (select coalesce(sum(amount_cents),0) from public.finance_payments where workspace_id=target and entry_id=e.id and deleted_at is null)>e.planned_amount_cents then raise exception 'Purchase overpaid' using errcode='23514';end if;
  end if;
 end loop;
 if exists(select 1 from public.finance_moves m join public.finance_wallets w on w.workspace_id=m.workspace_id and w.id=m.from_wallet_id where m.workspace_id=target and m.deleted_at is null and (w.deleted_at is not null or m.movement_date<w.opening_date)) then raise exception 'Invalid movement date or wallet' using errcode='23514';end if;
 for e in select * from public.finance_moves where workspace_id=target and kind='invoice' and deleted_at is null loop
  if e.amount_cents<>(select coalesce(sum(amount_cents),0) from public.finance_payments where workspace_id=target and invoice_move_id=e.id and deleted_at is null) then raise exception 'Invoice allocation does not match payment' using errcode='23514';end if;
 end loop;
 if exists(select 1 from public.finance_payments p join public.finance_entries ent on ent.workspace_id=p.workspace_id and ent.id=p.entry_id join public.finance_moves m on m.workspace_id=p.workspace_id and m.id=p.invoice_move_id where p.workspace_id=target and p.deleted_at is null and (m.deleted_at is not null or ent.deleted_at is not null or m.kind<>'invoice' or m.card_id is distinct from ent.extra->>'cardId' or m.invoice_month<>ent.competence_month or p.payment_date<>m.movement_date or p.wallet_id is not null)) then raise exception 'Invalid invoice allocation' using errcode='23514';end if;
 return result;
end $$;
revoke all on function public.workspace_command(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.workspace_command(uuid,text,jsonb) to service_role;
