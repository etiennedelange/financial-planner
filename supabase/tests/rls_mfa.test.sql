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

insert into accounts (id, scenario_id, name, type)
values ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Alice RA', 'retirement_annuity');

insert into expense_groups (id, session_id, name)
values ('dddddddd-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Alice Housing');

insert into expenses (id, session_id, group_id, name)
values ('eeeeeeee-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'dddddddd-0000-0000-0000-000000000001', 'Alice Rent');

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

-- 4. Cross-user isolation: Bob must never see Alice's row, regardless of his own AAL.
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

-- 6. Alice at aal1 WITH a verified factor: must see nothing in accounts either.
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal1"}';
do $$ begin
  if (select count(*) from accounts) <> 0 then
    raise exception 'FAIL: enrolled user at aal1 can read accounts';
  end if;
end $$;

-- 7. Alice at aal2: must see exactly her own account.
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal2"}';
do $$ begin
  if (select count(*) from accounts) <> 1 then
    raise exception 'FAIL: enrolled user at aal2 cannot read own accounts';
  end if;
end $$;

-- 8. Alice at aal1 WITH a verified factor: must see nothing in expense_groups either.
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal1"}';
do $$ begin
  if (select count(*) from expense_groups) <> 0 then
    raise exception 'FAIL: enrolled user at aal1 can read expense_groups';
  end if;
end $$;

-- 9. Alice at aal2: must see exactly her own expense group.
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal2"}';
do $$ begin
  if (select count(*) from expense_groups) <> 1 then
    raise exception 'FAIL: enrolled user at aal2 cannot read own expense_groups';
  end if;
end $$;

-- 10. Alice at aal1 WITH a verified factor: must see nothing in expenses either.
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal1"}';
do $$ begin
  if (select count(*) from expenses) <> 0 then
    raise exception 'FAIL: enrolled user at aal1 can read expenses';
  end if;
end $$;

-- 11. Alice at aal2: must see exactly her own expense.
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal2"}';
do $$ begin
  if (select count(*) from expenses) <> 1 then
    raise exception 'FAIL: enrolled user at aal2 cannot read own expenses';
  end if;
end $$;

-- 12. Alice at aal1 must not be able to UPDATE her own scenario (zero rows match — not an error, RLS silently excludes it).
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal1"}';
do $$
declare
  affected int;
begin
  update scenarios set name = 'Hacked' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'FAIL: enrolled user at aal1 can update scenarios';
  end if;
end $$;

-- 13. Alice at aal1 must not be able to DELETE her own scenario (zero rows match — not an error).
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal1"}';
do $$
declare
  affected int;
begin
  delete from scenarios where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'FAIL: enrolled user at aal1 can delete scenarios';
  end if;
end $$;

-- Recovery codes: redemption is single-use and scoped to the caller.
set local role postgres;
insert into user_recovery_codes (user_id, code_hash)
values ('11111111-1111-1111-1111-111111111111',
        extensions.crypt('ABCDE-FGHJK', extensions.gen_salt('bf', 10)));

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal1"}';

do $$ begin
  if not public.redeem_recovery_code('ABCDE-FGHJK') then
    raise exception 'FAIL: valid recovery code was rejected';
  end if;
  if public.redeem_recovery_code('ABCDE-FGHJK') then
    raise exception 'FAIL: recovery code redeemed twice';
  end if;
  if public.redeem_recovery_code('ZZZZZ-ZZZZZ') then
    raise exception 'FAIL: unknown recovery code accepted';
  end if;
end $$;

-- Bob must not be able to redeem Alice's code.
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aal":"aal1"}';
do $$ begin
  if public.redeem_recovery_code('ABCDE-FGHJK') then
    raise exception 'FAIL: recovery code redeemable across users';
  end if;
end $$;

rollback;
