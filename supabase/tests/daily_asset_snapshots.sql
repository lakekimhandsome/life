-- Run as postgres after the migration. All fixtures, mocks and writes roll back.
begin;

select vault.create_secret('snapshot-test-key', 'life_alpha_vantage_api_key')
where not exists (select 1 from vault.secrets where name='life_alpha_vantage_api_key');

create temp table quote_requests(params jsonb);
create or replace function pg_temp.http_get(uri varchar, data jsonb)
returns extensions.http_response
language plpgsql as $$
declare
  payload jsonb;
  mode text := current_setting('life.test_quote_mode', true);
begin
  assert uri = 'https://www.alphavantage.co/query';
  assert nullif(data ->> 'apikey', '') is not null;
  insert into quote_requests values (data - 'apikey');
  if mode = 'http_error' then return (503, 'application/json', null, '{}')::extensions.http_response; end if;
  if mode = 'invalid_json' then return (200, 'text/html', null, '<html>error</html>')::extensions.http_response; end if;
  if mode = 'quota' then return (200, 'application/json', null, '{"Information":"rate limit"}')::extensions.http_response; end if;
  payload := case data ->> 'function'
    when 'GLOBAL_QUOTE' then jsonb_build_object('Global Quote', jsonb_build_object('05. price', '100'))
    when 'GOLD_SILVER_SPOT' then '{"price":"2000"}'::jsonb
    when 'CURRENCY_EXCHANGE_RATE' then jsonb_build_object('Realtime Currency Exchange Rate',
      jsonb_build_object('5. Exchange Rate', case when mode in ('NaN', 'Infinity', '0', '-1') then mode
        when data ->> 'from_currency' = 'JPY' then '10' else '1400' end))
  end;
  return (200, 'application/json', null, payload::text)::extensions.http_response;
end;
$$;

-- Redirect only the HTTP transport inside this uncommitted test transaction.
do $$
begin
  execute replace(pg_get_functiondef('private.snapshot_daily_assets(date)'::regprocedure),
    'extensions.http_get(', 'pg_temp.http_get(');
end;
$$;

insert into auth.users(id,email) values
  ('00000000-0000-4000-8000-000000000101','daily-snapshot-test-1@example.invalid'),
  ('00000000-0000-4000-8000-000000000102','daily-snapshot-test-2@example.invalid'),
  ('00000000-0000-4000-8000-000000000103','daily-snapshot-test-3@example.invalid');
insert into public.life_objects(id, user_id, type, title, occurred_at, meta)
select 'daily-test-' || n, ('00000000-0000-4000-8000-00000000010' || u)::uuid,
  'asset', 'snapshot test', now(), meta::jsonb
from (values
  (1,1,'{"kind":"stock","symbol":" aapl ","quantity":2}'),
  (2,1,'{"kind":"commodity","symbol":"GOLD","quantity":31.1034768}'),
  (3,1,'{"kind":"cash","symbol":"KRW","quantity":500}'),
  (4,1,'{"kind":"debt","symbol":"KRW","quantity":100}'),
  (5,2,'{"kind":"stock","symbol":"AAPL","quantity":1}'),
  (6,2,'{"kind":"real_estate","symbol":"JPY","quantity":100}'),
  (7,2,'{"kind":"cash","symbol":"USD","quantity":10}'),
  (8,3,'{"kind":"stock","symbol":"AAPL","quantity":1}'),
  (9,3,'{"kind":"stock","symbol":"","quantity":1}')
) fixture(n,u,meta);
-- A pre-existing daily record must survive reruns.
insert into public.asset_history(id,user_id,recorded_at,total_value)
values ('daily-test-existing','00000000-0000-4000-8000-000000000102',
  (now() at time zone 'Asia/Seoul')::date,123);
-- Seed a deliberately stale quote, including the invalid-value failure cases.
insert into public.life_market_quotes(cache_key,value,fetched_on,updated_at)
values ('fx:JPY:KRW',1,'2000-01-01','2000-01-01')
on conflict (cache_key) do update set value=1,fetched_on='2000-01-01',updated_at='2000-01-01';

do $$
declare
  mode text;
  message text;
  test_day date := (now() at time zone 'Asia/Seoul')::date;
begin
  foreach mode in array array['http_error','invalid_json','quota','NaN','Infinity','0','-1'] loop
    perform set_config('life.test_quote_mode',mode,true);
    begin
      perform private.snapshot_daily_assets();
      raise exception 'Expected refresh failure';
    exception when raise_exception then
      get stacked diagnostics message = message_text;
      assert message like 'Market quote refresh failed for fx:JPY:KRW;%';
    end;
    assert not exists (select 1 from public.asset_history
      where user_id='00000000-0000-4000-8000-000000000101' and recorded_at=test_day);
    assert (select fetched_on='2000-01-01'::date and value=1 from public.life_market_quotes
      where cache_key='fx:JPY:KRW');
  end loop;
  perform set_config('life.test_quote_mode','ok',true);
  perform private.snapshot_daily_assets();
  assert (select abs(total_value - 3080400) < 0.01 from public.asset_history
    where user_id='00000000-0000-4000-8000-000000000101' and recorded_at=test_day);
  assert (select total_value=123 from public.asset_history where id='daily-test-existing');
  assert not exists (select 1 from public.asset_history
    where user_id='00000000-0000-4000-8000-000000000103' and recorded_at=test_day);
  assert (select fetched_on=test_day and value=10 from public.life_market_quotes where cache_key='fx:JPY:KRW');
  assert (select count(*)=1 from quote_requests where params->>'symbol'='AAPL');
  assert (select count(*)=1 from quote_requests where params->>'symbol'='GOLD');
  assert (select count(*)=1 from quote_requests where params->>'from_currency'='USD');
  assert not has_function_privilege('anon','private.snapshot_daily_assets(date)','execute');
  assert not has_function_privilege('authenticated','private.snapshot_daily_assets(date)','execute');
end;
$$;
select 'daily asset snapshot assertions passed' as result;
rollback;
