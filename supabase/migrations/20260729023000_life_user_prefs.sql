-- Per-user app preferences (hub card layout, etc.)

create table if not exists public.life_user_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.life_user_prefs enable row level security;

drop policy if exists "life_user_prefs_select_own" on public.life_user_prefs;
drop policy if exists "life_user_prefs_insert_own" on public.life_user_prefs;
drop policy if exists "life_user_prefs_update_own" on public.life_user_prefs;
drop policy if exists "life_user_prefs_delete_own" on public.life_user_prefs;

create policy "life_user_prefs_select_own"
  on public.life_user_prefs for select
  using (auth.uid() = user_id);

create policy "life_user_prefs_insert_own"
  on public.life_user_prefs for insert
  with check (auth.uid() = user_id);

create policy "life_user_prefs_update_own"
  on public.life_user_prefs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "life_user_prefs_delete_own"
  on public.life_user_prefs for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.life_user_prefs to authenticated;
