-- Read-only before/after evidence. No secrets, emails or webhook bodies returned.
-- Also used in the isolated regression runner; never executes payment processing.
with protected_tables as (
  select c.oid, n.nspname, c.relname, c.relacl, c.relrowsecurity, c.relforcerowsecurity
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where c.relkind in ('r','p') and (
    n.nspname in ('access_private','cakto_private') or
    (n.nspname='public' and c.relname='licenses') or
    (n.nspname='auth' and c.relname in ('users','identities'))
  )
), table_definitions as (
  select nspname||'.'||relname as name,
    jsonb_build_object(
      'acl',relacl::text,'rls',relrowsecurity,'force_rls',relforcerowsecurity,
      'columns',(select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attacl::text,pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
        from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
        where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped),
      'constraints',(select jsonb_agg(jsonb_build_array(c.conname,pg_get_constraintdef(c.oid,true)) order by c.conname) from pg_constraint c where c.conrelid=t.oid),
      'indexes',(select jsonb_agg(pg_get_indexdef(i.indexrelid) order by i.indexrelid::regclass::text) from pg_index i where i.indrelid=t.oid),
      'policies',(select jsonb_agg(jsonb_build_array(p.polname,p.polcmd,p.polroles::text,pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid)) order by p.polname) from pg_policy p where p.polrelid=t.oid),
      'triggers',(select jsonb_agg(pg_get_triggerdef(g.oid,true) order by g.tgname) from pg_trigger g where g.tgrelid=t.oid and not g.tgisinternal)
    ) as definition
  from protected_tables t
), protected_functions as (
  select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' as name,
    jsonb_build_object('definition',md5(pg_get_functiondef(p.oid)),'acl',p.proacl::text) as definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('access_private','cakto_private') or
    (n.nspname='public' and (p.proname like 'access_%' or p.proname like 'cakto_%' or p.proname='rls_auto_enable'))
)
select jsonb_build_object(
  'tables',(select jsonb_object_agg(name,md5(definition::text)) from table_definitions),
  'functions',(select jsonb_object_agg(name,definition) from protected_functions),
  'license_count',(select count(*) from public.licenses),
  'license_rows',(select md5(coalesce(string_agg(to_jsonb(l)::text,'' order by id),'')) from public.licenses l),
  'products',(select md5(coalesce(string_agg(to_jsonb(p)::text,'' order by product_id),'')) from access_private.cakto_products p),
  'event_triggers',(select jsonb_agg(jsonb_build_array(evtname,evtevent,evtfoid::regprocedure::text,evtenabled) order by evtname) from pg_event_trigger)
) as fingerprint;
