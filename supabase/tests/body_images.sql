-- Run as postgres. Fixtures and all changes are rolled back.
begin;
select set_config('test.image_owner', (select id::text from auth.users limit 1), true);
select set_config('test.image_path', current_setting('test.image_owner') || '/body-image-check.png', true);
insert into public.life_objects (id, user_id, type, title, body, visibility, occurred_at)
values ('body-image-policy-check', current_setting('test.image_owner')::uuid, 'note', 'Image policy check',
  '![](https://example.supabase.co/storage/v1/object/authenticated/body-images/' || current_setting('test.image_path') || ')', 'unlisted', now());
select set_config('test.share_token', (select share_token::text from public.life_objects where id = 'body-image-policy-check'), true);
insert into storage.objects (bucket_id, name) values
  ('body-images', current_setting('test.image_path')),
  ('body-images', current_setting('test.image_owner') || '/body-image-hidden.png'),
  ('body-images', '00000000-0000-0000-0000-000000000000/body-image-other.png');

set local role anon;
select set_config('request.jwt.claims', '{}', true);
select set_config('request.headers', '{}', true);
do $$ begin
  assert (select count(*) = 0 from storage.objects where bucket_id='body-images'), 'Anonymous image access without token';
end $$;
select set_config('request.headers', json_build_object('x-life-share-token', current_setting('test.share_token'))::text, true);
do $$ begin
  assert (select count(*) = 1 from storage.objects where bucket_id='body-images'), 'Share token must expose exactly its referenced image';
end $$;
select set_config('request.headers', '{"x-life-share-token":"wrong"}', true);
do $$ begin
  assert (select count(*) = 0 from storage.objects where bucket_id='body-images'), 'Wrong token exposed image';
end $$;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.image_owner'), 'role','authenticated')::text, true);
select set_config('request.headers', '{}', true);
do $$ begin
  assert (select count(*) = 2 from storage.objects where bucket_id='body-images' and name like '%body-image-%'), 'Owner cannot read own images or can read another owner';
  begin
    insert into storage.objects (bucket_id,name) values ('body-images','00000000-0000-0000-0000-000000000000/forbidden.png');
    raise exception 'Cross-owner upload allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
set local role postgres;
update public.life_objects set visibility='private' where id='body-image-policy-check';
set local role anon;
select set_config('request.jwt.claims', '{}', true);
select set_config('request.headers', json_build_object('x-life-share-token', current_setting('test.share_token'))::text, true);
do $$ begin
  assert (select count(*) = 0 from storage.objects where bucket_id='body-images'), 'Revoked share still exposes images';
end $$;
rollback;
