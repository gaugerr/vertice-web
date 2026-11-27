create schema if not exists cakto_private;
revoke all on schema cakto_private from public, anon, authenticated, service_role;
create extension if not exists http with schema cakto_private;
