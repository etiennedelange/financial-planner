-- RLS + AAL enforcement tests. Run with:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_mfa.test.sql
-- Any assertion failure aborts with a non-zero exit code.

begin;

-- Two users: alice has a verified TOTP factor, bob has none.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alice@test.local', 'x'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'bob@test.local', 'x');

insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
values ('33333333-3333-3333-3333-333333333333',
        '11111111-1111-1111-1111-111111111111', 'app', 'totp', 'verified', now(), now());

insert into scenarios (id, session_id, name)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Alice Plan'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Bob Plan');

set local role authenticated;

-- 1. Alice at aal1 WITH a verified factor: must see nothing.
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal1"}';
do $$ begin
  if (select count(*) from scenarios) <> 0 then
    raise exception 'FAIL: enrolled user at aal1 can read scenarios';
  end if;
end $$;

-- 2. Alice at aal2: must see exactly her own row.
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal2"}';
do $$ begin
  if (select count(*) from scenarios) <> 1 then
    raise exception 'FAIL: enrolled user at aal2 cannot read own scenarios';
  end if;
end $$;

-- 3. Bob at aal1 WITHOUT a factor: must see exactly his own row.
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aal":"aal1"}';
do $$ begin
  if (select count(*) from scenarios) <> 1 then
    raise exception 'FAIL: unenrolled user at aal1 cannot read own scenarios';
  end if;
end $$;

-- 4. Bob must never see Alice's row, at any AAL.
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aal":"aal2"}';
do $$ begin
  if exists (select 1 from scenarios where session_id = '11111111-1111-1111-1111-111111111111') then
    raise exception 'FAIL: cross-user read is possible';
  end if;
end $$;

-- 5. Alice at aal1 must not be able to WRITE either.
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal1"}';
do $$ begin
  begin
    insert into scenarios (session_id, name)
    values ('11111111-1111-1111-1111-111111111111', 'Snuck In');
    raise exception 'FAIL: enrolled user at aal1 can insert scenarios';
  exception when insufficient_privilege then
    null; -- expected
  end;
end $$;

rollback;
