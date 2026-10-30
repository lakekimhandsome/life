-- Exercises production constraints and RLS with disposable rows; persists no data.
begin;
do $$
declare
  owner_id uuid;
  other_id uuid;
  root_id uuid := gen_random_uuid();
  child_id uuid := gen_random_uuid();
  foreign_id uuid := gen_random_uuid();
  note_id text := 'folder-test-' || gen_random_uuid()::text;
begin
  select id into owner_id from auth.users order by created_at limit 1;
  select id into other_id from auth.users where id <> owner_id order by created_at limit 1;
  assert owner_id is not null and other_id is not null, 'Two existing users required';
  insert into public.life_note_folders(id,user_id,name,parent_id) values
    (root_id,owner_id,'Folder test',null), (foreign_id,other_id,'Other account',null);
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  set local role authenticated;
  insert into public.life_note_folders(id,user_id,name,parent_id) values (child_id,owner_id,'Nested test',root_id);
  assert not exists(select 1 from public.life_note_folders where id=foreign_id), 'Other account folders must be hidden';
  begin
    insert into public.life_note_folders(user_id,name) values(other_id,'Denied');
    raise exception 'Cross-account insert was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.life_note_folders(user_id,name,parent_id) values(owner_id,'Denied',foreign_id);
    raise exception 'Cross-account parent was accepted';
  exception when foreign_key_violation then null;
  end;
  insert into public.life_objects(id,user_id,type,title,body,meta,occurred_at,created_at,updated_at,folder_id)
    values(note_id,owner_id,'note','Folder test','','{}',now(),now(),now(),child_id);
  update public.life_objects set title='Edited' where id=note_id;
  assert (select folder_id = child_id from public.life_objects where id=note_id), 'Editing must retain folder';
  begin
    update public.life_objects set folder_id=foreign_id where id=note_id;
    raise exception 'Cross-account note move was accepted';
  exception when foreign_key_violation then null;
  end;
  begin
    update public.life_objects set type='journal' where id=note_id;
    raise exception 'Non-note was allowed in folder';
  exception when check_violation then null;
  end;
  update public.life_objects set folder_id=null where id=note_id;
  assert (select folder_id is null from public.life_objects where id=note_id), 'Moving to root must work';
  reset role;
end $$;
rollback;
