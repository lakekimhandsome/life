create table public.life_note_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 200),
  parent_id uuid,
  unique (id, user_id),
  foreign key (parent_id, user_id) references public.life_note_folders(id, user_id),
  check (parent_id is distinct from id)
);
create index life_note_folders_parent_idx on public.life_note_folders(user_id, parent_id);
alter table public.life_note_folders enable row level security;
create policy life_note_folders_select_own on public.life_note_folders for select to authenticated
  using ((select auth.uid()) = user_id);
create policy life_note_folders_insert_own on public.life_note_folders for insert to authenticated
  with check ((select auth.uid()) = user_id);
-- Folder structure is append-only until folder management is added.
grant select, insert on public.life_note_folders to authenticated;
revoke all on public.life_note_folders from anon;

alter table public.life_objects add column folder_id uuid;
alter table public.life_objects add constraint life_objects_note_folder_fk
  foreign key (folder_id, user_id) references public.life_note_folders(id, user_id);
alter table public.life_objects add constraint life_objects_note_folder_type
  check (folder_id is null or type = 'note');
create index life_objects_folder_idx on public.life_objects(user_id, folder_id) where folder_id is not null;
