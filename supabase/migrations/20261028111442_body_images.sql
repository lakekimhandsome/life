-- Body references remain stable; clients resolve private images to short-lived URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('body-images', 'body-images', false, 10485760,
  array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

create policy body_images_insert_own on storage.objects for insert to authenticated
with check (bucket_id = 'body-images' and (storage.foldername(name))[1] = (select auth.jwt()->>'sub'));
create policy body_images_select_own on storage.objects for select to authenticated
using (bucket_id = 'body-images' and (storage.foldername(name))[1] = (select auth.jwt()->>'sub'));

-- Sharing needs a narrow definer lookup: anonymous users cannot SELECT life_objects.
-- Require the current share token, the image owner's prefix and an exact body reference.
create or replace function private.can_read_shared_body_image(image_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.life_objects o
    where o.visibility = 'unlisted'
      and o.type in ('project','note','journal')
      and o.share_token::text = (nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-life-share-token')
      and o.user_id::text = split_part(image_path, '/', 1)
      and strpos(o.body, '/storage/v1/object/authenticated/body-images/' || image_path) > 0
  );
$$;
revoke all on function private.can_read_shared_body_image(text) from public;
grant execute on function private.can_read_shared_body_image(text) to anon, authenticated;
create policy body_images_select_shared on storage.objects for select to anon, authenticated
using (bucket_id = 'body-images' and private.can_read_shared_body_image(name));
