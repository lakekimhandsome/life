-- Public read-only sharing for LIFE journals, projects, and notes.
alter table public.life_objects
  add column if not exists visibility text not null default 'private',
  add column if not exists share_token uuid;

alter table public.life_objects
  drop constraint if exists life_objects_visibility_check,
  add constraint life_objects_visibility_check
    check (visibility in ('private', 'unlisted')),
  drop constraint if exists life_objects_unlisted_type_check,
  add constraint life_objects_unlisted_type_check
    check (visibility = 'private' or type in ('journal', 'project', 'note')),
  drop constraint if exists life_objects_share_token_check,
  add constraint life_objects_share_token_check
    check (
      (visibility = 'private' and share_token is null)
      or (visibility = 'unlisted' and share_token is not null)
    );

create unique index if not exists life_objects_share_token_idx
  on public.life_objects (share_token)
  where share_token is not null;

create schema if not exists private;

create or replace function private.prepare_life_object_sharing()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.visibility = 'private' then
    new.share_token := null;
  elsif tg_op = 'INSERT'
    or old.visibility is distinct from 'unlisted'
    or new.share_token is null then
    new.share_token := gen_random_uuid();
  end if;

  return new;
end;
$$;

revoke all on function private.prepare_life_object_sharing()
  from public, anon, authenticated;

drop trigger if exists prepare_life_object_sharing on public.life_objects;
create trigger prepare_life_object_sharing
before insert or update of visibility, share_token on public.life_objects
for each row execute function private.prepare_life_object_sharing();

-- This narrowly scoped SECURITY DEFINER RPC is the only anonymous read path.
-- It accepts one high-entropy token and returns an explicit public projection;
-- anon never receives SELECT on public.life_objects, so rows cannot be listed.
create or replace function public.get_shared_life_object(p_share_token uuid)
returns table (
  type text,
  title text,
  body text,
  occurred_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  meta jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    life_object.type,
    life_object.title,
    life_object.body,
    life_object.occurred_at,
    life_object.created_at,
    life_object.updated_at,
    case life_object.type
      when 'journal' then jsonb_strip_nulls(
        jsonb_build_object('mood', life_object.meta -> 'mood')
      )
      when 'project' then jsonb_strip_nulls(
        jsonb_build_object('status', life_object.meta -> 'status')
      )
      else '{}'::jsonb
    end as meta
  from public.life_objects as life_object
  where life_object.share_token = p_share_token
    and life_object.visibility = 'unlisted'
    and life_object.type in ('journal', 'project', 'note')
  limit 1;
$$;

revoke all on function public.get_shared_life_object(uuid)
  from public, anon, authenticated;
grant execute on function public.get_shared_life_object(uuid)
  to anon, authenticated;
