-- DELETE RETURNING claims the archive atomically using SELECT/DELETE privileges.
create or replace function public.restore_deleted_life_object(target_id text)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  saved public.life_deleted_objects;
  restored public.life_objects;
begin
  delete from public.life_deleted_objects
    where id = target_id and user_id = (select auth.uid()) returning * into saved;
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
  return saved.id;
end;
$$;
revoke all on function public.restore_deleted_life_object(text) from public, anon, authenticated;
grant execute on function public.restore_deleted_life_object(text) to authenticated;
