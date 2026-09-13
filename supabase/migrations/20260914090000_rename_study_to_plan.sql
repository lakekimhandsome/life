-- Rename the plan object type while preserving existing plan records.

alter table public.life_objects drop constraint if exists life_objects_type_check;

update public.life_objects
set type = 'plan'
where type = 'study';

alter table public.life_objects add constraint life_objects_type_check check (
  type in ('journal', 'project', 'note', 'workout', 'plan', 'goal', 'asset')
);
