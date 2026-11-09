-- Additive foundation for personal/shared purchases and finance.
-- Generated using Supabase CLI migration new; reviewed for the existing production DB.
-- Does not modify Auth, licenses, Cakto functions, jobs, secrets, or existing permissions.
-- No users, spaces or financial records are backfilled. No frontend is activated.
set local lock_timeout = '3s';
set local statement_timeout = '30s';
do $$begin
  if to_regclass('public.licenses') is null or
     to_regprocedure('public.cakto_capture_events(jsonb)') is null or
     to_regprocedure('public.cakto_process_pending(boolean,integer)') is null or
     to_regprocedure('public.access_license_check(uuid)') is null then
    raise exception 'Existing access/Cakto prerequisites are missing';
  end if;
end $$;

create schema workspace_private;
revoke all on schema workspace_private from public,anon,authenticated;
grant usage on schema workspace_private to authenticated,service_role;
create table workspace_private.spaces(id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('personal','shared')),name text not null check(length(btrim(name)) between 1 and 60),owner_user_id uuid not null references auth.users(id) on delete restrict,status text not null default 'active' check(status in ('active','closed')),revision bigint not null default 0,unique(id,kind));
create unique index one_personal_space on workspace_private.spaces(owner_user_id) where kind='personal';
create table workspace_private.members(workspace_id uuid not null,user_id uuid not null references auth.users(id),kind text not null,role text not null check(role in ('owner','member')),active boolean not null default true,generation integer not null default 1 check(generation>0),display_name text not null,email text not null,primary key(workspace_id,user_id),foreign key(workspace_id,kind) references workspace_private.spaces(id,kind));
create unique index one_active_shared_space on workspace_private.members(user_id) where active and kind='shared';
create table workspace_private.invites(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references workspace_private.spaces(id),email text not null check(email=lower(btrim(email)) and length(email) between 3 and 254),token_hash text not null unique check(token_hash~'^[a-f0-9]{64}$'),expires_at timestamptz not null default now()+interval '7 days',used_at timestamptz,revoked_at timestamptz);
create index invites_space on workspace_private.invites(workspace_id);
create table workspace_private.operations(workspace_id uuid not null references workspace_private.spaces(id),id uuid not null,actor_id uuid not null references auth.users(id),digest text not null,result jsonb not null,primary key(workspace_id,id));
create table workspace_private.changes(workspace_id uuid not null references workspace_private.spaces(id),revision bigint not null,operation_id uuid not null,records jsonb not null,primary key(workspace_id,revision));
alter table workspace_private.spaces enable row level security;
alter table workspace_private.members enable row level security;
alter table workspace_private.invites enable row level security;
alter table workspace_private.operations enable row level security;
alter table workspace_private.changes enable row level security;
revoke all on all tables in schema workspace_private from public,anon,authenticated;
grant all on all tables in schema workspace_private to service_role;
create function workspace_private.actor() returns uuid language sql stable security invoker set search_path='' as $$select coalesce(auth.uid(),nullif(current_setting('vertice.actor',true),'')::uuid)$$;
create function workspace_private.can_read(target uuid) returns boolean language sql stable security definer set search_path='' as $$select (select auth.uid()) is not null and exists(select 1 from workspace_private.members m join workspace_private.spaces w on w.id=m.workspace_id where m.workspace_id=target and m.user_id=(select auth.uid()) and m.active and (w.status='active' or w.owner_user_id=(select auth.uid())))$$;
revoke all on function workspace_private.can_read(uuid),workspace_private.actor() from public,anon,authenticated;
grant execute on function workspace_private.can_read(uuid) to authenticated,service_role;
grant execute on function workspace_private.actor() to service_role;

create schema user_data_private;
revoke all on schema user_data_private from public, anon, authenticated;
grant usage on schema user_data_private to authenticated, service_role;

create table public.shopping_lists (
  workspace_id uuid not null references workspace_private.spaces(id) on delete restrict,
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
  created_by uuid not null default workspace_private.actor() references auth.users(id),
  updated_by uuid not null default workspace_private.actor() references auth.users(id),
  row_version bigint not null default 1 check (row_version>0),
  deleted_at timestamptz,
  primary key(workspace_id,id)
);

create table public.shopping_categories (
  workspace_id uuid not null references workspace_private.spaces(id) on delete restrict,
  id uuid not null default gen_random_uuid(),
  shopping_list_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 50),
  position integer not null check (position>=0),
  foreign key (workspace_id, shopping_list_id) references public.shopping_lists(workspace_id,id),
  unique(workspace_id,shopping_list_id,id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_created_at timestamptz,
  client_updated_at timestamptz,
  created_by uuid not null default workspace_private.actor() references auth.users(id),
  updated_by uuid not null default workspace_private.actor() references auth.users(id),
  row_version bigint not null default 1 check (row_version>0),
  deleted_at timestamptz,
  primary key(workspace_id,id)
);

