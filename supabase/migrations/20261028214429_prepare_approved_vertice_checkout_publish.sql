
create or replace function cakto_private.approved_checkout_request(p_method text, p_path text, p_body jsonb default null)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, cakto_private
as $function$
declare
  v_client_id text;
  v_client_secret text;
  v_token text;
  v_response cakto_private.http_response;
  v_body jsonb;
  v_stage text := 'validation';
begin
  if not (
(p_method = 'GET' and p_path in ('products/988379d3-cbaa-465f-930b-14aa7d48422e/', 'products/988379d3-cbaa-465f-930b-14aa7d48422e/checkouts/1241258/', 'offers/jjnk3vv/'))
or (p_method = 'PUT' and p_path = 'offers/jjnk3vv/' and jsonb_typeof(p_body) = 'object' and p_body ? 'price' and (p_body->>'price')::numeric in (18.91,5) and p_body - 'name' - 'price' = '{}'::jsonb)
or (p_method = 'PUT' and p_path = 'products/988379d3-cbaa-465f-930b-14aa7d48422e/checkouts/1241258/' and jsonb_typeof(p_body) = 'object' and p_body ? 'config' and p_body - 'name' - 'config' - 'default' - 'visits' = '{}'::jsonb)
) then
    return jsonb_build_object('ok',false,'stage',v_stage,'reason','path_not_allowed');
  end if;
  select decrypted_secret into v_client_id from vault.decrypted_secrets where name='CAKTO_CLIENT_ID';
  select decrypted_secret into v_client_secret from vault.decrypted_secrets where name='CAKTO_CLIENT_SECRET';
  if nullif(btrim(v_client_id),'') is null or nullif(btrim(v_client_secret),'') is null then
    return jsonb_build_object('ok',false,'stage','credentials','reason','missing_secret');
  end if;
  perform cakto_private.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS','5000');
  perform cakto_private.http_set_curlopt('CURLOPT_TIMEOUT_MS','15000');
  v_stage := 'authentication';
  select * into v_response from cakto_private.http_post(
    'https://api.cakto.com.br/public_api/token/',
    jsonb_build_object('client_id',btrim(v_client_id),'client_secret',btrim(v_client_secret))
  );
  v_client_id := null;
  v_client_secret := null;
  if v_response.status <> 200 then
    perform cakto_private.http_reset_curlopt();
    return jsonb_build_object('ok',false,'stage',v_stage,'status',v_response.status);
  end if;
  v_body := v_response.content::jsonb;
  v_token := v_body->>'access_token';
  v_body := null;
  v_response := null;
  if nullif(v_token,'') is null then
    perform cakto_private.http_reset_curlopt();
    return jsonb_build_object('ok',false,'stage',v_stage,'reason','missing_access_token');
  end if;
  v_stage := 'read_checkout';
  select * into v_response from cakto_private.http((
    p_method::cakto_private.http_method,
    'https://api.cakto.com.br/public_api/' || p_path,
    array[cakto_private.http_header('Authorization','Bearer ' || v_token)],
    case when p_method = 'GET' then null else 'application/json' end,
    case when p_method = 'GET' then null else p_body::text end
  )::cakto_private.http_request);
  v_token := null;
  perform cakto_private.http_reset_curlopt();
  if v_response.status not in (200,201,400) then
    return jsonb_build_object('ok',false,'stage',v_stage,'status',v_response.status);
  end if;
  return jsonb_build_object('ok',v_response.status in (200,201),'status',v_response.status,'body',v_response.content::jsonb);
exception when others then
  v_client_id := null;
  v_client_secret := null;
  v_token := null;
  perform cakto_private.http_reset_curlopt();
  return jsonb_build_object('ok',false,'stage',v_stage,'sqlstate',sqlstate);
end;
$function$;
revoke all on all functions in schema cakto_private from public, anon, authenticated, service_role;
comment on function cakto_private.approved_checkout_request(text,text,jsonb) is 'Temporary owner-only helper restricted to the approved Vertice checkout and offer. No tokens or secrets returned; no public endpoint or schedule. Drop after publication.';

