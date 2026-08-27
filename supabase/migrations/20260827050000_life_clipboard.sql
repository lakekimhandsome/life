-- Per-user scratch clipboard (text + image refs). Private storage for screenshots.

create table if not exists public.life_clipboard (
  user_id uuid primary key references auth.users (id) on delete cascade,
  body text not null default '',
  images jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint life_clipboard_images_array check (jsonb_typeof(images) = 'array')
);

alter table public.life_clipboard enable row level security;

drop policy if exists "life_clipboard_select_own" on public.life_clipboard;
drop policy if exists "life_clipboard_insert_own" on public.life_clipboard;
drop policy if exists "life_clipboard_update_own" on public.life_clipboard;
drop policy if exists "life_clipboard_delete_own" on public.life_clipboard;

create policy "life_clipboard_select_own"
  on public.life_clipboard for select
  using (auth.uid() = user_id);

create policy "life_clipboard_insert_own"
  on public.life_clipboard for insert
  with check (auth.uid() = user_id);

create policy "life_clipboard_update_own"
  on public.life_clipboard for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "life_clipboard_delete_own"
  on public.life_clipboard for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.life_clipboard to authenticated;

alter table public.life_clipboard replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.life_clipboard;
exception
  when duplicate_object then null;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clipboard',
  'clipboard',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif'
  ]::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "clipboard_select_own" on storage.objects;
drop policy if exists "clipboard_insert_own" on storage.objects;
drop policy if exists "clipboard_update_own" on storage.objects;
drop policy if exists "clipboard_delete_own" on storage.objects;

create policy "clipboard_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'clipboard'
    and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  );

create policy "clipboard_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'clipboard'
    and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  );

create policy "clipboard_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'clipboard'
    and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  )
  with check (
    bucket_id = 'clipboard'
    and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  );

create policy "clipboard_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'clipboard'
    and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  );