create table public.shopping_items (
  workspace_id uuid not null references workspace_private.spaces(id) on delete restrict,
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
  foreign key (workspace_id, shopping_list_id) references public.shopping_lists(workspace_id,id),
  foreign key (workspace_id,shopping_list_id,category_id) references public.shopping_categories(workspace_id,shopping_list_id,id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_created_at timestamptz,
  client_updated_at timestamptz,
  created_by uuid not null default workspace_private.actor() references auth.users(id),
  updated_by uuid not null default workspace_private.actor() references auth.users(id),
  row_version bigint not null default 1 check (row_version>0),
  deleted_at timestamptz,
  primary key(workspace_id,id)
);

create table public.finance_categories (
  workspace_id uuid not null references workspace_private.spaces(id) on delete restrict,
  id text not null check (length(id) between 1 and 200 and id not in ('__proto__','constructor','prototype')),
  name text not null check (length(btrim(name)) between 1 and 50),
  kind text not null check (kind in ('income','expense')),
  color text check (color ~ '^#[a-fA-F0-9]{3,8}$'),
  icon text check (length(icon)<=20),
  archived_at timestamptz,
  is_archived boolean not null default false,
  unique(workspace_id,id,kind),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_created_at timestamptz,
  client_updated_at timestamptz,
  created_by uuid not null default workspace_private.actor() references auth.users(id),
  updated_by uuid not null default workspace_private.actor() references auth.users(id),
  row_version bigint not null default 1 check (row_version>0),
  deleted_at timestamptz,
  primary key(workspace_id,id)
);

create table public.finance_payment_methods (
  workspace_id uuid not null references workspace_private.spaces(id) on delete restrict,
  id text not null check (length(id) between 1 and 200 and id not in ('__proto__','constructor','prototype')),
  name text not null check (length(btrim(name)) between 1 and 50),
  archived_at timestamptz,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_created_at timestamptz,
  client_updated_at timestamptz,
  created_by uuid not null default workspace_private.actor() references auth.users(id),
  updated_by uuid not null default workspace_private.actor() references auth.users(id),
  row_version bigint not null default 1 check (row_version>0),
  deleted_at timestamptz,
  primary key(workspace_id,id)
);

create table public.finance_fixed_accounts (
  workspace_id uuid not null references workspace_private.spaces(id) on delete restrict,
  id text not null check (length(id) between 1 and 200 and id not in ('__proto__','constructor','prototype')),
  name text not null check (length(btrim(name)) between 1 and 80),
  start_month date not null check (extract(day from start_month)=1),
  end_month date check (extract(day from end_month)=1 and end_month>=start_month),
  observation text not null default '' check (length(observation)<=1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_created_at timestamptz,
  client_updated_at timestamptz,
  created_by uuid not null default workspace_private.actor() references auth.users(id),
  updated_by uuid not null default workspace_private.actor() references auth.users(id),
  row_version bigint not null default 1 check (row_version>0),
  deleted_at timestamptz,
  primary key(workspace_id,id)
);

create table public.finance_fixed_versions (
  workspace_id uuid not null references workspace_private.spaces(id) on delete restrict,
  id text not null check (length(id) between 1 and 200 and id not in ('__proto__','constructor','prototype')),
  fixed_account_id text not null,
  effective_month date not null check (extract(day from effective_month)=1),
  amount_cents bigint not null check (amount_cents between 1 and 9999999999),
  due_day smallint not null check (due_day between 1 and 31),
  category_id text not null,
  category_kind text not null default 'expense' check (category_kind='expense'),
  payment_method_id text not null,
  foreign key (workspace_id,fixed_account_id) references public.finance_fixed_accounts(workspace_id,id),
  foreign key (workspace_id,category_id,category_kind) references public.finance_categories(workspace_id,id,kind),
  foreign key (workspace_id,payment_method_id) references public.finance_payment_methods(workspace_id,id),
  unique(workspace_id,fixed_account_id,effective_month),
  unique(workspace_id,fixed_account_id,id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_created_at timestamptz,
  client_updated_at timestamptz,
  created_by uuid not null default workspace_private.actor() references auth.users(id),
  updated_by uuid not null default workspace_private.actor() references auth.users(id),
  row_version bigint not null default 1 check (row_version>0),
  deleted_at timestamptz,
  primary key(workspace_id,id)
);

create table public.finance_entries (
  workspace_id uuid not null references workspace_private.spaces(id) on delete restrict,
  id text not null check (length(id) between 1 and 200 and id not in ('__proto__','constructor','prototype')),
  source text not null check (source in ('manual','fixed','shopping')),
  kind text not null check (kind in ('income','expense')),
  name text not null check (length(btrim(name)) between 1 and 80),
  competence_month date not null check (extract(day from competence_month)=1),
  reference_date date not null,
  planned_amount_cents bigint not null check (planned_amount_cents between 1 and 9999999999),
  local_override_cents bigint check(local_override_cents between 1 and 9999999999),
  settlement_discount_cents bigint not null default 0 check (settlement_discount_cents between 0 and planned_amount_cents),
  category_id text not null,
  payment_method_id text,
  observation text not null default '' check (length(observation)<=1000),
  fixed_account_id text,
  fixed_version_id text,
  shopping_list_id uuid,
  check (date_trunc('month',reference_date)::date=competence_month),
  check ((source='fixed' and kind='expense' and fixed_account_id is not null and fixed_version_id is not null and shopping_list_id is null) or (source='manual' and fixed_account_id is null and fixed_version_id is null and shopping_list_id is null) or (source='shopping' and kind='expense' and shopping_list_id is not null and fixed_account_id is null and fixed_version_id is null)),
  foreign key (workspace_id,category_id,kind) references public.finance_categories(workspace_id,id,kind),
  foreign key (workspace_id,payment_method_id) references public.finance_payment_methods(workspace_id,id),
  foreign key (workspace_id,fixed_account_id) references public.finance_fixed_accounts(workspace_id,id),
  foreign key (workspace_id,fixed_account_id,fixed_version_id) references public.finance_fixed_versions(workspace_id,fixed_account_id,id),
  foreign key (workspace_id,shopping_list_id) references public.shopping_lists(workspace_id,id),
  unique(workspace_id,fixed_account_id,competence_month),
  unique(workspace_id,shopping_list_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_created_at timestamptz,
  client_updated_at timestamptz,
  created_by uuid not null default workspace_private.actor() references auth.users(id),
  updated_by uuid not null default workspace_private.actor() references auth.users(id),
  row_version bigint not null default 1 check (row_version>0),
  deleted_at timestamptz,
  primary key(workspace_id,id)
);

create table public.finance_payments (
  workspace_id uuid not null references workspace_private.spaces(id) on delete restrict,
  id text not null check (length(id) between 1 and 200 and id not in ('__proto__','constructor','prototype')),
  entry_id text not null,
  sequence_no integer not null default 0 check(sequence_no>=0),
  payment_date date not null,
  movement_type text not null default 'payment' check (movement_type in ('payment','adjustment')),
  amount_cents bigint not null check (amount_cents between -9999999999 and 9999999999),
  observation text not null default '' check (length(observation)<=1000),
  check (movement_type='adjustment' or amount_cents>0),
  foreign key (workspace_id,entry_id) references public.finance_entries(workspace_id,id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_created_at timestamptz,
  client_updated_at timestamptz,
  created_by uuid not null default workspace_private.actor() references auth.users(id),
  updated_by uuid not null default workspace_private.actor() references auth.users(id),
  row_version bigint not null default 1 check (row_version>0),
  deleted_at timestamptz,
  primary key(workspace_id,id)
);

create table public.finance_budget_months (
  workspace_id uuid not null references workspace_private.spaces(id) on delete restrict,
  id uuid not null default gen_random_uuid(),
  month date not null check (extract(day from month)=1),
  unique(workspace_id,month),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_created_at timestamptz,
  client_updated_at timestamptz,
  created_by uuid not null default workspace_private.actor() references auth.users(id),
  updated_by uuid not null default workspace_private.actor() references auth.users(id),
  row_version bigint not null default 1 check (row_version>0),
  deleted_at timestamptz,
  primary key(workspace_id,id)
);

create table public.finance_budget_limits (
  workspace_id uuid not null references workspace_private.spaces(id) on delete restrict,
  id text not null check (length(id) between 1 and 200 and id not in ('__proto__','constructor','prototype')),
  budget_month_id uuid not null,
  category_id text not null,
  category_kind text not null default 'expense' check (category_kind='expense'),
  limit_cents bigint not null check (limit_cents between 0 and 9999999999),
  foreign key (workspace_id,budget_month_id) references public.finance_budget_months(workspace_id,id),
  foreign key (workspace_id,category_id,category_kind) references public.finance_categories(workspace_id,id,kind),
  unique(workspace_id,budget_month_id,category_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_created_at timestamptz,
  client_updated_at timestamptz,
  created_by uuid not null default workspace_private.actor() references auth.users(id),
  updated_by uuid not null default workspace_private.actor() references auth.users(id),
  row_version bigint not null default 1 check (row_version>0),
  deleted_at timestamptz,
  primary key(workspace_id,id)
);

create table public.finance_budget_defaults (
  workspace_id uuid not null references workspace_private.spaces(id) on delete restrict,
  id text not null check (length(id) between 1 and 200 and id not in ('__proto__','constructor','prototype')),
  category_id text not null,
  category_kind text not null default 'expense' check (category_kind='expense'),
  limit_cents bigint not null check (limit_cents between 0 and 9999999999),
  foreign key (workspace_id,category_id,category_kind) references public.finance_categories(workspace_id,id,kind),
  unique(workspace_id,category_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_created_at timestamptz,
  client_updated_at timestamptz,
  created_by uuid not null default workspace_private.actor() references auth.users(id),
  updated_by uuid not null default workspace_private.actor() references auth.users(id),
  row_version bigint not null default 1 check (row_version>0),
  deleted_at timestamptz,
  primary key(workspace_id,id)
);

create table public.finance_goals (
  workspace_id uuid not null references workspace_private.spaces(id) on delete restrict,
  id text not null check (length(id) between 1 and 200 and id not in ('__proto__','constructor','prototype')),
  name text not null check (length(btrim(name)) between 1 and 150),
  description text not null default '' check (length(description)<=1000),
  target_cents bigint not null check (target_cents between 1 and 9999999999),
  opening_amount_cents bigint not null default 0 check (opening_amount_cents between 0 and 9999999999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_created_at timestamptz,
  client_updated_at timestamptz,
  created_by uuid not null default workspace_private.actor() references auth.users(id),
  updated_by uuid not null default workspace_private.actor() references auth.users(id),
  row_version bigint not null default 1 check (row_version>0),
  deleted_at timestamptz,
  primary key(workspace_id,id)
);

create table public.finance_goal_contributions (
  workspace_id uuid not null references workspace_private.spaces(id) on delete restrict,
  id text not null check (length(id) between 1 and 200 and id not in ('__proto__','constructor','prototype')),
  goal_id text not null,
  contribution_date date not null,
  amount_cents bigint not null check (amount_cents between 1 and 9999999999),
  foreign key (workspace_id,goal_id) references public.finance_goals(workspace_id,id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_created_at timestamptz,
  client_updated_at timestamptz,
  created_by uuid not null default workspace_private.actor() references auth.users(id),
  updated_by uuid not null default workspace_private.actor() references auth.users(id),
  row_version bigint not null default 1 check (row_version>0),
  deleted_at timestamptz,
  primary key(workspace_id,id)
);

create table public.user_import_batches (
  workspace_id uuid not null references workspace_private.spaces(id) on delete restrict,
  id uuid not null default gen_random_uuid(),
  source_kind text not null check (source_kind in ('local_shopping','local_finance','shopping_backup','finance_backup')),
  source_scope uuid not null,
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  imported_records integer not null check (imported_records>=0),
  unique(workspace_id,source_kind,source_scope,source_sha256),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_created_at timestamptz,
  client_updated_at timestamptz,
  created_by uuid not null default workspace_private.actor() references auth.users(id),
  updated_by uuid not null default workspace_private.actor() references auth.users(id),
  row_version bigint not null default 1 check (row_version>0),
  deleted_at timestamptz,
  primary key(workspace_id,id)
);

create unique index finance_category_names on public.finance_categories(workspace_id,kind,lower(btrim(name))) where deleted_at is null;
create unique index finance_method_names on public.finance_payment_methods(workspace_id,lower(btrim(name))) where deleted_at is null;
create index shopping_category_list on public.shopping_categories(workspace_id,shopping_list_id,position);
create index shopping_item_category on public.shopping_items(workspace_id,shopping_list_id,category_id);
create index finance_version_category on public.finance_fixed_versions(workspace_id,category_id,category_kind);
create index finance_version_method on public.finance_fixed_versions(workspace_id,payment_method_id);
create index finance_entry_month on public.finance_entries(workspace_id,competence_month,reference_date) where deleted_at is null;
create index finance_entry_category on public.finance_entries(workspace_id,category_id,kind);
create index finance_entry_method on public.finance_entries(workspace_id,payment_method_id);
create index finance_entry_version on public.finance_entries(workspace_id,fixed_account_id,fixed_version_id);
create index finance_payment_entry on public.finance_payments(workspace_id,entry_id,payment_date);
create index finance_budget_limit_category on public.finance_budget_limits(workspace_id,category_id,category_kind);
create index finance_budget_default_category on public.finance_budget_defaults(workspace_id,category_id,category_kind);
create index finance_contribution_goal on public.finance_goal_contributions(workspace_id,goal_id,contribution_date);

create function user_data_private.stamp_row() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if TG_OP='UPDATE' then
    if new.workspace_id is distinct from old.workspace_id or new.id is distinct from old.id then
      raise exception 'Record identity is immutable' using errcode='23514';
    end if;
    new.created_at:=old.created_at;
    new.row_version:=old.row_version+1;
  else
    new.created_at:=clock_timestamp(); new.row_version:=1;
  end if;
  if TG_OP='INSERT' then new.created_by:=workspace_private.actor(); else new.created_by:=old.created_by; end if;
  new.updated_by:=workspace_private.actor();
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
  select start_month into first_month from public.finance_fixed_accounts where workspace_id=new.workspace_id and id=new.fixed_account_id;
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
     and exists(select 1 from public.finance_payments where workspace_id=old.workspace_id and entry_id=old.id and deleted_at is null) then
    raise exception 'Paid fixed-account snapshot is immutable; adjust payments explicitly' using errcode='23514';
  end if;
  return new;
end $$;
create constraint trigger guard_fixed_snapshot after update on public.finance_entries
deferrable initially deferred for each row execute function user_data_private.guard_fixed_snapshot();

create function user_data_private.check_payment_total() returns trigger
language plpgsql security invoker set search_path='' as $$
declare owner_id uuid; target_id text; paid numeric;
begin
  owner_id:=coalesce(new.workspace_id,old.workspace_id); target_id:=coalesce(new.entry_id,old.entry_id);
  perform 1 from public.finance_entries where workspace_id=owner_id and id=target_id for update;
  select coalesce(sum(amount_cents),0) into paid from public.finance_payments where workspace_id=owner_id and entry_id=target_id and deleted_at is null;
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
  owner_id:=coalesce(new.workspace_id,old.workspace_id);
  if TG_TABLE_NAME='finance_goals' then target_id:=coalesce(new.id,old.id);
  else
    target_id:=coalesce(new.goal_id,old.goal_id);
    if TG_OP='UPDATE' and new.goal_id is distinct from old.goal_id then raise exception 'Contribution goal is immutable' using errcode='23514'; end if;
  end if;
  select opening_amount_cents into opening from public.finance_goals where workspace_id=owner_id and id=target_id for update;
  if not found then return null; end if;
  select coalesce(sum(amount_cents),0)+opening into saved from public.finance_goal_contributions where workspace_id=owner_id and goal_id=target_id and deleted_at is null;
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
grant select on public.shopping_lists to authenticated;
grant all on public.shopping_lists to service_role;
create policy own_read on public.shopping_lists for select to authenticated
using (workspace_private.can_read(workspace_id));
create trigger stamp_row before insert or update on public.shopping_lists
for each row execute function user_data_private.stamp_row();
create index shopping_lists_updated on public.shopping_lists(workspace_id,updated_at,id);

alter table public.shopping_categories enable row level security;
revoke all on public.shopping_categories from public, anon, authenticated;
grant select on public.shopping_categories to authenticated;
grant all on public.shopping_categories to service_role;
create policy own_read on public.shopping_categories for select to authenticated
using (workspace_private.can_read(workspace_id));
create trigger stamp_row before insert or update on public.shopping_categories
for each row execute function user_data_private.stamp_row();
create index shopping_categories_updated on public.shopping_categories(workspace_id,updated_at,id);

alter table public.shopping_items enable row level security;
revoke all on public.shopping_items from public, anon, authenticated;
grant select on public.shopping_items to authenticated;
grant all on public.shopping_items to service_role;
create policy own_read on public.shopping_items for select to authenticated
using (workspace_private.can_read(workspace_id));
create trigger stamp_row before insert or update on public.shopping_items
for each row execute function user_data_private.stamp_row();
create index shopping_items_updated on public.shopping_items(workspace_id,updated_at,id);

alter table public.finance_categories enable row level security;
revoke all on public.finance_categories from public, anon, authenticated;
grant select on public.finance_categories to authenticated;
grant all on public.finance_categories to service_role;
create policy own_read on public.finance_categories for select to authenticated
using (workspace_private.can_read(workspace_id));
create trigger stamp_row before insert or update on public.finance_categories
for each row execute function user_data_private.stamp_row();
create index finance_categories_updated on public.finance_categories(workspace_id,updated_at,id);

alter table public.finance_payment_methods enable row level security;
revoke all on public.finance_payment_methods from public, anon, authenticated;
grant select on public.finance_payment_methods to authenticated;
grant all on public.finance_payment_methods to service_role;
create policy own_read on public.finance_payment_methods for select to authenticated
using (workspace_private.can_read(workspace_id));
create trigger stamp_row before insert or update on public.finance_payment_methods
for each row execute function user_data_private.stamp_row();
create index finance_payment_methods_updated on public.finance_payment_methods(workspace_id,updated_at,id);

alter table public.finance_fixed_accounts enable row level security;
revoke all on public.finance_fixed_accounts from public, anon, authenticated;
grant select on public.finance_fixed_accounts to authenticated;
grant all on public.finance_fixed_accounts to service_role;
create policy own_read on public.finance_fixed_accounts for select to authenticated
using (workspace_private.can_read(workspace_id));
create trigger stamp_row before insert or update on public.finance_fixed_accounts
for each row execute function user_data_private.stamp_row();
create index finance_fixed_accounts_updated on public.finance_fixed_accounts(workspace_id,updated_at,id);

alter table public.finance_fixed_versions enable row level security;
revoke all on public.finance_fixed_versions from public, anon, authenticated;
grant select on public.finance_fixed_versions to authenticated;
grant all on public.finance_fixed_versions to service_role;
create policy own_read on public.finance_fixed_versions for select to authenticated
using (workspace_private.can_read(workspace_id));
create trigger stamp_row before insert or update on public.finance_fixed_versions
for each row execute function user_data_private.stamp_row();
create index finance_fixed_versions_updated on public.finance_fixed_versions(workspace_id,updated_at,id);

alter table public.finance_entries enable row level security;
revoke all on public.finance_entries from public, anon, authenticated;
grant select on public.finance_entries to authenticated;
grant all on public.finance_entries to service_role;
create policy own_read on public.finance_entries for select to authenticated
using (workspace_private.can_read(workspace_id));
create trigger stamp_row before insert or update on public.finance_entries
for each row execute function user_data_private.stamp_row();
create index finance_entries_updated on public.finance_entries(workspace_id,updated_at,id);

alter table public.finance_payments enable row level security;
revoke all on public.finance_payments from public, anon, authenticated;
grant select on public.finance_payments to authenticated;
grant all on public.finance_payments to service_role;
create policy own_read on public.finance_payments for select to authenticated
using (workspace_private.can_read(workspace_id));
create trigger stamp_row before insert or update on public.finance_payments
for each row execute function user_data_private.stamp_row();
create index finance_payments_updated on public.finance_payments(workspace_id,updated_at,id);

alter table public.finance_budget_months enable row level security;
revoke all on public.finance_budget_months from public, anon, authenticated;
grant select on public.finance_budget_months to authenticated;
grant all on public.finance_budget_months to service_role;
create policy own_read on public.finance_budget_months for select to authenticated
using (workspace_private.can_read(workspace_id));
create trigger stamp_row before insert or update on public.finance_budget_months
for each row execute function user_data_private.stamp_row();
create index finance_budget_months_updated on public.finance_budget_months(workspace_id,updated_at,id);

alter table public.finance_budget_limits enable row level security;
revoke all on public.finance_budget_limits from public, anon, authenticated;
grant select on public.finance_budget_limits to authenticated;
grant all on public.finance_budget_limits to service_role;
create policy own_read on public.finance_budget_limits for select to authenticated
using (workspace_private.can_read(workspace_id));
create trigger stamp_row before insert or update on public.finance_budget_limits
for each row execute function user_data_private.stamp_row();
create index finance_budget_limits_updated on public.finance_budget_limits(workspace_id,updated_at,id);

alter table public.finance_budget_defaults enable row level security;
revoke all on public.finance_budget_defaults from public, anon, authenticated;
grant select on public.finance_budget_defaults to authenticated;
grant all on public.finance_budget_defaults to service_role;
create policy own_read on public.finance_budget_defaults for select to authenticated
using (workspace_private.can_read(workspace_id));
create trigger stamp_row before insert or update on public.finance_budget_defaults
for each row execute function user_data_private.stamp_row();
create index finance_budget_defaults_updated on public.finance_budget_defaults(workspace_id,updated_at,id);

alter table public.finance_goals enable row level security;
revoke all on public.finance_goals from public, anon, authenticated;
grant select on public.finance_goals to authenticated;
grant all on public.finance_goals to service_role;
create policy own_read on public.finance_goals for select to authenticated
using (workspace_private.can_read(workspace_id));
create trigger stamp_row before insert or update on public.finance_goals
for each row execute function user_data_private.stamp_row();
create index finance_goals_updated on public.finance_goals(workspace_id,updated_at,id);

alter table public.finance_goal_contributions enable row level security;
revoke all on public.finance_goal_contributions from public, anon, authenticated;
grant select on public.finance_goal_contributions to authenticated;
grant all on public.finance_goal_contributions to service_role;
create policy own_read on public.finance_goal_contributions for select to authenticated
using (workspace_private.can_read(workspace_id));
create trigger stamp_row before insert or update on public.finance_goal_contributions
for each row execute function user_data_private.stamp_row();
create index finance_goal_contributions_updated on public.finance_goal_contributions(workspace_id,updated_at,id);

alter table public.user_import_batches enable row level security;
revoke all on public.user_import_batches from public, anon, authenticated;
grant select on public.user_import_batches to authenticated;
grant all on public.user_import_batches to service_role;
create policy own_read on public.user_import_batches for select to authenticated
using (workspace_private.can_read(workspace_id));
create trigger stamp_row before insert or update on public.user_import_batches
for each row execute function user_data_private.stamp_row();
create index user_import_batches_updated on public.user_import_batches(workspace_id,updated_at,id);

revoke all on all functions in schema user_data_private from public, anon, authenticated;
grant execute on all functions in schema user_data_private to service_role;

create view public.finance_entry_totals with (security_invoker=true) as
select e.*, coalesce(p.paid_cents,0)::bigint as paid_cents,
  greatest(e.planned_amount_cents-e.settlement_discount_cents,coalesce(p.paid_cents,0))::bigint as expected_cents,
  greatest(e.planned_amount_cents-e.settlement_discount_cents-coalesce(p.paid_cents,0),0)::bigint as pending_cents,
  coalesce(p.paid_cents,0)>=e.planned_amount_cents-e.settlement_discount_cents as is_settled
from public.finance_entries e
left join lateral (select sum(amount_cents) as paid_cents from public.finance_payments p where p.workspace_id=e.workspace_id and p.entry_id=e.id and p.deleted_at is null) p on true
where e.deleted_at is null;
create view public.finance_goal_totals with (security_invoker=true) as
select g.*, (g.opening_amount_cents+coalesce(c.contributed,0))::bigint as current_cents
from public.finance_goals g
left join lateral (select sum(amount_cents) as contributed from public.finance_goal_contributions c where c.workspace_id=g.workspace_id and c.goal_id=g.id and c.deleted_at is null) c on true
where g.deleted_at is null;
revoke all on public.finance_entry_totals,public.finance_goal_totals from public,anon,authenticated;
grant select on public.finance_entry_totals,public.finance_goal_totals to authenticated,service_role;

create table public.workspace_heads(workspace_id uuid primary key references workspace_private.spaces(id),revision bigint not null);
alter table public.workspace_heads enable row level security;
revoke all on public.workspace_heads from public,anon,authenticated;
grant select on public.workspace_heads to authenticated;
grant all on public.workspace_heads to service_role;
create policy member_read on public.workspace_heads for select to authenticated using(workspace_private.can_read(workspace_id));
do $$begin if exists(select 1 from pg_publication where pubname='supabase_realtime') then alter publication supabase_realtime add table public.workspace_heads; end if;end $$;

create function workspace_private.entity_names() returns text[] language sql immutable set search_path='' as $$select array['shopping_lists','shopping_categories','shopping_items','finance_categories','finance_payment_methods','finance_fixed_accounts','finance_fixed_versions','finance_entries','finance_payments','finance_budget_defaults','finance_budget_months','finance_budget_limits','finance_goals','finance_goal_contributions']::text[]$$;
create function workspace_private.put_record(target uuid,entity text,record_id text,body jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare keys text[];cols text;expressions text;sets text;exists_row boolean;
begin
 if not(entity=any(workspace_private.entity_names())) then raise exception 'invalid_entity';end if;
 body:=body-'workspace_id'-'row_version'-'created_at'-'updated_at'-'created_by'-'updated_by'-'line_total_cents';
 body:=body||jsonb_build_object('id',record_id,'workspace_id',target);
 select array_agg(k order by k) into keys from jsonb_object_keys(body) k;
 if exists(select 1 from unnest(keys) k where not exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=entity and c.column_name=k and c.is_generated='NEVER')) then raise exception 'invalid_field';end if;
 select string_agg(format('%I',k),','),string_agg(format('(r).%I',k),','),string_agg(format('%I=(r).%I',k,k),',') filter(where k not in ('id','workspace_id')) into cols,expressions,sets from unnest(keys) k;
 execute format('select exists(select 1 from public.%I where workspace_id=$1 and id::text=$2)',entity) into exists_row using target,record_id;
 if exists_row then execute format('update public.%I t set %s from (select jsonb_populate_record(null::public.%I,$1) r) q where t.workspace_id=$2 and t.id::text=$3',entity,sets,entity) using body,target,record_id;
 else execute format('insert into public.%I(%s) select %s from (select jsonb_populate_record(null::public.%I,$1) r) q',entity,cols,expressions,entity) using body;end if;
end $$;

create function public.workspace_command(p_actor uuid,p_action text,p_input jsonb default '{}'::jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor_email text;actor_name text;own_license boolean;w workspace_private.spaces;m workspace_private.members;i workspace_private.invites;source workspace_private.spaces;
 target uuid;op jsonb;opid uuid;hashed text;done workspace_private.operations;item jsonb;entity text;rid text;actual bigint;expected bigint;records jsonb:='[]';rowdata jsonb;changed jsonb:='[]';response jsonb;batch jsonb;all_batches jsonb;seen jsonb:='{}';cols text;newrevision bigint;previous bigint;selected text[];batches_count int;
begin
 select lower(btrim(a.identity_data->>'email')),coalesce(nullif(a.identity_data->>'full_name',''),split_part(a.identity_data->>'email','@',1)) into actor_email,actor_name from auth.identities a join auth.users u on u.id=a.user_id where a.user_id=p_actor and a.provider='google' and a.identity_data->>'email_verified'='true' and u.email_confirmed_at is not null limit 1;
 if actor_email is null then raise exception 'verified_identity_required' using errcode='28000';end if;
 perform set_config('vertice.actor',p_actor::text,true);
 select exists(select 1 from public.licenses where user_id=p_actor and status='active') into own_license;
 if p_action='list' then
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text,41));
  if own_license and not exists(select 1 from workspace_private.spaces where owner_user_id=p_actor and kind='personal') then
   insert into workspace_private.spaces(kind,name,owner_user_id) values('personal','Meu espaço',p_actor) returning * into w;
   insert into workspace_private.members values(w.id,p_actor,'personal','owner',true,1,actor_name,actor_email);insert into public.workspace_heads values(w.id,0);
  end if;
  return coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('role',a.role,'generation',a.generation,'writable',s.status='active' and exists(select 1 from public.licenses l where l.user_id=s.owner_user_id and l.status='active'))) from workspace_private.spaces s join workspace_private.members a on a.workspace_id=s.id where a.user_id=p_actor and a.active and (s.status='active' or s.owner_user_id=p_actor)),'[]');
 end if;
 if p_action='create' then
  if not own_license then raise exception 'forbidden' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text,41));
  if p_input->>'workspace_id' is not null then select * into w from workspace_private.spaces where id=(p_input->>'workspace_id')::uuid and kind='shared' and owner_user_id=p_actor and status='active';if found then return to_jsonb(w);end if;end if;
  if exists(select 1 from workspace_private.members where user_id=p_actor and kind='shared' and active) then raise exception 'already_shared' using errcode='23505';end if;
  insert into workspace_private.spaces(id,kind,name,owner_user_id) values(coalesce((p_input->>'workspace_id')::uuid,gen_random_uuid()),'shared',btrim(p_input->>'name'),p_actor) returning * into w;
  insert into workspace_private.members values(w.id,p_actor,'shared','owner',true,1,actor_name,actor_email);insert into public.workspace_heads values(w.id,0);return to_jsonb(w);
 end if;
 if p_action in ('accept','inspect_invite') then
  if p_action='accept' then perform pg_advisory_xact_lock(hashtextextended(p_actor::text,41));end if;
  select * into i from workspace_private.invites where token_hash=p_input->>'token_hash';
  if not found then raise exception 'invalid_invite' using errcode='42501';end if;
  select * into w from workspace_private.spaces where id=i.workspace_id for update;
  select * into i from workspace_private.invites where id=i.id for update;
  if i.used_at is not null or i.revoked_at is not null or i.expires_at<=clock_timestamp() or w.status<>'active' then raise exception 'invalid_invite' using errcode='42501';end if;
  if i.email<>actor_email then raise exception 'wrong_account' using errcode='42501';end if;
  if not exists(select 1 from public.licenses where user_id=w.owner_user_id and status='active') then raise exception 'forbidden' using errcode='42501';end if;
  if p_action='inspect_invite' then return jsonb_build_object('workspace_id',w.id,'name',w.name,'owner',(select display_name from workspace_private.members where workspace_id=w.id and role='owner'),'email',i.email);end if;
  if exists(select 1 from workspace_private.members where user_id=p_actor and kind='shared' and active) then raise exception 'already_shared' using errcode='23505';end if;
  if (select count(*) from workspace_private.members where workspace_id=w.id and active)>=2 then raise exception 'full' using errcode='23505';end if;
  insert into workspace_private.members values(w.id,p_actor,'shared','member',true,1,actor_name,actor_email) on conflict(workspace_id,user_id) do update set active=true,generation=workspace_private.members.generation+1;
  update workspace_private.invites set used_at=clock_timestamp() where id=i.id;
  return jsonb_build_object('workspace_id',w.id);
 end if;
 target:=(p_input->>'workspace_id')::uuid;
 select * into w from workspace_private.spaces where id=target for update;
 select * into m from workspace_private.members where workspace_id=target and user_id=p_actor and active;
 if w.id is null or m.user_id is null or (w.status='closed' and w.owner_user_id<>p_actor) then raise exception 'removed' using errcode='42501';end if;
 if p_action='access' then return jsonb_build_object('member',true,'uid',p_actor,'workspace_id',w.id,'kind',w.kind,'generation',m.generation,'writable',w.status='active' and exists(select 1 from public.licenses where user_id=w.owner_user_id and status='active'),'expiresAt',(extract(epoch from clock_timestamp())*1000)::bigint+case when w.kind='shared' then 86400000 else 604800000 end);end if;
 if p_action='members' then return jsonb_build_object('members',(select jsonb_agg(to_jsonb(a)) from workspace_private.members a where workspace_id=target and active),'pending',coalesce((select jsonb_agg(jsonb_build_object('email',email,'expiresAt',(extract(epoch from expires_at)*1000)::bigint)) from workspace_private.invites where workspace_id=target and used_at is null and revoked_at is null and expires_at>now()),'[]'));end if;
 if p_action in ('remove','close','revoke_invite','invite') and w.owner_user_id<>p_actor then raise exception 'forbidden' using errcode='42501';end if;
 if p_action in ('remove','leave','close','revoke_invite') then
  if p_action='leave' and m.role='owner' then raise exception 'owner_cannot_leave' using errcode='23514';end if;
  if p_action='remove' and (p_input->>'user_id')::uuid=w.owner_user_id then raise exception 'cannot_remove_owner' using errcode='23514';end if;
  update workspace_private.invites set revoked_at=clock_timestamp() where workspace_id=target and used_at is null;
  if p_action='remove' then update workspace_private.members set active=false,generation=generation+1 where workspace_id=target and user_id=(p_input->>'user_id')::uuid and active;
  elsif p_action='leave' then update workspace_private.members set active=false,generation=generation+1 where workspace_id=target and user_id=p_actor;
  elsif p_action='close' then update workspace_private.members set active=false,generation=generation+1 where workspace_id=target and role<>'owner' and active;update workspace_private.spaces set status='closed' where id=target;end if;
  return jsonb_build_object('ok',true);
 end if;
 if p_action='pull' then
  previous:=coalesce((p_input->>'cursor')::bigint,0);
  select coalesce(jsonb_agg(jsonb_build_object('revision',c.revision,'operation_id',c.operation_id,'records',c.records) order by c.revision),'[]'),count(*) into all_batches,batches_count from (select * from workspace_private.changes where workspace_id=target and revision>previous order by revision limit 100) c;
  newrevision:=case when batches_count=0 then w.revision else (all_batches->(batches_count-1)->>'revision')::bigint end;
  return jsonb_build_object('revision',newrevision,'batches',all_batches,'records','[]'::jsonb,'more',newrevision<w.revision);
 end if;
 if w.status<>'active' or not exists(select 1 from public.licenses where user_id=w.owner_user_id and status='active') then raise exception 'forbidden' using errcode='42501';end if;
 if p_action='invite' then
  if w.kind<>'shared' or (select count(*) from workspace_private.members where workspace_id=target and active)>=2 then raise exception 'full' using errcode='23505';end if;
  if lower(btrim(p_input->>'email'))=actor_email then raise exception 'invalid_email' using errcode='23514';end if;
  update workspace_private.invites set revoked_at=clock_timestamp() where workspace_id=target and used_at is null;
  insert into workspace_private.invites(workspace_id,email,token_hash) values(target,lower(btrim(p_input->>'email')),p_input->>'token_hash') returning * into i;
  return jsonb_build_object('email',i.email,'expiresAt',(extract(epoch from i.expires_at)*1000)::bigint);
 end if;
 if p_action not in ('apply','copy') then raise exception 'invalid_action';end if;
 op:=case when p_action='apply' then p_input->'operation' else p_input end;opid:=case when p_action='apply' then (op->>'id')::uuid else (op->>'operation_id')::uuid end;
 if p_action='apply' and (op->>'generation')::int is distinct from m.generation then raise exception 'generation' using errcode='42501';end if;
 hashed:=encode(sha256(convert_to(op::text,'UTF8')),'hex');select * into done from workspace_private.operations where workspace_id=target and id=opid;
 if found then if done.digest<>hashed or done.actor_id<>p_actor then raise exception 'operation_reused' using errcode='23505';end if;return done.result;end if;
 if p_action='copy' then
  if w.owner_user_id<>p_actor then raise exception 'forbidden' using errcode='42501';end if;
  select * into source from workspace_private.spaces where id=(op->>'source_id')::uuid and kind='personal' and owner_user_id=p_actor for update;
  if not found then raise exception 'invalid_source';end if;
  if op->>'area' not in ('shopping','finance','both') then raise exception 'invalid_area';end if;
  foreach entity in array workspace_private.entity_names() loop
   execute format('select count(*) from public.%I where workspace_id=$1 and deleted_at is null',entity) into actual using target;
   if actual>0 then raise exception 'not_empty' using errcode='23505';end if;
  end loop;
  foreach entity in array workspace_private.entity_names() loop
   if op->>'area'='both' or (op->>'area'='shopping' and entity like 'shopping_%') or (op->>'area'='finance' and entity like 'finance_%') then
    for rowdata in execute format('select to_jsonb(t) from public.%I t where workspace_id=$1 and deleted_at is null',entity) using source.id loop
     perform workspace_private.put_record(target,entity,rowdata->>'id',rowdata);changed:=changed||jsonb_build_array(jsonb_build_object('entity',entity,'id',rowdata->>'id'));
    end loop;
   end if;
  end loop;
 else
  if (op->>'generation')::int is distinct from m.generation then raise exception 'generation' using errcode='42501';end if;
  if jsonb_typeof(op->'changes')<>'array' or jsonb_array_length(op->'changes')>5000 or jsonb_array_length(op->'changes')=0 then raise exception 'invalid_changes';end if;
  for item in select value from jsonb_array_elements((op->'changes')||coalesce(op->'guards','[]')) loop
   entity:=item->>'entity';rid:=item->>'id';expected:=(item->>'expected_version')::bigint;
   if not(entity=any(workspace_private.entity_names())) or expected is null then raise exception 'invalid_entity';end if;
   execute format('select row_version from public.%I where workspace_id=$1 and id::text=$2',entity) into actual using target,rid;
   if coalesce(actual,0)<>expected then raise exception 'conflict' using errcode='40001';end if;
  end loop;
  for item in select value from jsonb_array_elements(op->'changes') loop
   if item->>'entity' in ('finance_payments','finance_goal_contributions') and not exists(select 1 from jsonb_array_elements(coalesce(op->'guards','[]')||(op->'changes')) g where g->>'entity'=case when item->>'entity'='finance_payments' then 'finance_entries' else 'finance_goals' end and g->>'id'=case when item->>'entity'='finance_payments' then item->'body'->>'entry_id' else item->'body'->>'goal_id' end) then raise exception 'parent_guard_required';end if;
  end loop;
  for item in select value from jsonb_array_elements(op->'changes') order by array_position(workspace_private.entity_names(),value->>'entity') loop
   entity:=item->>'entity';rid:=item->>'id';if seen ? (entity||'/'||rid) then raise exception 'duplicate_change';end if;seen:=seen||jsonb_build_object(entity||'/'||rid,true);
   perform workspace_private.put_record(target,entity,rid,item->'body');changed:=changed||jsonb_build_array(jsonb_build_object('entity',entity,'id',rid));
  end loop;
  for item in select value from jsonb_array_elements(coalesce(op->'guards','[]')) loop
   entity:=item->>'entity';rid:=item->>'id';if not seen ? (entity||'/'||rid) then
    execute format('update public.%I set updated_at=clock_timestamp() where workspace_id=$1 and id::text=$2',entity) using target,rid;
    changed:=changed||jsonb_build_array(jsonb_build_object('entity',entity,'id',rid));seen:=seen||jsonb_build_object(entity||'/'||rid,true);
   end if;
  end loop;
 end if;
 for item in select distinct value from jsonb_array_elements(changed) loop
  entity:=item->>'entity';rid:=item->>'id';execute format('select to_jsonb(t) from public.%I t where workspace_id=$1 and id::text=$2',entity) into rowdata using target,rid;
  records:=records||jsonb_build_array(jsonb_build_object('entity',entity,'id',rid,'body',rowdata));
 end loop;
 update workspace_private.spaces set revision=revision+1 where id=target returning revision into newrevision;
 update public.workspace_heads set revision=newrevision where workspace_id=target;
 response:=jsonb_build_object('revision',newrevision,'records',records);
 insert into workspace_private.changes values(target,newrevision,opid,records);
 insert into workspace_private.operations values(target,opid,p_actor,hashed,response);
 return response;
end $$;
revoke all on all functions in schema workspace_private from public,anon,authenticated;
grant execute on function workspace_private.can_read(uuid) to authenticated;
grant execute on all functions in schema workspace_private to service_role;
revoke all on function public.workspace_command(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.workspace_command(uuid,text,jsonb) to service_role;

-- Cover all new foreign keys without changing indexes on Auth/licenses/Cakto.
create index workspace_spaces_owner on workspace_private.spaces(owner_user_id);
create index workspace_members_user on workspace_private.members(user_id);
create index workspace_members_space_kind on workspace_private.members(workspace_id,kind);
create index workspace_operations_actor on workspace_private.operations(actor_id);
create index finance_entry_shopping on public.finance_entries(workspace_id,shopping_list_id);
create index shopping_lists_created_by on public.shopping_lists(created_by);
create index shopping_lists_updated_by on public.shopping_lists(updated_by);
create index shopping_categories_created_by on public.shopping_categories(created_by);
create index shopping_categories_updated_by on public.shopping_categories(updated_by);
create index shopping_items_created_by on public.shopping_items(created_by);
create index shopping_items_updated_by on public.shopping_items(updated_by);
create index finance_categories_created_by on public.finance_categories(created_by);
create index finance_categories_updated_by on public.finance_categories(updated_by);
create index finance_payment_methods_created_by on public.finance_payment_methods(created_by);
create index finance_payment_methods_updated_by on public.finance_payment_methods(updated_by);
create index finance_fixed_accounts_created_by on public.finance_fixed_accounts(created_by);
create index finance_fixed_accounts_updated_by on public.finance_fixed_accounts(updated_by);
create index finance_fixed_versions_created_by on public.finance_fixed_versions(created_by);
create index finance_fixed_versions_updated_by on public.finance_fixed_versions(updated_by);
create index finance_entries_created_by on public.finance_entries(created_by);
create index finance_entries_updated_by on public.finance_entries(updated_by);
create index finance_payments_created_by on public.finance_payments(created_by);
create index finance_payments_updated_by on public.finance_payments(updated_by);
create index finance_budget_months_created_by on public.finance_budget_months(created_by);
create index finance_budget_months_updated_by on public.finance_budget_months(updated_by);
create index finance_budget_limits_created_by on public.finance_budget_limits(created_by);
create index finance_budget_limits_updated_by on public.finance_budget_limits(updated_by);
create index finance_budget_defaults_created_by on public.finance_budget_defaults(created_by);
create index finance_budget_defaults_updated_by on public.finance_budget_defaults(updated_by);
create index finance_goals_created_by on public.finance_goals(created_by);
create index finance_goals_updated_by on public.finance_goals(updated_by);
create index finance_goal_contributions_created_by on public.finance_goal_contributions(created_by);
create index finance_goal_contributions_updated_by on public.finance_goal_contributions(updated_by);
create index user_import_batches_created_by on public.user_import_batches(created_by);
create index user_import_batches_updated_by on public.user_import_batches(updated_by);
