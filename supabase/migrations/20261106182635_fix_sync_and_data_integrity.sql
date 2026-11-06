create or replace function private.get_life_market_quote(p_cache_key text)
returns double precision language plpgsql security invoker set search_path = '' as $$
declare
  quote_value double precision;
  api_key text;
  params jsonb;
  response extensions.http_response;
  payload jsonb;
  price_text text;
  last_request_at timestamptz;
  today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_cache_key is null or length(p_cache_key) > 80 or p_cache_key !~ '^(stock:[A-Z0-9][A-Z0-9.\^-]{0,24}|metal:(GOLD|SILVER)|fx:[A-Z]{3,10}:[A-Z]{3,10})$' then
    raise exception 'Invalid market quote key';
  end if;
  -- Serialize misses across clients and the midnight snapshot job.
  perform pg_advisory_xact_lock(hashtextextended('life.daily-asset-snapshots', 0));
  select value into quote_value from public.life_market_quotes
    where cache_key = p_cache_key and fetched_on = today;
  if found then return quote_value; end if;
  select decrypted_secret into api_key from vault.decrypted_secrets
    where name = 'life_alpha_vantage_api_key';
  if nullif(api_key, '') is null then raise exception 'Missing LIFE Alpha Vantage API key in Vault'; end if;
  select max(updated_at) into last_request_at from public.life_market_quotes;
  if last_request_at is not null then
    perform pg_sleep(greatest(0, 12 - extract(epoch from clock_timestamp() - last_request_at)));
  end if;
  params := case split_part(p_cache_key, ':', 1)
    when 'stock' then jsonb_build_object('function', 'GLOBAL_QUOTE', 'symbol', split_part(p_cache_key, ':', 2))
    when 'metal' then jsonb_build_object('function', 'GOLD_SILVER_SPOT', 'symbol', split_part(p_cache_key, ':', 2))
    when 'fx' then jsonb_build_object('function', 'CURRENCY_EXCHANGE_RATE',
      'from_currency', split_part(p_cache_key, ':', 2), 'to_currency', split_part(p_cache_key, ':', 3))
  end || jsonb_build_object('apikey', api_key);
  begin
    response := extensions.http_get('https://www.alphavantage.co/query', params);
    if response.status <> 200 then raise exception 'Quote request failed'; end if;
    payload := response.content::jsonb;
    price_text := case split_part(p_cache_key, ':', 1)
      when 'stock' then payload #>> '{Global Quote,05. price}'
      when 'metal' then payload ->> 'price'
      when 'fx' then payload #>> '{Realtime Currency Exchange Rate,5. Exchange Rate}' end;
    quote_value := price_text::double precision;
    if quote_value is null or not (quote_value > 0 and quote_value < 'Infinity'::double precision) then
      raise exception 'Invalid quote';
    end if;
  exception when others then
    raise exception 'Market quote refresh failed';
  end;
  insert into public.life_market_quotes(cache_key,value,fetched_on,updated_at)
    values(p_cache_key,quote_value,today,clock_timestamp())
    on conflict(cache_key) do update set value=excluded.value, fetched_on=excluded.fetched_on, updated_at=excluded.updated_at;
  return quote_value;
end;
$$;
revoke all on function private.get_life_market_quote(text) from public, anon, authenticated;
create or replace function public.get_life_market_quote(p_cache_key text)
returns double precision language plpgsql security definer set search_path = ''
set statement_timeout = '55s' set lock_timeout = '45s' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return private.get_life_market_quote(p_cache_key);
end;
$$;
revoke all on function public.get_life_market_quote(text) from public, anon, authenticated;
grant execute on function public.get_life_market_quote(text) to authenticated;

-- A foreground quote request must not make the once-daily snapshot skip its run.
do $migration$
declare definition text;
begin
  definition := pg_get_functiondef('private.snapshot_daily_assets(date)'::regprocedure);
  definition := replace(definition,
    $old$if not pg_try_advisory_xact_lock(hashtextextended('life.daily-asset-snapshots', 0)) then
    raise exception 'Daily asset snapshot is already running';
  end if;$old$,
    $new$perform pg_advisory_xact_lock(hashtextextended('life.daily-asset-snapshots', 0));$new$);
  execute definition;
