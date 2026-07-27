-- LIFE core tables: one row set per authenticated user (RLS).

create table if not exists public.life_objects (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb,
  constraint life_objects_type_check check (
    type in ('journal', 'project', 'workout', 'study', 'goal', 'asset')
  )
);

create index if not exists life_objects_user_id_idx on public.life_objects (user_id);
create index if not exists life_objects_user_type_idx on public.life_objects (user_id, type);
create index if not exists life_objects_user_occurred_at_idx
  on public.life_objects (user_id, occurred_at desc);

create table if not exists public.life_relationships (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  source_id text not null references public.life_objects (id) on delete cascade,
  target_id text not null references public.life_objects (id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now(),
  constraint life_relationships_kind_check check (
    kind in ('related', 'supports', 'part_of')
  ),
  constraint life_relationships_no_self check (source_id <> target_id),
  constraint life_relationships_unique unique (user_id, source_id, target_id, kind)
);

create index if not exists life_relationships_user_id_idx
  on public.life_relationships (user_id);
create index if not exists life_relationships_source_id_idx
  on public.life_relationships (source_id);
create index if not exists life_relationships_target_id_idx
  on public.life_relationships (target_id);

alter table public.life_objects enable row level security;
alter table public.life_relationships enable row level security;

drop policy if exists "life_objects_select_own" on public.life_objects;
drop policy if exists "life_objects_insert_own" on public.life_objects;
drop policy if exists "life_objects_update_own" on public.life_objects;
drop policy if exists "life_objects_delete_own" on public.life_objects;

create policy "life_objects_select_own"
  on public.life_objects for select
  using (auth.uid() = user_id);

create policy "life_objects_insert_own"
  on public.life_objects for insert
  with check (auth.uid() = user_id);

create policy "life_objects_update_own"
  on public.life_objects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "life_objects_delete_own"
  on public.life_objects for delete
  using (auth.uid() = user_id);

drop policy if exists "life_relationships_select_own" on public.life_relationships;
drop policy if exists "life_relationships_insert_own" on public.life_relationships;
drop policy if exists "life_relationships_update_own" on public.life_relationships;
drop policy if exists "life_relationships_delete_own" on public.life_relationships;

create policy "life_relationships_select_own"
  on public.life_relationships for select
  using (auth.uid() = user_id);

create policy "life_relationships_insert_own"
  on public.life_relationships for insert
  with check (auth.uid() = user_id);

create policy "life_relationships_update_own"
  on public.life_relationships for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "life_relationships_delete_own"
  on public.life_relationships for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.life_objects to authenticated;
grant select, insert, update, delete on public.life_relationships to authenticated;
