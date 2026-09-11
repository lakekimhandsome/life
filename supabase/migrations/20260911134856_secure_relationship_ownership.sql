drop policy if exists "life_relationships_insert_own" on public.life_relationships;
drop policy if exists "life_relationships_update_own" on public.life_relationships;

create policy "life_relationships_insert_own"
  on public.life_relationships for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.life_objects
      where id = source_id and user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.life_objects
      where id = target_id and user_id = (select auth.uid())
    )
  );

create policy "life_relationships_update_own"
  on public.life_relationships for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.life_objects
      where id = source_id and user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.life_objects
      where id = target_id and user_id = (select auth.uid())
    )
  );
