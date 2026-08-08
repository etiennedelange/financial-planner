-- store_recovery_codes is security definer and therefore bypasses RLS entirely —
-- the mfa_satisfied() gate every table policy enforces never applied to it. An
-- attacker holding only a stolen password (aal1, victim enrolled in TOTP) could
-- call this RPC directly against PostgREST, replace the victim's recovery codes
-- with their own, redeem one via /api/auth/recover — which is legitimately
-- aal1-reachable, being the recovery entry point — and have the victim's TOTP
-- factor deleted for them. Full 2FA bypass from a password alone.
--
-- Both legitimate call paths survive this guard:
--   - enrolment: no verified factor exists yet, so mfa_satisfied() is true on its
--     "no verified factor" branch;
--   - regeneration after verify: mfa.verify() returns an aal2 JWT before the RPC runs.
-- Only an aal1 session that already has a verified factor now fails — precisely
-- the attacker's position.

create or replace function public.store_recovery_codes(codes text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  c   text;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public.mfa_satisfied() then
    raise exception 'second factor required to replace recovery codes' using errcode = '28000';
  end if;
  if array_length(codes, 1) is distinct from 10 then
    raise exception 'expected exactly 10 recovery codes' using errcode = '22023';
  end if;

  delete from public.user_recovery_codes where user_id = uid;

  foreach c in array codes loop
    insert into public.user_recovery_codes (user_id, code_hash)
    values (uid, extensions.crypt(c, extensions.gen_salt('bf', 10)));
  end loop;
end;
$$;
