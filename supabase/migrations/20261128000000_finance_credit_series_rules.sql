-- 20261128000000_finance_credit_series_rules.sql

-- Contas fixas de crédito: materialização controlada e encerramento seguro.
-- Derivação lida do banco (mesma regra de fixedRows/mapping); o cliente não envia valores.
-- Concorrência: workspace_command já faz select ... for update em spaces (serializa a escrita do workspace);
-- o insert usa on conflict do nothing (cobre PK e unique(workspace, conta, competência)).

create or replace function workspace_private.fixed_credit_row(target uuid, account_id text, month date)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare a public.finance_fixed_accounts%rowtype; v public.finance_fixed_versions%rowtype; last_day int;
begin
 select * into a from public.finance_fixed_accounts where workspace_id=target and id=account_id and deleted_at is null;
 if not found or month<a.start_month or (a.end_month is not null and month>a.end_month) then return null;end if;
 select * into v from public.finance_fixed_versions where workspace_id=target and fixed_account_id=account_id and deleted_at is null and effective_month<=month order by effective_month desc limit 1;
 if not found or v.payment_method_id<>'P4' then return null;end if;
 last_day:=extract(day from (date_trunc('month',month)+interval '1 month - 1 day'))::int;
 return jsonb_build_object(
  'id',account_id||':'||to_char(month,'YYYY-MM'),
  'name',a.name,
  'competence_month',to_char(month,'YYYY-MM-DD'),
  'reference_date',to_char(make_date(extract(year from month)::int,extract(month from month)::int,least(v.due_day,last_day)),'YYYY-MM-DD'),
  'planned_amount_cents',v.amount_cents,
  'category_id',v.category_id,
  'payment_method_id',v.payment_method_id,
  'observation',a.observation,
  'fixed_account_id',account_id,
  'fixed_version_id',account_id||':v:'||to_char(v.effective_month,'YYYY-MM'));
end $$;

create or replace function workspace_private.publish_revision(target uuid, opid uuid, records jsonb)
returns bigint language plpgsql security invoker set search_path='' as $$
declare newrevision bigint;
begin
 update workspace_private.spaces set revision=revision+1 where id=target returning revision into newrevision;
 update public.workspace_heads set revision=newrevision where workspace_id=target;
 insert into workspace_private.changes values(target,newrevision,opid,records);
 return newrevision;
end $$;

