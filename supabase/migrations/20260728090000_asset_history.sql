-- Daily asset portfolio snapshots (one row per user per local calendar day).
-- kind_values keeps a flexible breakdown for future asset kinds / charts.

create table if not exists public.asset_history (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  recorded_at date not null,
  total_value double precision not null,
  cash_value double precision not null default 0,
  stock_value double precision not null default 0,
  material_value double precision not null default 0,
  crypto_value double precision not null default 0,
  kind_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint asset_history_user_day_unique unique (user_id, recorded_at)
);

create index if not exists asset_history_user_recorded_at_idx
  on public.asset_history (user_id, recorded_at asc);

alter table public.asset_history enable row level security;

drop policy if exists "asset_history_select_own" on public.asset_history;
drop policy if exists "asset_history_insert_own" on public.asset_history;
drop policy if exists "asset_history_update_own" on public.asset_history;
drop policy if exists "asset_history_delete_own" on public.asset_history;

create policy "asset_history_select_own"
  on public.asset_history for select
  using (auth.uid() = user_id);

create policy "asset_history_insert_own"
  on public.asset_history for insert
  with check (auth.uid() = user_id);

create policy "asset_history_update_own"
  on public.asset_history for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "asset_history_delete_own"
  on public.asset_history for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.asset_history to authenticated;