end;
$migration$;

-- Every writer, including older clients, advances the conflict token.
create or replace function private.stamp_life_object_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;
revoke all on function private.stamp_life_object_update() from public, anon, authenticated;
create trigger stamp_life_object_update before update on public.life_objects
for each row execute function private.stamp_life_object_update();

-- Keep links until both endpoints have returned, regardless of restore order.
create table public.life_deleted_relationships (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id text not null,
  target_id text not null,
  kind text not null check (kind in ('related','supports','part_of')),
  created_at timestamptz not null,
  check (source_id <> target_id)
);
alter table public.life_deleted_relationships enable row level security;
create policy deleted_relationships_own on public.life_deleted_relationships
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, delete on public.life_deleted_relationships to authenticated;
revoke all on public.life_deleted_relationships from anon;
create or replace function private.archive_deleted_life_object()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if pg_trigger_depth() = 1 and old.type in ('project','note','journal','goal') then
    insert into public.life_deleted_objects(id,user_id,object_data) values(old.id,old.user_id,to_jsonb(old));
    insert into public.life_deleted_relationships(id,user_id,source_id,target_id,kind,created_at)
      select id,user_id,source_id,target_id,kind,created_at from public.life_relationships
      where user_id = old.user_id and (source_id = old.id or target_id = old.id)
      on conflict do nothing;
  end if;
  return old;
end;
$$;
create or replace function public.restore_deleted_life_object(target_id text)
returns text language plpgsql security invoker set search_path = '' as $$
declare saved public.life_deleted_objects; restored public.life_objects;
begin
  perform pg_advisory_xact_lock(hashtextextended('life.restore:' || target_id, 0));
  select * into saved from public.life_deleted_objects where id=target_id and user_id=(select auth.uid());
  if not found then raise exception 'Deleted item not found'; end if;
  restored := jsonb_populate_record(null::public.life_objects,saved.object_data);
  restored.visibility := 'private'; restored.share_token := null; restored.updated_at := clock_timestamp();
  if restored.folder_id is not null and not exists(select 1 from public.life_note_folders where id=restored.folder_id and user_id=(select auth.uid())) then restored.folder_id := null; end if;
  insert into public.life_objects select restored.*;
  insert into public.life_relationships(id,user_id,source_id,target_id,kind,created_at)
    select r.id,r.user_id,r.source_id,r.target_id,r.kind,r.created_at
    from public.life_deleted_relationships r
    join public.life_objects s on s.id=r.source_id and s.user_id=r.user_id
    join public.life_objects t on t.id=r.target_id and t.user_id=r.user_id
    where r.user_id=(select auth.uid()) on conflict do nothing;
  delete from public.life_deleted_relationships r where r.user_id=(select auth.uid())
    and exists(select 1 from public.life_relationships l where l.user_id=r.user_id and l.source_id=r.source_id and l.target_id=r.target_id and l.kind=r.kind);
  delete from public.life_deleted_objects where id=saved.id and user_id=(select auth.uid());
  return saved.id;
end;
$$;
create or replace function private.clean_deleted_life_relationships()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists(select 1 from public.life_objects where id=old.id and user_id=old.user_id) then
    delete from public.life_deleted_relationships where user_id=old.user_id and (source_id=old.id or target_id=old.id);
  end if;
  return old;
end;
$$;
revoke all on function private.clean_deleted_life_relationships() from public, anon, authenticated;
create trigger clean_deleted_life_relationships after delete on public.life_deleted_objects
for each row execute function private.clean_deleted_life_relationships();

-- The web uses the same private channel for object, folder and link changes.
create trigger broadcast_life_relationship_change after insert or update or delete on public.life_relationships
for each row execute function private.broadcast_life_object_change();
create trigger broadcast_life_note_folder_change after insert or update or delete on public.life_note_folders
for each row execute function private.broadcast_life_object_change();
