-- Archive at the database boundary so every client uses the same trash.
create table public.life_deleted_objects (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  object_data jsonb not null,
  deleted_at timestamptz not null default now(),
  check (object_data ->> 'id' = id),
  check ((object_data ->> 'user_id')::uuid = user_id),
  check (object_data ->> 'type' in ('project', 'note', 'journal', 'goal'))
);
create index life_deleted_objects_user_deleted_idx
  on public.life_deleted_objects(user_id, deleted_at desc);
alter table public.life_deleted_objects enable row level security;
create policy life_deleted_objects_select_own on public.life_deleted_objects
  for select to authenticated using ((select auth.uid()) = user_id);
create policy life_deleted_objects_insert_own on public.life_deleted_objects
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy life_deleted_objects_delete_own on public.life_deleted_objects
  for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.life_deleted_objects from authenticated;
grant select, insert, delete on public.life_deleted_objects to authenticated;
revoke all on public.life_deleted_objects from anon;

create or replace function private.archive_deleted_life_object()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  -- Account deletion cascades must not recreate data for a departing user.
  if pg_trigger_depth() = 1 and old.type in ('project', 'note', 'journal', 'goal') then
    insert into public.life_deleted_objects(id, user_id, object_data)
      values (old.id, old.user_id, to_jsonb(old));
  end if;
  return old;
end;
$$;
revoke all on function private.archive_deleted_life_object() from public, anon, authenticated;
create trigger archive_deleted_life_object before delete on public.life_objects
  for each row execute function private.archive_deleted_life_object();

create or replace function public.restore_deleted_life_object(target_id text)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  saved public.life_deleted_objects;
  restored public.life_objects;
begin
  select * into saved from public.life_deleted_objects
    where id = target_id and user_id = (select auth.uid()) for update;
  if not found then raise exception 'Deleted item not found'; end if;
  restored := jsonb_populate_record(null::public.life_objects, saved.object_data);
  restored.visibility := 'private';
  restored.share_token := null;
  restored.updated_at := now();
  if restored.folder_id is not null and not exists (
    select 1 from public.life_note_folders where id = restored.folder_id
      and user_id = (select auth.uid())
  ) then restored.folder_id := null; end if;
  insert into public.life_objects select restored.*;
  delete from public.life_deleted_objects where id = saved.id;
  return saved.id;
end;
$$;
revoke all on function public.restore_deleted_life_object(text) from public, anon, authenticated;
grant execute on function public.restore_deleted_life_object(text) to authenticated;
