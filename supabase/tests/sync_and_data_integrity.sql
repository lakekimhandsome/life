-- Run as postgres after the migration. All fixtures and transport mocks roll back.
begin;
do $$ begin
  assert pg_get_functiondef('private.snapshot_daily_assets(date)'::regprocedure) not like '%pg_try_advisory_xact_lock%', 'Snapshots must wait for foreground quote refreshes';
  assert (select proconfig @> array['statement_timeout=55s'] from pg_proc where oid='public.get_life_market_quote(text)'::regprocedure), 'Quote RPC must allow the 12-second provider interval';
end $$;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000201','integrity-owner@example.invalid'),
 ('00000000-0000-4000-8000-000000000202','integrity-other@example.invalid');
insert into public.life_objects(id,user_id,type,title,occurred_at) values
 ('integrity-a','00000000-0000-4000-8000-000000000201','note','A',now()),
 ('integrity-b','00000000-0000-4000-8000-000000000201','project','B',now());
insert into public.life_relationships(id,user_id,source_id,target_id,kind) values
 ('integrity-link','00000000-0000-4000-8000-000000000201','integrity-a','integrity-b','related');
insert into public.life_market_quotes(cache_key,value,fetched_on,updated_at)
 values('stock:INTEGRITYTEST',123,(now() at time zone 'Asia/Seoul')::date,clock_timestamp());
-- Mock only external HTTP and waiting; keep authorization and cache writes real.
create temp table integrity_quote_requests(params jsonb);
create function pg_temp.integrity_http_get(uri varchar, data jsonb)
returns extensions.http_response language plpgsql as $$
declare payload jsonb;
begin
  assert uri='https://www.alphavantage.co/query';
  assert nullif(data->>'apikey','') is not null;
  insert into integrity_quote_requests values(data - 'apikey');
  payload := jsonb_build_object('Global Quote',jsonb_build_object('05. price',
    coalesce(nullif(current_setting('life.test_quote_price',true),''),'321')));
  return (200,'application/json',null,payload::text)::extensions.http_response;
end;
$$;
create function pg_temp.integrity_no_sleep(seconds double precision)
returns void language plpgsql as $$ begin return; end; $$;
do $$ begin
  execute replace(replace(pg_get_functiondef('private.get_life_market_quote(text)'::regprocedure),
    'extensions.http_get(', 'pg_temp.integrity_http_get('), 'pg_sleep(', 'pg_temp.integrity_no_sleep(');
end $$;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000201';
do $$
declare previous_version timestamptz; affected integer;
begin
  assert not has_table_privilege('authenticated','public.life_market_quotes','insert');
  assert not has_table_privilege('authenticated','public.life_market_quotes','update');
  assert not has_function_privilege('anon','public.get_life_market_quote(text)','execute');
  assert not has_schema_privilege('authenticated','private','usage');
  assert public.get_life_market_quote('stock:INTEGRITYTEST') = 123;
  assert public.get_life_market_quote('stock:INTEGRITYMISS') = 321;
  assert public.get_life_market_quote('stock:INTEGRITYMISS') = 321;
  perform set_config('life.test_quote_price','0',true);
  begin
    perform public.get_life_market_quote('stock:INTEGRITYFAIL');
    raise exception 'Invalid upstream quote was cached';
  exception when raise_exception then assert sqlerrm='Market quote refresh failed'; end;
  assert not exists(select 1 from public.life_market_quotes where cache_key='stock:INTEGRITYFAIL');
  begin
    update public.life_market_quotes set value=1 where cache_key='stock:INTEGRITYTEST';
    raise exception 'Shared quote poisoning allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.get_life_market_quote('https://invalid.example/');
    raise exception 'Invalid quote key allowed';
  exception when raise_exception then assert sqlerrm='Invalid market quote key'; end;
  select updated_at into previous_version from public.life_objects where id='integrity-a';
  update public.life_objects set title='External edit' where id='integrity-a';
  update public.life_objects set title='Stale edit' where id='integrity-a' and updated_at=previous_version;
  get diagnostics affected = row_count;
  assert affected=0, 'Stale versions must not overwrite another writer';
  assert (select title='External edit' from public.life_objects where id='integrity-a');
  delete from public.life_objects where id in ('integrity-a','integrity-b');
  assert not exists(select 1 from public.life_relationships where id='integrity-link');
  assert exists(select 1 from public.life_deleted_relationships where id='integrity-link');
end;
$$;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000202';
do $$ begin
  assert not exists(select 1 from public.life_deleted_relationships where id='integrity-link');
end $$;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000201';
-- Restore the endpoint that was deleted first, then the second endpoint.
select public.restore_deleted_life_object('integrity-a');
do $$ begin assert not exists(select 1 from public.life_relationships where id='integrity-link'); end $$;
select public.restore_deleted_life_object('integrity-b');
do $$ begin
  assert exists(select 1 from public.life_relationships where id='integrity-link');
  assert not exists(select 1 from public.life_deleted_relationships where id='integrity-link');
end $$;
-- Repeat with the opposite restore order.
delete from public.life_objects where id='integrity-a';
delete from public.life_objects where id='integrity-b';
select public.restore_deleted_life_object('integrity-b');
select public.restore_deleted_life_object('integrity-a');
do $$ begin assert exists(select 1 from public.life_relationships where id='integrity-link'); end $$;
-- Permanent deletion must remove links that can no longer be restored.
delete from public.life_objects where id='integrity-a';
delete from public.life_deleted_objects where id='integrity-a';
do $$ begin assert not exists(select 1 from public.life_deleted_relationships where id='integrity-link'); end $$;
reset role;
do $$ begin assert (select count(*)=1 from integrity_quote_requests), 'Fresh quotes must reuse the verified cache'; end $$;
select 'sync and data integrity assertions passed' as result;
rollback;
