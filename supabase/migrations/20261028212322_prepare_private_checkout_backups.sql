create table if not exists cakto_private.checkout_backups (
id bigint generated always as identity primary key,
captured_at timestamptz not null default now(),
product_id uuid not null,
checkout_id bigint not null,
snapshot jsonb not null,
purpose text not null
);
alter table cakto_private.checkout_backups enable row level security;
revoke all on table cakto_private.checkout_backups from public, anon, authenticated, service_role;
revoke all on sequence cakto_private.checkout_backups_id_seq from public, anon, authenticated, service_role;
comment on table cakto_private.checkout_backups is 'Owner-only manual checkout snapshots, without API credentials or tokens.';