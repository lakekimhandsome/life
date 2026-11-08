-- The production project shares this signup hook with CafeRadar.
do $migration$
begin
  if to_regprocedure('public.handle_new_user()') is not null
    and to_regclass('public.caferadar_profiles') is not null then
    create or replace function public.handle_new_user()
    returns trigger
    language plpgsql
    security definer
    set search_path to 'public'
    as $function$
    begin
      insert into public.caferadar_profiles (id, nickname)
      values (
        new.id,
        coalesce(
          nullif(trim(new.raw_user_meta_data->>'nickname'), ''),
          nullif(split_part(new.email, '@', 1), ''),
          '사용자'
        )
      )
      on conflict (id) do nothing;
      return new;
    end;
    $function$;
  end if;
end;
$migration$;
