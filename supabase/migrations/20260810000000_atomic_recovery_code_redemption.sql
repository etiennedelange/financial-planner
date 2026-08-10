-- AUTH-006: redeem_recovery_code selected an unused row and then updated it by
-- `id` alone, with no `used_at is null` condition on the UPDATE itself. Two
-- concurrent redemptions of the same code could both pass the SELECT before
-- either UPDATE commits, and both then return true — violating the documented
-- single-use invariant. Postgres row-level locking makes the UPDATE itself
-- atomic: repeating the `used_at is null` check on the UPDATE's WHERE clause
-- means only the first of two concurrent callers can ever flip the row, and
-- the second sees zero rows affected instead of racing past the earlier check.

create or replace function public.redeem_recovery_code(code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid    uuid := (select auth.uid());
  target uuid;
  rows_updated int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select id into target
  from public.user_recovery_codes
  where user_id = uid
    and used_at is null
    and code_hash = extensions.crypt(code, code_hash)
  limit 1;

  if target is null then
    return false;
  end if;

  update public.user_recovery_codes
  set used_at = now()
  where id = target
    and used_at is null;

  get diagnostics rows_updated = row_count;
  return rows_updated = 1;
end;
$$;
