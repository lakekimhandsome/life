-- Isolated fixtures; no real account data is changed.
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('f29b6611-1607-49d9-8092-d66f9ca1c001', 'folder-delete-test-1@example.test', '{"nickname":"folder-test-1"}'),
  ('f29b6611-1607-49d9-8092-d66f9ca1c002', 'folder-delete-test-2@example.test', '{"nickname":"folder-test-2"}');
select set_config('request.jwt.claim.sub', 'f29b6611-1607-49d9-8092-d66f9ca1c001', true);
set local role authenticated;
do $$
declare
  owner_id uuid := auth.uid();
  parent uuid := gen_random_uuid();
  target uuid := gen_random_uuid();
  child uuid := gen_random_uuid();
  grandchild uuid := gen_random_uuid();
  note text := gen_random_uuid()::text;
  deep_note text := gen_random_uuid()::text;
  result uuid;
begin
  insert into public.life_note_folders (id, user_id, name, parent_id) values
    (parent, owner_id, 'parent', null), (target, owner_id, 'target', parent),
    (child, owner_id, 'child', target), (grandchild, owner_id, 'grandchild', child);
  insert into public.life_objects (id, user_id, type, title, body, folder_id, occurred_at) values
    (note, owner_id, 'note', 'preserve title', 'preserve body', target, now()),
    (deep_note, owner_id, 'note', 'deep', 'deep body', grandchild, now());

  perform set_config('request.jwt.claim.sub', 'f29b6611-1607-49d9-8092-d66f9ca1c002', true);
  begin
    perform public.delete_life_note_folder(target);
    raise exception 'Other user could delete folder';
  exception when no_data_found then null;
  end;
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  assert exists (select 1 from public.life_note_folders where id = target);

  result := public.delete_life_note_folder(target);
  assert result = parent;
  assert not exists (select 1 from public.life_note_folders where id = target);
  assert exists (select 1 from public.life_note_folders where id = child and parent_id = parent);
  assert exists (select 1 from public.life_note_folders where id = grandchild and parent_id = child);
  assert exists (select 1 from public.life_objects where id = note and folder_id = parent and title = 'preserve title' and body = 'preserve body');
  assert exists (select 1 from public.life_objects where id = deep_note and folder_id = grandchild);

  result := public.delete_life_note_folder(parent);
  assert result is null;
  assert exists (select 1 from public.life_note_folders where id = child and parent_id is null);
  assert exists (select 1 from public.life_objects where id = note and folder_id is null);
  begin
    perform public.delete_life_note_folder(parent);
    raise exception 'Missing folder was accepted';
  exception when no_data_found then null;
  end;
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.delete_life_note_folder(child);
    raise exception 'Unauthenticated caller was accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
