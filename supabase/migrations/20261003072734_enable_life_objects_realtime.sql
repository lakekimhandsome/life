create schema if not exists private;

create or replace function private.broadcast_life_object_change()
returns trigger
security definer
set search_path = ''
language plpgsql
as $$
begin
  perform realtime.broadcast_changes(
    'life_objects:' || coalesce(new.user_id, old.user_id)::text,
    'change',
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  return null;
end;
$$;

revoke all on function private.broadcast_life_object_change() from public, anon, authenticated;

drop trigger if exists broadcast_life_object_change on public.life_objects;
create trigger broadcast_life_object_change
after insert or update or delete on public.life_objects
for each row execute function private.broadcast_life_object_change();

drop policy if exists "users receive own life object changes" on realtime.messages;
create policy "users receive own life object changes"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) = 'life_objects:' || (select auth.uid())::text
);
