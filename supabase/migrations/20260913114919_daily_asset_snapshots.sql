-- Snapshot every user's fully-valued asset portfolio at midnight in Korea.

create extension if not exists pg_cron;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.snapshot_daily_assets(
  p_recorded_at date default (now() at time zone 'Asia/Seoul')::date
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  inserted_count integer;
begin
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
          where cache_key = 'fx:' || symbol || ':KRW'
        )
        when kind = 'stock' then (
          select value
          from public.life_market_quotes
          where cache_key = 'stock:' || symbol
        ) * (
          select value
          from public.life_market_quotes
          where cache_key = 'fx:USD:KRW'
        )
        when kind = 'commodity' then (
          select value
          from public.life_market_quotes
          where cache_key = 'metal:' || case when symbol = 'SILVER' then 'SILVER' else 'GOLD' end
        ) * (
          select value
          from public.life_market_quotes
          where cache_key = 'fx:USD:KRW'
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

select cron.unschedule(jobid)
from cron.job
where jobname = 'daily-asset-snapshots';

-- pg_cron uses UTC: 15:00 UTC is 00:00 Asia/Seoul.
select cron.schedule(
  'daily-asset-snapshots',
  '0 15 * * *',
  'select private.snapshot_daily_assets();'
);
