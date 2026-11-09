-- Dedicated workspace key in Vault; never changes existing access/Cakto secrets.
set local lock_timeout = '3s';
set local statement_timeout = '30s';
create function workspace_private.read_signing_jwk() returns jsonb
language plpgsql security definer set search_path='' as $$
declare key jsonb;
begin
  -- This is a backend-only secret reader. End-user JWTs/UIDs never authorize it.
  if coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'role'
     is distinct from 'service_role' then
    raise exception 'Service authentication required' using errcode='42501';
  end if;
  select decrypted_secret::jsonb into key from vault.decrypted_secrets
  where name='vertice-workspace-signing-v1';
  if key is null or key->>'kty'<>'EC' or key->>'crv'<>'P-256' or not key ? 'd' then
    raise exception 'Workspace signing is not configured';
  end if;
  return key;
end $$;
revoke all on function workspace_private.read_signing_jwk() from public,anon,authenticated,service_role;
grant execute on function workspace_private.read_signing_jwk() to service_role;
create function public.workspace_signing_jwk() returns jsonb
language sql security invoker set search_path='' as $$select workspace_private.read_signing_jwk()$$;
revoke all on function public.workspace_signing_jwk() from public,anon,authenticated,service_role;
grant execute on function public.workspace_signing_jwk() to service_role;
