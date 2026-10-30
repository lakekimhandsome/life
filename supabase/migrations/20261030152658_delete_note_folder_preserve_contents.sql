create policy life_note_folders_update_own on public.life_note_folders for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy life_note_folders_delete_own on public.life_note_folders for delete to authenticated
  using ((select auth.uid()) = user_id);
grant update (parent_id), delete on public.life_note_folders to authenticated;

-- Move only direct children: deeper descendants keep their existing structure.
create function public.delete_life_note_folder(target_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  destination_id uuid;
begin
  if owner_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select parent_id into destination_id from public.life_note_folders
    where id = target_id and user_id = owner_id for update;
  if not found then
    raise exception 'Folder not found' using errcode = 'P0002';
  end if;
  update public.life_note_folders set parent_id = destination_id
    where parent_id = target_id and user_id = owner_id;
  update public.life_objects set folder_id = destination_id, updated_at = now()
    where folder_id = target_id and user_id = owner_id;
  delete from public.life_note_folders where id = target_id and user_id = owner_id;
  return destination_id;
end;
$$;
revoke all on function public.delete_life_note_folder(uuid) from public, anon;
grant execute on function public.delete_life_note_folder(uuid) to authenticated;
