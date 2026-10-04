begin;

select plan(13);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-000000000001', 'sharing-test@example.com');

insert into public.life_objects (
  id,
  user_id,
  type,
  title,
  body,
  occurred_at
)
values (
  'sharing-test-journal',
  '00000000-0000-0000-0000-000000000001',
  'journal',
  'Shared journal',
  'Read-only body',
  now()
);

select is(
  (select visibility from public.life_objects where id = 'sharing-test-journal'),
  'private',
  'objects default to private'
);

select is(
  (select share_token from public.life_objects where id = 'sharing-test-journal'),
  null::uuid,
  'private objects have no share token'
);

update public.life_objects
set visibility = 'unlisted'
where id = 'sharing-test-journal';

select isnt(
  (select share_token from public.life_objects where id = 'sharing-test-journal'),
  null::uuid,
  'unlisted objects receive a share token'
);

create temporary table sharing_test_state as
select share_token as first_token
from public.life_objects
where id = 'sharing-test-journal';

grant select on sharing_test_state to anon;

set local role anon;

select is(
  (
    select title
    from public.get_shared_life_object(
      (select first_token from sharing_test_state)
    )
  ),
  'Shared journal',
  'anon can read an unlisted object with its token'
);

select is(
  (
    select count(*)
    from public.get_shared_life_object('00000000-0000-4000-8000-000000000099')
  ),
  0::bigint,
  'an unknown token returns no object'
);

select is(
  (select count(*) from public.life_objects),
  0::bigint,
  'RLS prevents anon from listing life_objects'
);

reset role;

update public.life_objects
set visibility = 'private'
where id = 'sharing-test-journal';

select is(
  (select share_token from public.life_objects where id = 'sharing-test-journal'),
  null,
  'returning to private clears the token'
);

select is(
  (
    select count(*)
    from public.get_shared_life_object(
      (select first_token from sharing_test_state)
    )
  ),
  0::bigint,
  'the revoked token no longer resolves'
);

update public.life_objects
set visibility = 'unlisted'
where id = 'sharing-test-journal';

select isnt(
  (select share_token from public.life_objects where id = 'sharing-test-journal'),
  (select first_token from sharing_test_state),
  're-enabling sharing rotates the token'
);

insert into public.life_objects (
  id,
  user_id,
  type,
  title,
  body,
  occurred_at
)
values (
  'sharing-test-goal',
  '00000000-0000-0000-0000-000000000001',
  'goal',
  'Private goal',
  '',
  now()
);

select throws_ok(
  $$
    update public.life_objects
    set visibility = 'unlisted'
    where id = 'sharing-test-goal'
  $$,
  '23514',
  null,
  'unsupported object types cannot become unlisted'
);

select ok(
  has_function_privilege('anon', 'public.get_shared_life_object(uuid)', 'execute'),
  'anon can execute the shared-object lookup'
);

select ok(
  has_function_privilege('authenticated', 'public.get_shared_life_object(uuid)', 'execute'),
  'authenticated users can execute the shared-object lookup'
);

select unlike(
  pg_get_function_result('public.get_shared_life_object(uuid)'::regprocedure),
  '(user_id|share_token|(^|[ (])id text)',
  'the public result exposes no internal identifiers'
);

select * from finish();
rollback;