create or replace function workspace_private.materialize_fixed_credit(p_actor uuid, p_input jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare target uuid; opid uuid; w workspace_private.spaces; m workspace_private.members; done workspace_private.operations;
 hashed text; actor_email text; month date; body jsonb; dead boolean; inserted text; rowdata jsonb; newrevision bigint; response jsonb;
begin
 select lower(btrim(a.identity_data->>'email')) into actor_email from auth.identities a join auth.users u on u.id=a.user_id where a.user_id=p_actor and a.provider='google' and a.identity_data->>'email_verified'='true' and u.email_confirmed_at is not null limit 1;
 if actor_email is null then raise exception 'verified_identity_required' using errcode='28000';end if;
 perform set_config('vertice.actor',p_actor::text,true);
 target:=(p_input->>'workspace_id')::uuid; opid:=(p_input->>'operation_id')::uuid;
 select * into w from workspace_private.spaces where id=target for update;
 select * into m from workspace_private.members where workspace_id=target and user_id=p_actor and active;
 if w.id is null or m.user_id is null or (w.status='closed' and w.owner_user_id<>p_actor) then raise exception 'removed' using errcode='42501';end if;
 if (p_input->>'generation')::int is distinct from m.generation then raise exception 'generation' using errcode='42501';end if;
 hashed:=encode(sha256(convert_to(p_input::text,'UTF8')),'hex');
 select * into done from workspace_private.operations where workspace_id=target and id=opid;
 if found then if done.digest<>hashed or done.actor_id<>p_actor then raise exception 'operation_reused' using errcode='23505';end if;return done.result;end if;
 month:=to_date(p_input->>'competence_month','YYYY-MM');
 if coalesce(p_input->>'time_zone','')='' then raise exception 'time_zone_required' using errcode='22023';end if;
 -- competência corrente pelo fuso IANA do dispositivo (mesma convenção de data local do aplicativo)
 if month<>date_trunc('month',now() at time zone (p_input->>'time_zone'))::date then
  response:=jsonb_build_object('status','not_current');
 else
  body:=workspace_private.fixed_credit_row(target,p_input->>'account_id',month);
  if body is null then
   response:=jsonb_build_object('status','not_eligible');
  else
   select (deleted_at is not null) into dead from public.finance_entries where workspace_id=target and fixed_account_id=p_input->>'account_id' and competence_month=month;
   if found then
    response:=jsonb_build_object('status',case when dead then 'tombstoned' else 'exists' end);
   else
    insert into public.finance_entries(workspace_id,id,source,kind,name,competence_month,reference_date,planned_amount_cents,settlement_discount_cents,category_id,payment_method_id,observation,fixed_account_id,fixed_version_id,shopping_list_id,extra)
    select target,body->>'id','fixed','expense',x.name,x.competence_month,x.reference_date,x.planned_amount_cents,0,x.category_id,x.payment_method_id,x.observation,x.fixed_account_id,x.fixed_version_id,null,'{}'::jsonb
    from jsonb_to_record(body) x(name text,competence_month date,reference_date date,planned_amount_cents bigint,category_id text,payment_method_id text,observation text,fixed_account_id text,fixed_version_id text)
    on conflict do nothing returning id into inserted;
    if inserted is null then
     response:=jsonb_build_object('status','exists');
    else
     select to_jsonb(t) into rowdata from public.finance_entries t where t.workspace_id=target and t.id=inserted;
     newrevision:=workspace_private.publish_revision(target,opid,jsonb_build_array(jsonb_build_object('entity','finance_entries','id',inserted,'body',rowdata)));
     response:=jsonb_build_object('status','inserted','revision',newrevision,'records',jsonb_build_array(jsonb_build_object('entity','finance_entries','id',inserted,'body',rowdata)));
    end if;
   end if;
  end if;
 end if;
 insert into workspace_private.operations values(target,opid,p_actor,hashed,response);
 return response;
end $$;

create or replace function workspace_private.finance_fixed_end_sweep(p_actor uuid, p_input jsonb, p_result jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare target uuid; opid uuid; acc text; em date; r record; records jsonb:='[]'; newrevision bigint;
begin
 target:=(p_input->>'workspace_id')::uuid; opid:=(p_input->'operation'->>'id')::uuid;
 for acc in select distinct x->>'id' from jsonb_array_elements(coalesce(p_input->'operation'->'changes','[]'::jsonb)) x where x->>'entity'='finance_fixed_accounts' loop
  select end_month into em from public.finance_fixed_accounts where workspace_id=target and id=acc and deleted_at is null;
  if em is null then continue;end if;
  for r in select * from public.finance_entries where workspace_id=target and fixed_account_id=acc and source='fixed' and payment_method_id='P4' and deleted_at is null and competence_month>em loop
   if exists(select 1 from public.finance_payments p where p.workspace_id=target and p.entry_id=r.id and p.deleted_at is null) or r.local_override_cents is not null or r.extra<>'{}'::jsonb then
    raise exception 'Crédito posterior ao término tem pagamento ou ajuste; revise antes de encerrar a conta.' using errcode='23514';
   end if;
   update public.finance_entries set deleted_at=now() where workspace_id=target and id=r.id;
   records:=records||jsonb_build_array(jsonb_build_object('entity','finance_entries','id',r.id,'body',(select to_jsonb(t) from public.finance_entries t where t.workspace_id=target and t.id=r.id)));
  end loop;
 end loop;
 if jsonb_array_length(records)=0 then return p_result;end if;
 newrevision:=workspace_private.publish_revision(target,opid,records);
 p_result:=jsonb_build_object('revision',newrevision,'records',coalesce(p_result->'records','[]'::jsonb)||records);
 update workspace_private.operations set result=p_result where workspace_id=target and id=opid;
 return p_result;
end $$;

revoke all on function workspace_private.fixed_credit_row(uuid,text,date),workspace_private.publish_revision(uuid,uuid,jsonb),workspace_private.materialize_fixed_credit(uuid,jsonb),workspace_private.finance_fixed_end_sweep(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function workspace_private.fixed_credit_row(uuid,text,date),workspace_private.publish_revision(uuid,uuid,jsonb),workspace_private.materialize_fixed_credit(uuid,jsonb),workspace_private.finance_fixed_end_sweep(uuid,jsonb,jsonb) to service_role;

-- Regras financeiras de crédito e séries, validadas no servidor dentro de workspace_command.
-- Identidade estável: a forma Crédito é o id 'P4', nunca o nome exibido.
-- Estado de pagamento: finance_payments (movement_type='payment'); finance_entries não tem coluna paid.
-- Escopo: só lançamentos e séries tocados pela operação são validados. Dados antigos não tocados
-- não são revalidados. Qualquer falha gera exceção e a operação inteira é desfeita.

create or replace function workspace_private.finance_pre_snapshot(p_action text, p_input jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare target uuid; ids text[]; result jsonb:='{}'::jsonb;
begin
 if p_action<>'apply' then return result;end if;
 target:=(p_input->>'workspace_id')::uuid;
 select coalesce(array_agg(distinct x->>'id'),'{}') into ids
  from jsonb_array_elements(coalesce(p_input->'operation'->'changes','[]'::jsonb)) x
  where x->>'entity'='finance_entries';
 select coalesce(jsonb_object_agg(r.id,jsonb_build_object('credit',r.payment_method_id='P4','seriesId',r.extra->>'seriesId')),'{}'::jsonb) into result
  from public.finance_entries r where r.workspace_id=target and r.id=any(ids) and r.deleted_at is null;
 return result;
end $$;

create or replace function workspace_private.finance_post_check(p_action text, p_input jsonb, op jsonb, pre jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare target uuid; touched text[]; series text[]; rid text; r record; sid text; n int; kind text; kinds int; forms int;
begin
 if p_action<>'apply' or op is null then return;end if;
 target:=(p_input->>'workspace_id')::uuid;
 select coalesce(array_agg(distinct v),'{}') into touched from (
   select x->>'id' v from jsonb_array_elements(coalesce(op->'changes','[]'::jsonb)) x where x->>'entity'='finance_entries'
   union
   select x->'body'->>'entry_id' v from jsonb_array_elements(coalesce(op->'changes','[]'::jsonb)) x where x->>'entity'='finance_payments'
 ) t where v is not null;
 foreach rid in array touched loop
  select * into r from public.finance_entries e where e.workspace_id=target and e.id=rid and e.deleted_at is null;
  continue when not found;
  if r.extra ? 'walletId' and r.payment_method_id='P4' then
   raise exception 'Crédito não movimenta carteira.' using errcode='23514';
  end if;
  if pre ? rid and pre->rid->>'seriesId' is not null and (pre->rid->>'credit')::boolean is distinct from (r.payment_method_id='P4') then
   raise exception 'A forma de pagamento de uma série não pode mudar entre crédito e as demais formas.' using errcode='23514';
  end if;
  if r.payment_method_id='P4' then
   if r.source='fixed' then
    if exists(select 1 from public.finance_payments p where p.workspace_id=target and p.entry_id=rid and p.deleted_at is null) then
     raise exception 'Conta fixa de crédito não tem pagamento registrado.' using errcode='23514';
    end if;
   else
    if not exists(select 1 from public.finance_payments p where p.workspace_id=target and p.entry_id=rid and p.deleted_at is null and p.movement_type='payment') then
     raise exception 'Lançamento de crédito deve ser reconhecido.' using errcode='23514';
    end if;
    if exists(select 1 from public.finance_payments p where p.workspace_id=target and p.entry_id=rid and p.deleted_at is null and p.wallet_id is not null) then
     raise exception 'Crédito não movimenta carteira.' using errcode='23514';
    end if;
   end if;
  end if;
 end loop;
 select coalesce(array_agg(distinct v),'{}') into series from (
   select e.extra->>'seriesId' v from public.finance_entries e where e.workspace_id=target and e.id=any(touched) and e.extra ? 'seriesId'
   union
   select pre->i->>'seriesId' v from jsonb_object_keys(coalesce(pre,'{}'::jsonb)) i
   union
   select x->'body'->'extra'->>'seriesId' v from jsonb_array_elements(coalesce(op->'changes','[]'::jsonb)) x where x->>'entity'='finance_entries'
 ) t where v is not null;
 foreach sid in array series loop
  select count(*), count(distinct e.extra->>'seriesKind'), count(distinct (e.payment_method_id='P4')), min(e.extra->>'seriesKind')
   into n, kinds, forms, kind
   from public.finance_entries e where e.workspace_id=target and e.deleted_at is null and e.extra->>'seriesId'=sid;
  continue when n=0;
  if exists(select 1 from public.finance_entries e where e.workspace_id=target and e.deleted_at is null and e.extra->>'seriesId'=sid and coalesce(e.extra->>'seriesKind','') not in ('repeat','installments')) then
   raise exception 'Série inválida.' using errcode='23514';
  end if;
  if kinds>1 then raise exception 'Série com tipos misturados.' using errcode='23514';end if;
  if forms>1 then raise exception 'A forma de pagamento de uma série não pode mudar entre crédito e as demais formas.' using errcode='23514';end if;
  if exists(select 1 from public.finance_entries e where e.workspace_id=target and e.deleted_at is null and e.extra->>'seriesId'=sid and left(e.id,length(sid)+1)<>sid||':') then
   raise exception 'Identificador de série inconsistente.' using errcode='23514';
  end if;
  if kind='installments' then
   if exists(select 1 from public.finance_entries e where e.workspace_id=target and e.deleted_at is null and e.extra->>'seriesId'=sid
       and ((e.extra->>'seriesCount')::int<>n or (e.extra->>'seriesIndex')::int not between 1 and n)) then
    raise exception 'Sequência de parcelas inconsistente.' using errcode='23514';
   end if;
   if (select count(distinct (e.extra->>'seriesIndex')::int) from public.finance_entries e where e.workspace_id=target and e.deleted_at is null and e.extra->>'seriesId'=sid)<>n then
    raise exception 'Sequência de parcelas inconsistente.' using errcode='23514';
   end if;
  else
   if (select count(distinct e.extra->>'seriesCount') from public.finance_entries e where e.workspace_id=target and e.deleted_at is null and e.extra->>'seriesId'=sid)<>1 then
    raise exception 'Posições de repetição inconsistentes.' using errcode='23514';
   end if;
   if exists(select 1 from public.finance_entries e where e.workspace_id=target and e.deleted_at is null and e.extra->>'seriesId'=sid
       and (e.extra->>'seriesIndex')::int not between 1 and (e.extra->>'seriesCount')::int) then
    raise exception 'Posições de repetição inconsistentes.' using errcode='23514';
   end if;
   -- Lacunas são permitidas em repetição (regra do domínio); só posições duplicadas são recusadas abaixo.
   if (select count(distinct (e.extra->>'seriesIndex')::int) from public.finance_entries e where e.workspace_id=target and e.deleted_at is null and e.extra->>'seriesId'=sid)<>n then
    raise exception 'Posições de repetição inconsistentes.' using errcode='23514';
   end if;
  end if;
 end loop;
end $$;

revoke all on function workspace_private.finance_pre_snapshot(text,jsonb) from public,anon,authenticated;
revoke all on function workspace_private.finance_post_check(text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function workspace_private.finance_pre_snapshot(text,jsonb) to service_role;
grant execute on function workspace_private.finance_post_check(text,jsonb,jsonb,jsonb) to service_role;

create or replace function public.workspace_command(p_actor uuid,p_action text,p_input jsonb default '{}'::jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; target uuid; op jsonb; e record; pre jsonb;
begin
 if p_action='materialize_fixed_credit' then return workspace_private.materialize_fixed_credit(p_actor,p_input);end if;
 if p_action in ('apply','copy') then
  op:=case when p_action='apply' then p_input->'operation' else p_input end;
  if coalesce(op->>'ledger_version','')<>'2' and (
   exists(select 1 from jsonb_array_elements(coalesce(op->'changes','[]')) x where x->>'entity' in ('finance_wallets','finance_moves') or (x->'body'->'extra') <> '{}'::jsonb)
   or exists(select 1 from jsonb_array_elements(coalesce(op->'changes','[]')) x join public.finance_entries ent on ent.workspace_id=(p_input->>'workspace_id')::uuid and ent.id=case when x->>'entity'='finance_entries' then x->>'id' when x->>'entity'='finance_payments' then x->'body'->>'entry_id' end where ent.extra<>'{}'::jsonb)
   or (p_action='copy' and exists(select 1 from public.finance_wallets where workspace_id=(p_input->>'source_id')::uuid and deleted_at is null))
  ) then raise exception 'client_update_required' using errcode='23514';end if;
 end if;
 pre:=workspace_private.finance_pre_snapshot(p_action,p_input);
 result:=workspace_private.workspace_command_ledger_base(p_actor,p_action,p_input);
 if p_action not in ('apply','copy') then return result;end if;
 if p_action='apply' and not exists(select 1 from jsonb_array_elements(coalesce(op->'changes','[]')) x where x->>'entity' like 'finance_%') then return result;end if;
 target:=(p_input->>'workspace_id')::uuid;
 perform workspace_private.finance_post_check(p_action,p_input,op,pre);
 -- Every reference is scoped to the same workspace, including JSON metadata.
 for e in select r.* from public.finance_entries r where r.workspace_id=target and r.deleted_at is null and (p_action='copy' or exists(select 1 from jsonb_array_elements(coalesce(op->'changes','[]')) x where (x->>'entity'='finance_entries' and x->>'id'=r.id) or (x->>'entity'='finance_payments' and x->'body'->>'entry_id'=r.id) or (x->>'entity'='finance_wallets' and x->>'id'=r.extra->>'walletId'))) loop
  if exists(select 1 from jsonb_object_keys(e.extra) k where k not in ('walletId','seriesId','seriesKind','seriesIndex','seriesCount')) then raise exception 'Unknown entry metadata' using errcode='23514';end if;
  if e.extra ? 'walletId' and not exists(select 1 from public.finance_wallets where workspace_id=target and id=e.extra->>'walletId' and deleted_at is null) then raise exception 'Invalid wallet reference' using errcode='23503';end if;
  if e.extra ? 'seriesId' and (coalesce(e.extra->>'seriesKind','') not in ('repeat','installments') or (e.extra->>'seriesIndex')::int not between 1 and (e.extra->>'seriesCount')::int or (e.extra->>'seriesCount')::int not between 2 and 120) then raise exception 'Invalid installment series' using errcode='23514';end if;
 end loop;
 if exists(select 1 from public.finance_moves m join public.finance_wallets w on w.workspace_id=m.workspace_id and w.id=m.from_wallet_id where m.workspace_id=target and m.deleted_at is null and (w.deleted_at is not null or m.movement_date<w.opening_date)) then raise exception 'Invalid movement date or wallet' using errcode='23514';end if;
 if p_action='apply' then result:=workspace_private.finance_fixed_end_sweep(p_actor,p_input,result);end if;
 return result;
end $$;
