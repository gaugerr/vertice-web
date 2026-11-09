-- DRAFT ONLY: not applied, intentionally outside supabase/migrations.
-- Generated filename via Supabase CLI 3.0.0 migration new in an isolated directory.
-- Existing auth.users, public.licenses and Cakto objects are prerequisites, not modified.
begin;
create schema user_data_private;
revoke all on schema user_data_private from public, anon, authenticated;
grant usage on schema user_data_private to authenticated, service_role;

create table public.shopping_lists (
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  id uuid not null default gen_random_uuid(),
  store_name text not null check (length(btrim(store_name)) between 1 and 50),
  reference_date date not null,
  description text not null default '' check (length(description)<=10000),
  budget_cents bigint check (budget_cents between 1 and 9007199254740991),
  status text not null default 'active' check (status in ('active','completed')),
  completed_at timestamptz,
  purchase_date date,
  market_name text check (length(btrim(market_name)) between 1 and 50),
  check ((status='active' and completed_at is null) or (status='completed' and completed_at is not null and purchase_date is not null)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_created_at timestamptz,
  client_updated_at timestamptz,
  row_version bigint not null default 1 check (row_version>0),
  deleted_at timestamptz,
  primary key(user_id,id)
);

create table public.shopping_categories (
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  id uuid not null default gen_random_uuid(),
  shopping_list_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 50),
  position integer not null check (position>=0),
  foreign key (user_id, shopping_list_id) references public.shopping_lists(user_id,id),
  unique(user_id,shopping_list_id,id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_created_at timestamptz,
  client_updated_at timestamptz,
  row_version bigint not null default 1 check (row_version>0),
  deleted_at timestamptz,
  primary key(user_id,id)
);

create table public.shopping_items (
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  id uuid not null default gen_random_uuid(),
  shopping_list_id uuid not null,
  category_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 50),
  unit_price numeric not null check (unit_price>=0 and length(unit_price::text)<=100 and unit_price::text ~ '^[0-9]+([.][0-9]+)?$'),
  quantity numeric not null check (quantity>0 and length(quantity::text)<=100 and quantity::text ~ '^[0-9]+([.][0-9]+)?$'),
  unit text not null check (unit in ('un','kg','L')),
  is_purchased boolean not null default false,
  brand text check (length(btrim(brand)) between 1 and 50),
  package_amount numeric,
  package_unit text check (package_unit in ('g','kg','ml','L','un')),
  line_total_cents bigint generated always as (round(unit_price*quantity*100)::bigint) stored,
  check (line_total_cents between 0 and 9007199254740991),
  check ((package_amount is null and package_unit is null) or (package_amount is not null and package_unit is not null and package_amount>0 and package_amount::text ~ '^[0-9]+([.][0-9]{1,3})?$' and length(package_amount::text)<=100 and (package_unit<>'un' or trunc(package_amount)=package_amount))),
  foreign key (user_id, shopping_list_id) references public.shopping_lists(user_id,id),
  foreign key (user_id,shopping_list_id,category_id) references public.shopping_categories(user_id,shopping_list_id,id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_created_at timestamptz,
  client_updated_at timestamptz,
  row_version bigint not null default 1 check (row_version>0),
  deleted_at timestamptz,
  primary key(user_id,id)
);

create table public.finance_categories (
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  id text not null check (length(id) between 1 and 200 and id not in ('__proto__','constructor','prototype')),
  name text not null check (length(btrim(name)) between 1 and 50),
  kind text not null check (kind in ('income','expense')),
  color text check (color ~ '^#[a-fA-F0-9]{3,8}$'),
  icon text check (length(icon)<=20),
  archived_at timestamptz,
  unique(user_id,id,kind),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_created_at timestamptz,
  client_updated_at timestamptz,
  row_version bigint not null default 1 check (row_version>0),
  deleted_at timestamptz,
  primary key(user_id,id)
);

create table public.finance_payment_methods (
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  id text not null check (length(id) between 1 and 200 and id not in ('__proto__','constructor','prototype')),
  name text not null check (length(btrim(name)) between 1 and 50),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_created_at timestamptz,
  client_updated_at timestamptz,
  row_version bigint not null default 1 check (row_version>0),
  deleted_at timestamptz,
  primary key(user_id,id)
);

create table public.finance_fixed_accounts (
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  id text not null check (length(id) between 1 and 200 and id not in ('__proto__','constructor','prototype')),
  name text not null check (length(btrim(name)) between 1 and 80),
  start_month date not null check (extract(day from start_month)=1),
  end_month date check (extract(day from end_month)=1 and end_month>=start_month),
  observation text not null default '' check (length(observation)<=1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_created_at timestamptz,
  client_updated_at timestamptz,
  row_version bigint not null default 1 check (row_version>0),
  deleted_at timestamptz,
  primary key(user_id,id)
);

create table public.finance_fixed_versions (
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  id text not null check (length(id) between 1 and 200 and id not in ('__proto__','constructor','prototype')),
  fixed_account_id text not null,
  effective_month date not null check (extract(day from effective_month)=1),
  amount_cents bigint not null check (amount_cents between 1 and 9999999999),
  due_day smallint not null check (due_day between 1 and 31),
  category_id text not null,
  category_kind text not null default 'expense' check (category_kind='expense'),
  payment_method_id text not null,
  foreign key (user_id,fixed_account_id) references public.finance_fixed_accounts(user_id,id),
  foreign key (user_id,category_id,category_kind) references public.finance_categories(user_id,id,kind),
  foreign key (user_id,payment_method_id) references public.finance_payment_methods(user_id,id),
  unique(user_id,fixed_account_id,effective_month),
  unique(user_id,fixed_account_id,id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_created_at timestamptz,
  client_updated_at timestamptz,
  row_version bigint not null default 1 check (row_version>0),
  deleted_at timestamptz,
  primary key(user_id,id)
);

create table public.finance_entries (
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  id text not null check (length(id) between 1 and 200 and id not in ('__proto__','constructor','prototype')),
  source text not null check (source in ('manual','fixed','shopping')),
  kind text not null check (kind in ('income','expense')),
  name text not null check (length(btrim(name)) between 1 and 80),
  competence_month date not null check (extract(day from competence_month)=1),
  reference_date date not null,
  planned_amount_cents bigint not null check (planned_amount_cents between 1 and 9999999999),
  settlement_discount_cents bigint not null default 0 check (settlement_discount_cents between 0 and planned_amount_cents),
  category_id text not null,
  payment_method_id text,
  observation text not null default '' check (length(observation)<=1000),
  fixed_account_id text,
  fixed_version_id text,
  shopping_list_id uuid,
  check (date_trunc('month',reference_date)::date=competence_month),
  check ((source='fixed' and kind='expense' and fixed_account_id is not null and fixed_version_id is not null and shopping_list_id is null) or (source='manual' and fixed_account_id is null and fixed_version_id is null and shopping_list_id is null) or (source='shopping' and kind='expense' and shopping_list_id is not null and fixed_account_id is null and fixed_version_id is null)),
  foreign key (user_id,category_id,kind) references public.finance_categories(user_id,id,kind),
  foreign key (user_id,payment_method_id) references public.finance_payment_methods(user_id,id),
  foreign key (user_id,fixed_account_id) references public.finance_fixed_accounts(user_id,id),
  foreign key (user_id,fixed_account_id,fixed_version_id) references public.finance_fixed_versions(user_id,fixed_account_id,id),
  foreign key (user_id,shopping_list_id) references public.shopping_lists(user_id,id),
  unique(user_id,fixed_account_id,competence_month),
  unique(user_id,shopping_list_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_created_at timestamptz,
  client_updated_at timestamptz,
  row_version bigint not null default 1 check (row_version>0),
  deleted_at timestamptz,
  primary key(user_id,id)
);

create table public.finance_payments (
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  id text not null check (length(id) between 1 and 200 and id not in ('__proto__','constructor','prototype')),
  entry_id text not null,
  payment_date date not null,
  movement_type text not null default 'payment' check (movement_type in ('payment','adjustment')),
  amount_cents bigint not null check (amount_cents between -9999999999 and 9999999999),
  observation text not null default '' check (length(observation)<=1000),
  check (movement_type='adjustment' or amount_cents>0),
  foreign key (user_id,entry_id) references public.finance_entries(user_id,id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_created_at timestamptz,
  client_updated_at timestamptz,
  row_version bigint not null default 1 check (row_version>0),
  deleted_at timestamptz,
  primary key(user_id,id)
);

create table public.finance_budget_months (
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  id uuid not null default gen_random_uuid(),
  month date not null check (extract(day from month)=1),
  unique(user_id,month),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_created_at timestamptz,
  client_updated_at timestamptz,
  row_version bigint not null default 1 check (row_version>0),
  deleted_at timestamptz,
  primary key(user_id,id)
);

create table public.finance_budget_limits (
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  id text not null check (length(id) between 1 and 200 and id not in ('__proto__','constructor','prototype')),
  budget_month_id uuid not null,
  category_id text not null,
  category_kind text not null default 'expense' check (category_kind='expense'),
  limit_cents bigint not null check (limit_cents between 0 and 9999999999),
  foreign key (user_id,budget_month_id) references public.finance_budget_months(user_id,id),
  foreign key (user_id,category_id,category_kind) references public.finance_categories(user_id,id,kind),
  unique(user_id,budget_month_id,category_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_created_at timestamptz,
  client_updated_at timestamptz,
  row_version bigint not null default 1 check (row_version>0),
  deleted_at timestamptz,
  primary key(user_id,id)
);

create table public.finance_budget_defaults (
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  id text not null check (length(id) between 1 and 200 and id not in ('__proto__','constructor','prototype')),
  category_id text not null,
  category_kind text not null default 'expense' check (category_kind='expense'),
  limit_cents bigint not null check (limit_cents between 0 and 9999999999),
  foreign key (user_id,category_id,category_kind) references public.finance_categories(user_id,id,kind),
  unique(user_id,category_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_created_at timestamptz,
  client_updated_at timestamptz,
  row_version bigint not null default 1 check (row_version>0),
  deleted_at timestamptz,
  primary key(user_id,id)
);

create table public.finance_goals (
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  id text not null check (length(id) between 1 and 200 and id not in ('__proto__','constructor','prototype')),
  name text not null check (length(btrim(name)) between 1 and 150),
  description text not null default '' check (length(description)<=1000),
  target_cents bigint not null check (target_cents between 1 and 9999999999),
  opening_amount_cents bigint not null default 0 check (opening_amount_cents between 0 and 9999999999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_created_at timestamptz,
  client_updated_at timestamptz,
  row_version bigint not null default 1 check (row_version>0),
  deleted_at timestamptz,
  primary key(user_id,id)
);

create table public.finance_goal_contributions (
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  id text not null check (length(id) between 1 and 200 and id not in ('__proto__','constructor','prototype')),
  goal_id text not null,
  contribution_date date not null,
  amount_cents bigint not null check (amount_cents between 1 and 9999999999),
  foreign key (user_id,goal_id) references public.finance_goals(user_id,id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_created_at timestamptz,
  client_updated_at timestamptz,
  row_version bigint not null default 1 check (row_version>0),
  deleted_at timestamptz,
  primary key(user_id,id)
);

create table public.user_import_batches (
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  id uuid not null default gen_random_uuid(),
  source_kind text not null check (source_kind in ('local_shopping','local_finance','shopping_backup','finance_backup')),
  source_scope uuid not null,
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  imported_records integer not null check (imported_records>=0),
  unique(user_id,source_kind,source_scope,source_sha256),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_created_at timestamptz,
  client_updated_at timestamptz,
  row_version bigint not null default 1 check (row_version>0),
  deleted_at timestamptz,
  primary key(user_id,id)
);

create unique index finance_category_names on public.finance_categories(user_id,kind,lower(btrim(name))) where deleted_at is null;
create unique index finance_method_names on public.finance_payment_methods(user_id,lower(btrim(name))) where deleted_at is null;
create index shopping_category_list on public.shopping_categories(user_id,shopping_list_id,position);
create index shopping_item_category on public.shopping_items(user_id,shopping_list_id,category_id);
create index finance_version_category on public.finance_fixed_versions(user_id,category_id,category_kind);
create index finance_version_method on public.finance_fixed_versions(user_id,payment_method_id);
create index finance_entry_month on public.finance_entries(user_id,competence_month,reference_date) where deleted_at is null;
create index finance_entry_category on public.finance_entries(user_id,category_id,kind);
create index finance_entry_method on public.finance_entries(user_id,payment_method_id);
create index finance_entry_version on public.finance_entries(user_id,fixed_account_id,fixed_version_id);
create index finance_payment_entry on public.finance_payments(user_id,entry_id,payment_date);
create index finance_budget_limit_category on public.finance_budget_limits(user_id,category_id,category_kind);
create index finance_budget_default_category on public.finance_budget_defaults(user_id,category_id,category_kind);
create index finance_contribution_goal on public.finance_goal_contributions(user_id,goal_id,contribution_date);

create function user_data_private.stamp_row() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if TG_OP='UPDATE' then
    if new.user_id is distinct from old.user_id or new.id is distinct from old.id then
      raise exception 'Record identity is immutable' using errcode='23514';
    end if;
    new.created_at:=old.created_at;
    new.row_version:=old.row_version+1;
  else
    new.created_at:=clock_timestamp(); new.row_version:=1;
  end if;
  new.updated_at:=clock_timestamp();
  return new;
end $$;

create function user_data_private.freeze_category_kind() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.kind is distinct from old.kind then raise exception 'Category kind is immutable' using errcode='23514'; end if;
  return new;
end $$;
create trigger freeze_category_kind before update on public.finance_categories
for each row execute function user_data_private.freeze_category_kind();

create function user_data_private.guard_fixed_version() returns trigger
language plpgsql security invoker set search_path='' as $$
declare first_month date;
begin
  select start_month into first_month from public.finance_fixed_accounts where user_id=new.user_id and id=new.fixed_account_id;
  if first_month is null or new.effective_month<first_month then raise exception 'Invalid effective month' using errcode='23514'; end if;
  return new;
end $$;
create trigger guard_fixed_version before insert or update on public.finance_fixed_versions
for each row execute function user_data_private.guard_fixed_version();

create function user_data_private.guard_fixed_snapshot() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if old.source='fixed' and (new.name,new.source,new.kind,new.reference_date,new.competence_month,new.planned_amount_cents,new.category_id,new.payment_method_id,new.fixed_account_id,new.fixed_version_id)
     is distinct from (old.name,old.source,old.kind,old.reference_date,old.competence_month,old.planned_amount_cents,old.category_id,old.payment_method_id,old.fixed_account_id,old.fixed_version_id)
     and exists(select 1 from public.finance_payments where user_id=old.user_id and entry_id=old.id and deleted_at is null) then
    raise exception 'Paid fixed-account snapshot is immutable; adjust payments explicitly' using errcode='23514';
  end if;
  return new;
end $$;
create trigger guard_fixed_snapshot before update on public.finance_entries
for each row execute function user_data_private.guard_fixed_snapshot();

create function user_data_private.check_payment_total() returns trigger
language plpgsql security invoker set search_path='' as $$
declare owner_id uuid; target_id text; paid numeric;
begin
  owner_id:=coalesce(new.user_id,old.user_id); target_id:=coalesce(new.entry_id,old.entry_id);
  perform 1 from public.finance_entries where user_id=owner_id and id=target_id for update;
  select coalesce(sum(amount_cents),0) into paid from public.finance_payments where user_id=owner_id and entry_id=target_id and deleted_at is null;
  if paid<0 or paid>9999999999 then raise exception 'Invalid cumulative payment' using errcode='23514'; end if;
  if TG_OP='UPDATE' and (new.entry_id is distinct from old.entry_id) then raise exception 'Payment entry is immutable' using errcode='23514'; end if;
  return null;
end $$;
create constraint trigger check_payment_total after insert or update or delete on public.finance_payments
deferrable initially deferred for each row execute function user_data_private.check_payment_total();

create function user_data_private.check_goal_total() returns trigger
language plpgsql security invoker set search_path='' as $$
declare owner_id uuid; target_id text; opening numeric; saved numeric;
begin
  owner_id:=coalesce(new.user_id,old.user_id);
  if TG_TABLE_NAME='finance_goals' then target_id:=coalesce(new.id,old.id);
  else
    target_id:=coalesce(new.goal_id,old.goal_id);
    if TG_OP='UPDATE' and new.goal_id is distinct from old.goal_id then raise exception 'Contribution goal is immutable' using errcode='23514'; end if;
  end if;
  select opening_amount_cents into opening from public.finance_goals where user_id=owner_id and id=target_id for update;
  if not found then return null; end if;
  select coalesce(sum(amount_cents),0)+opening into saved from public.finance_goal_contributions where user_id=owner_id and goal_id=target_id and deleted_at is null;
  if saved>9999999999 then raise exception 'Goal total exceeds limit' using errcode='23514'; end if;
  return null;
end $$;
create constraint trigger check_goal_total after insert or update or delete on public.finance_goal_contributions
deferrable initially deferred for each row execute function user_data_private.check_goal_total();
create constraint trigger check_goal_opening after insert or update on public.finance_goals
deferrable initially deferred for each row execute function user_data_private.check_goal_total();

-- No public/anonymous access; reads follow ownership. Writes additionally require active license.
-- Revocation blocks new mutations, does not erase personal records or change their owner.

alter table public.shopping_lists enable row level security;
revoke all on public.shopping_lists from public, anon, authenticated;
grant select,insert,update on public.shopping_lists to authenticated;
grant all on public.shopping_lists to service_role;
create policy own_read on public.shopping_lists for select to authenticated
using (user_id=(select auth.uid()));
create policy licensed_insert on public.shopping_lists for insert to authenticated
with check (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'));
create policy licensed_update on public.shopping_lists for update to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'))
with check (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'));
create trigger stamp_row before insert or update on public.shopping_lists
for each row execute function user_data_private.stamp_row();
create index shopping_lists_updated on public.shopping_lists(user_id,updated_at,id);

alter table public.shopping_categories enable row level security;
revoke all on public.shopping_categories from public, anon, authenticated;
grant select,insert,update on public.shopping_categories to authenticated;
grant all on public.shopping_categories to service_role;
create policy own_read on public.shopping_categories for select to authenticated
using (user_id=(select auth.uid()));
create policy licensed_insert on public.shopping_categories for insert to authenticated
with check (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'));
create policy licensed_update on public.shopping_categories for update to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'))
with check (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'));
create trigger stamp_row before insert or update on public.shopping_categories
for each row execute function user_data_private.stamp_row();
create index shopping_categories_updated on public.shopping_categories(user_id,updated_at,id);

alter table public.shopping_items enable row level security;
revoke all on public.shopping_items from public, anon, authenticated;
grant select,insert,update on public.shopping_items to authenticated;
grant all on public.shopping_items to service_role;
create policy own_read on public.shopping_items for select to authenticated
using (user_id=(select auth.uid()));
create policy licensed_insert on public.shopping_items for insert to authenticated
with check (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'));
create policy licensed_update on public.shopping_items for update to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'))
with check (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'));
create trigger stamp_row before insert or update on public.shopping_items
for each row execute function user_data_private.stamp_row();
create index shopping_items_updated on public.shopping_items(user_id,updated_at,id);

alter table public.finance_categories enable row level security;
revoke all on public.finance_categories from public, anon, authenticated;
grant select,insert,update on public.finance_categories to authenticated;
grant all on public.finance_categories to service_role;
create policy own_read on public.finance_categories for select to authenticated
using (user_id=(select auth.uid()));
create policy licensed_insert on public.finance_categories for insert to authenticated
with check (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'));
create policy licensed_update on public.finance_categories for update to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'))
with check (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'));
create trigger stamp_row before insert or update on public.finance_categories
for each row execute function user_data_private.stamp_row();
create index finance_categories_updated on public.finance_categories(user_id,updated_at,id);

alter table public.finance_payment_methods enable row level security;
revoke all on public.finance_payment_methods from public, anon, authenticated;
grant select,insert,update on public.finance_payment_methods to authenticated;
grant all on public.finance_payment_methods to service_role;
create policy own_read on public.finance_payment_methods for select to authenticated
using (user_id=(select auth.uid()));
create policy licensed_insert on public.finance_payment_methods for insert to authenticated
with check (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'));
create policy licensed_update on public.finance_payment_methods for update to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'))
with check (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'));
create trigger stamp_row before insert or update on public.finance_payment_methods
for each row execute function user_data_private.stamp_row();
create index finance_payment_methods_updated on public.finance_payment_methods(user_id,updated_at,id);

alter table public.finance_fixed_accounts enable row level security;
revoke all on public.finance_fixed_accounts from public, anon, authenticated;
grant select,insert,update on public.finance_fixed_accounts to authenticated;
grant all on public.finance_fixed_accounts to service_role;
create policy own_read on public.finance_fixed_accounts for select to authenticated
using (user_id=(select auth.uid()));
create policy licensed_insert on public.finance_fixed_accounts for insert to authenticated
with check (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'));
create policy licensed_update on public.finance_fixed_accounts for update to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'))
with check (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'));
create trigger stamp_row before insert or update on public.finance_fixed_accounts
for each row execute function user_data_private.stamp_row();
create index finance_fixed_accounts_updated on public.finance_fixed_accounts(user_id,updated_at,id);

alter table public.finance_fixed_versions enable row level security;
revoke all on public.finance_fixed_versions from public, anon, authenticated;
grant select,insert,update on public.finance_fixed_versions to authenticated;
grant all on public.finance_fixed_versions to service_role;
create policy own_read on public.finance_fixed_versions for select to authenticated
using (user_id=(select auth.uid()));
create policy licensed_insert on public.finance_fixed_versions for insert to authenticated
with check (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'));
create policy licensed_update on public.finance_fixed_versions for update to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'))
with check (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'));
create trigger stamp_row before insert or update on public.finance_fixed_versions
for each row execute function user_data_private.stamp_row();
create index finance_fixed_versions_updated on public.finance_fixed_versions(user_id,updated_at,id);

alter table public.finance_entries enable row level security;
revoke all on public.finance_entries from public, anon, authenticated;
grant select,insert,update on public.finance_entries to authenticated;
grant all on public.finance_entries to service_role;
create policy own_read on public.finance_entries for select to authenticated
using (user_id=(select auth.uid()));
create policy licensed_insert on public.finance_entries for insert to authenticated
with check (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'));
create policy licensed_update on public.finance_entries for update to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'))
with check (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'));
create trigger stamp_row before insert or update on public.finance_entries
for each row execute function user_data_private.stamp_row();
create index finance_entries_updated on public.finance_entries(user_id,updated_at,id);

alter table public.finance_payments enable row level security;
revoke all on public.finance_payments from public, anon, authenticated;
grant select,insert,update on public.finance_payments to authenticated;
grant all on public.finance_payments to service_role;
create policy own_read on public.finance_payments for select to authenticated
using (user_id=(select auth.uid()));
create policy licensed_insert on public.finance_payments for insert to authenticated
with check (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'));
create policy licensed_update on public.finance_payments for update to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'))
with check (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'));
create trigger stamp_row before insert or update on public.finance_payments
for each row execute function user_data_private.stamp_row();
create index finance_payments_updated on public.finance_payments(user_id,updated_at,id);

alter table public.finance_budget_months enable row level security;
revoke all on public.finance_budget_months from public, anon, authenticated;
grant select,insert,update on public.finance_budget_months to authenticated;
grant all on public.finance_budget_months to service_role;
create policy own_read on public.finance_budget_months for select to authenticated
using (user_id=(select auth.uid()));
create policy licensed_insert on public.finance_budget_months for insert to authenticated
with check (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'));
create policy licensed_update on public.finance_budget_months for update to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'))
with check (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'));
create trigger stamp_row before insert or update on public.finance_budget_months
for each row execute function user_data_private.stamp_row();
create index finance_budget_months_updated on public.finance_budget_months(user_id,updated_at,id);

alter table public.finance_budget_limits enable row level security;
revoke all on public.finance_budget_limits from public, anon, authenticated;
grant select,insert,update on public.finance_budget_limits to authenticated;
grant all on public.finance_budget_limits to service_role;
create policy own_read on public.finance_budget_limits for select to authenticated
using (user_id=(select auth.uid()));
create policy licensed_insert on public.finance_budget_limits for insert to authenticated
with check (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'));
create policy licensed_update on public.finance_budget_limits for update to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'))
with check (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'));
create trigger stamp_row before insert or update on public.finance_budget_limits
for each row execute function user_data_private.stamp_row();
create index finance_budget_limits_updated on public.finance_budget_limits(user_id,updated_at,id);

alter table public.finance_budget_defaults enable row level security;
revoke all on public.finance_budget_defaults from public, anon, authenticated;
grant select,insert,update on public.finance_budget_defaults to authenticated;
grant all on public.finance_budget_defaults to service_role;
create policy own_read on public.finance_budget_defaults for select to authenticated
using (user_id=(select auth.uid()));
create policy licensed_insert on public.finance_budget_defaults for insert to authenticated
with check (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'));
create policy licensed_update on public.finance_budget_defaults for update to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'))
with check (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'));
create trigger stamp_row before insert or update on public.finance_budget_defaults
for each row execute function user_data_private.stamp_row();
create index finance_budget_defaults_updated on public.finance_budget_defaults(user_id,updated_at,id);

alter table public.finance_goals enable row level security;
revoke all on public.finance_goals from public, anon, authenticated;
grant select,insert,update on public.finance_goals to authenticated;
grant all on public.finance_goals to service_role;
create policy own_read on public.finance_goals for select to authenticated
using (user_id=(select auth.uid()));
create policy licensed_insert on public.finance_goals for insert to authenticated
with check (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'));
create policy licensed_update on public.finance_goals for update to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'))
with check (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'));
create trigger stamp_row before insert or update on public.finance_goals
for each row execute function user_data_private.stamp_row();
create index finance_goals_updated on public.finance_goals(user_id,updated_at,id);

alter table public.finance_goal_contributions enable row level security;
revoke all on public.finance_goal_contributions from public, anon, authenticated;
grant select,insert,update on public.finance_goal_contributions to authenticated;
grant all on public.finance_goal_contributions to service_role;
create policy own_read on public.finance_goal_contributions for select to authenticated
using (user_id=(select auth.uid()));
create policy licensed_insert on public.finance_goal_contributions for insert to authenticated
with check (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'));
create policy licensed_update on public.finance_goal_contributions for update to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'))
with check (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'));
create trigger stamp_row before insert or update on public.finance_goal_contributions
for each row execute function user_data_private.stamp_row();
create index finance_goal_contributions_updated on public.finance_goal_contributions(user_id,updated_at,id);

alter table public.user_import_batches enable row level security;
revoke all on public.user_import_batches from public, anon, authenticated;
grant select,insert,update on public.user_import_batches to authenticated;
grant all on public.user_import_batches to service_role;
create policy own_read on public.user_import_batches for select to authenticated
using (user_id=(select auth.uid()));
create policy licensed_insert on public.user_import_batches for insert to authenticated
with check (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'));
create policy licensed_update on public.user_import_batches for update to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'))
with check (user_id=(select auth.uid()) and exists(select 1 from public.licenses l where l.user_id=(select auth.uid()) and l.status='active'));
create trigger stamp_row before insert or update on public.user_import_batches
for each row execute function user_data_private.stamp_row();
create index user_import_batches_updated on public.user_import_batches(user_id,updated_at,id);

revoke all on all functions in schema user_data_private from public, anon, authenticated;
grant execute on all functions in schema user_data_private to authenticated, service_role;

create view public.finance_entry_totals with (security_invoker=true) as
select e.*, coalesce(p.paid_cents,0)::bigint as paid_cents,
  greatest(e.planned_amount_cents-e.settlement_discount_cents,coalesce(p.paid_cents,0))::bigint as expected_cents,
  greatest(e.planned_amount_cents-e.settlement_discount_cents-coalesce(p.paid_cents,0),0)::bigint as pending_cents,
  coalesce(p.paid_cents,0)>=e.planned_amount_cents-e.settlement_discount_cents as is_settled
from public.finance_entries e
left join lateral (select sum(amount_cents) as paid_cents from public.finance_payments p where p.user_id=e.user_id and p.entry_id=e.id and p.deleted_at is null) p on true
where e.deleted_at is null;
create view public.finance_goal_totals with (security_invoker=true) as
select g.*, (g.opening_amount_cents+coalesce(c.contributed,0))::bigint as current_cents
from public.finance_goals g
left join lateral (select sum(amount_cents) as contributed from public.finance_goal_contributions c where c.user_id=g.user_id and c.goal_id=g.id and c.deleted_at is null) c on true
where g.deleted_at is null;
revoke all on public.finance_entry_totals,public.finance_goal_totals from public,anon,authenticated;
grant select on public.finance_entry_totals,public.finance_goal_totals to authenticated,service_role;
commit;
