-- Run in one transaction; fixtures and all changes are rolled back.
begin;
insert into auth.users(id, email) values
 ('11111111-0000-4000-8000-000000000031', 'trash-test-owner@example.invalid'),
 ('11111111-0000-4000-8000-000000000032', 'trash-test-other@example.invalid');
set local role authenticated;
set local request.jwt.claim.sub = '11111111-0000-4000-8000-000000000031';
insert into public.life_objects(id,user_id,type,title,body,occurred_at,meta)
select 'trash-test-' || type, auth.uid(), type, 'Trash test', 'Preserved body', now(), '{"test":true}'::jsonb
from unnest(array['project','note','journal','goal','plan','asset']) type;
update public.life_objects set visibility = 'unlisted' where id = 'trash-test-note';
create temporary table trash_test_token as select share_token from public.life_objects where id = 'trash-test-note';
delete from public.life_objects where id like 'trash-test-%';
do $$ begin
  assert (select count(*) = 4 from public.life_deleted_objects), 'Only the four requested types must be archived';
  assert not exists(select 1 from public.life_objects where id like 'trash-test-%'), 'Deleted items must leave normal lists';
  assert not exists(select 1 from public.get_shared_life_object((select share_token from trash_test_token))), 'Deleted shares must close';
end $$;

-- A different account cannot list, restore, or permanently delete the owner's items.
set local request.jwt.claim.sub = '11111111-0000-4000-8000-000000000032';
do $$ begin
  assert not exists(select 1 from public.life_deleted_objects), 'Trash must be private';
  begin
    perform public.restore_deleted_life_object('trash-test-note');
    raise exception 'Cross-user restoration was allowed';
  exception when raise_exception then
    if sqlerrm <> 'Deleted item not found' then raise; end if;
  end;
end $$;
delete from public.life_deleted_objects where id = 'trash-test-note';

set local request.jwt.claim.sub = '11111111-0000-4000-8000-000000000031';
select public.restore_deleted_life_object('trash-test-note');
do $$ begin
  assert exists(select 1 from public.life_objects where id = 'trash-test-note'
    and body = 'Preserved body' and meta = '{"test":true}'::jsonb
    and visibility = 'private' and share_token is null), 'Restore must preserve content and keep shares closed';
  assert not exists(select 1 from public.life_deleted_objects where id = 'trash-test-note'), 'Restored row must leave trash';
end $$;

-- A failed restore must keep its archived copy.
insert into public.life_objects(id,user_id,type,title,occurred_at)
  values ('trash-test-project', auth.uid(), 'project', 'Collision', now());
do $$ begin
  begin
    perform public.restore_deleted_life_object('trash-test-project');
    raise exception 'Conflicting restore unexpectedly succeeded';
  exception when unique_violation then null;
  end;
  assert exists(select 1 from public.life_deleted_objects where id = 'trash-test-project'), 'Failed restore must retain archive';
end $$;

-- A removed folder must not prevent a note from being recovered.
insert into public.life_note_folders(id,user_id,name) values
 ('11111111-0000-4000-8000-000000000033', auth.uid(), 'Trash test folder');
update public.life_objects set folder_id = '11111111-0000-4000-8000-000000000033' where id = 'trash-test-note';
delete from public.life_objects where id = 'trash-test-note';
select public.delete_life_note_folder('11111111-0000-4000-8000-000000000033');
select public.restore_deleted_life_object('trash-test-note');
do $$ begin
  assert (select folder_id is null from public.life_objects where id = 'trash-test-note'), 'Missing folder must restore to root';
end $$;
delete from public.life_deleted_objects where id = 'trash-test-journal';
do $$ begin
  assert not exists(select 1 from public.life_deleted_objects where id = 'trash-test-journal'), 'Permanent delete must remove archive';
  assert not has_table_privilege('anon', 'public.life_deleted_objects', 'select'), 'Anon must not read trash';
  assert not has_function_privilege('anon', 'public.restore_deleted_life_object(text)', 'execute'), 'Anon must not restore';
end $$;
reset role;
delete from auth.users where id = '11111111-0000-4000-8000-000000000031';
do $$ begin
  assert not exists(select 1 from public.life_deleted_objects where user_id = '11111111-0000-4000-8000-000000000031'), 'Account deletion must remove trash';
end $$;
rollback;
