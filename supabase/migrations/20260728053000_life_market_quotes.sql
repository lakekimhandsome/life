-- Shared daily market quote cache (stock / FX / metal).
-- One row per cache_key; fetched_on marks the calendar day (Asia/Seoul) of the quote.

create table if not exists public.life_market_quotes (
  cache_key text primary key,
  value double precision not null,
  fetched_on date not null,
  updated_at timestamptz not null default now()
);

create index if not exists life_market_quotes_fetched_on_idx
  on public.life_market_quotes (fetched_on);

alter table public.life_market_quotes enable row level security;

drop policy if exists "life_market_quotes_select_authenticated" on public.life_market_quotes;
drop policy if exists "life_market_quotes_insert_authenticated" on public.life_market_quotes;
drop policy if exists "life_market_quotes_update_authenticated" on public.life_market_quotes;

create policy "life_market_quotes_select_authenticated"
  on public.life_market_quotes for select
  to authenticated
  using (true);

create policy "life_market_quotes_insert_authenticated"
  on public.life_market_quotes for insert
  to authenticated
  with check (true);

create policy "life_market_quotes_update_authenticated"
  on public.life_market_quotes for update
  to authenticated
  using (true)
  with check (true);

grant select, insert, update on public.life_market_quotes to authenticated;
