-- Allow first-class notes alongside journal, project, asset, etc.

alter table public.life_objects drop constraint if exists life_objects_type_check;

alter table public.life_objects add constraint life_objects_type_check check (
  type in ('journal', 'project', 'note', 'workout', 'study', 'goal', 'asset')
);
