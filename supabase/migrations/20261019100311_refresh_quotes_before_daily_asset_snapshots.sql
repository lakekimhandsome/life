-- Keep the existing midnight KST cron and valuation; refresh every required quote first.
-- Provision life_alpha_vantage_api_key in Vault separately (never commit the key).
create extension if not exists http with schema extensions;

create or replace function private.snapshot_daily_assets(
  p_recorded_at date default (now() at time zone 'Asia/Seoul')::date
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  inserted_count integer;
  quote_key text;
  quote_keys text[];
  api_key text;
  params jsonb;
  response extensions.http_response;
  payload jsonb;
  quote_value double precision;
  price_text text;
  refresh_started_at timestamptz := clock_timestamp();
  last_request_at timestamptz;
begin
  -- Do not overlap a manual run with the midnight job.
  if not pg_try_advisory_xact_lock(hashtextextended('life.daily-asset-snapshots', 0)) then
    raise exception 'Daily asset snapshot is already running';
  end if;

  select coalesce(array_agg(distinct key order by key), array[]::text[])
  into quote_keys
  from public.life_objects asset
  cross join lateral unnest(case
    when asset.meta ->> 'kind' in ('cash', 'real_estate', 'debt') then
      case when upper(trim(asset.meta ->> 'symbol')) = 'KRW' then array[]::text[]
        else array['fx:' || upper(trim(asset.meta ->> 'symbol')) || ':KRW'] end
    when asset.meta ->> 'kind' = 'stock' then
      array['stock:' || upper(trim(asset.meta ->> 'symbol')), 'fx:USD:KRW']
    when asset.meta ->> 'kind' = 'commodity' then
      array['metal:' || case when upper(trim(asset.meta ->> 'symbol')) = 'SILVER'
        then 'SILVER' else 'GOLD' end, 'fx:USD:KRW']
    else array[]::text[]
  end) as required(key)
  where asset.type = 'asset'
    and trim(asset.meta ->> 'symbol') <> ''
    and case when jsonb_typeof(asset.meta -> 'quantity') = 'number'
      then (asset.meta ->> 'quantity')::double precision > 0 else false end;

  if cardinality(quote_keys) > 0 then
    select decrypted_secret into api_key
    from vault.decrypted_secrets where name = 'life_alpha_vantage_api_key';
    if nullif(api_key, '') is null then
      raise exception 'Missing LIFE Alpha Vantage API key in Vault';
    end if;
  end if;

  foreach quote_key in array quote_keys loop
    -- Same 12-second request spacing as the app, shared across all users here.
    if last_request_at is not null then
      perform pg_sleep(greatest(0, 12 - extract(epoch from clock_timestamp() - last_request_at)));
    end if;
    last_request_at := clock_timestamp();
    params := case split_part(quote_key, ':', 1)
      when 'stock' then jsonb_build_object('function', 'GLOBAL_QUOTE',
        'symbol', split_part(quote_key, ':', 2))
      when 'metal' then jsonb_build_object('function', 'GOLD_SILVER_SPOT',
        'symbol', split_part(quote_key, ':', 2))
      when 'fx' then jsonb_build_object('function', 'CURRENCY_EXCHANGE_RATE',
        'from_currency', split_part(quote_key, ':', 2), 'to_currency', 'KRW')
    end || jsonb_build_object('apikey', api_key);

    begin
      response := extensions.http_get('https://www.alphavantage.co/query', params);
      if response.status <> 200 then
        raise exception 'Unsuccessful quote response';
      end if;
      payload := response.content::jsonb;
      price_text := case split_part(quote_key, ':', 1)
        when 'stock' then payload #>> '{Global Quote,05. price}'
        when 'metal' then payload ->> 'price'
        when 'fx' then payload #>> '{Realtime Currency Exchange Rate,5. Exchange Rate}'
      end;
      quote_value := price_text::double precision;
      if quote_value is null or not (quote_value > 0 and quote_value < 'Infinity'::double precision) then
        raise exception 'Missing or invalid quote';
      end if;
    exception when others then
      -- Never include the request URL/API key or fall back to stale cached prices.
      raise exception 'Market quote refresh failed for %; no daily snapshots saved', quote_key;
    end;

    insert into public.life_market_quotes(cache_key, value, fetched_on, updated_at)
    values (quote_key, quote_value, p_recorded_at, clock_timestamp())
    on conflict (cache_key) do update set
      value = excluded.value, fetched_on = excluded.fetched_on, updated_at = excluded.updated_at;
  end loop;

  with asset_rows as (
    select
      id,
      user_id,
      meta ->> 'kind' as kind,
      upper(trim(meta ->> 'symbol')) as symbol,
      case
        when jsonb_typeof(meta -> 'quantity') = 'number'
          then (meta ->> 'quantity')::double precision
      end as quantity
    from public.life_objects
    where type = 'asset'
  ),
  valued_assets as (
    select
      id,
      user_id,
      kind,
      quantity * case
        when kind in ('cash', 'real_estate', 'debt') and symbol = 'KRW' then 1
        when kind in ('cash', 'real_estate', 'debt') then (
          select value
          from public.life_market_quotes
          where updated_at >= refresh_started_at and fetched_on = p_recorded_at
            and cache_key = 'fx:' || symbol || ':KRW'
        )
        when kind = 'stock' then (
          select value
          from public.life_market_quotes
          where updated_at >= refresh_started_at and fetched_on = p_recorded_at
            and cache_key = 'stock:' || symbol
        ) * (
          select value
          from public.life_market_quotes
          where updated_at >= refresh_started_at and fetched_on = p_recorded_at
            and cache_key = 'fx:USD:KRW'
        )
        when kind = 'commodity' then (
          select value
          from public.life_market_quotes
          where updated_at >= refresh_started_at and fetched_on = p_recorded_at
            and cache_key = 'metal:' || case when symbol = 'SILVER' then 'SILVER' else 'GOLD' end
        ) * (
          select value
          from public.life_market_quotes
          where updated_at >= refresh_started_at and fetched_on = p_recorded_at
            and cache_key = 'fx:USD:KRW'
        ) / 31.1034768
      end as value_krw
    from asset_rows
    where kind in ('cash', 'stock', 'commodity', 'real_estate', 'debt')
      and symbol <> ''
      and quantity > 0
  ),
  portfolios as (
    select
      source.user_id,
      count(*) as asset_count,
      count(valued.value_krw) as valued_count,
      coalesce(sum(case when valued.kind = 'debt' then -valued.value_krw else valued.value_krw end), 0) as total_value,
      coalesce(sum(valued.value_krw) filter (where valued.kind = 'cash'), 0) as cash_value,
      coalesce(sum(valued.value_krw) filter (where valued.kind = 'stock'), 0) as stock_value,
      coalesce(sum(valued.value_krw) filter (where valued.kind = 'commodity'), 0) as material_value,
      jsonb_build_object(
        'cash', coalesce(sum(valued.value_krw) filter (where valued.kind = 'cash'), 0),
        'stock', coalesce(sum(valued.value_krw) filter (where valued.kind = 'stock'), 0),
        'commodity', coalesce(sum(valued.value_krw) filter (where valued.kind = 'commodity'), 0),
        'real_estate', coalesce(sum(valued.value_krw) filter (where valued.kind = 'real_estate'), 0),
        'debt', coalesce(sum(valued.value_krw) filter (where valued.kind = 'debt'), 0),
        'crypto', 0
      ) as kind_values
    from asset_rows source
    left join valued_assets valued
      on valued.id = source.id
    group by source.user_id
  )
  insert into public.asset_history (
    id,
    user_id,
    recorded_at,
    total_value,
    cash_value,
    stock_value,
    material_value,
    crypto_value,
    kind_values
  )
  select
    'daily:' || user_id::text || ':' || p_recorded_at::text,
    user_id,
    p_recorded_at,
    total_value,
    cash_value,
    stock_value,
    material_value,
    0,
    kind_values
  from portfolios
  where asset_count = valued_count
  on conflict (user_id, recorded_at) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function private.snapshot_daily_assets(date) from public, anon, authenticated;
