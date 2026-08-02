-- Supabase provides no recovery codes. Without them, a lost authenticator is a
-- permanent lockout with no self-serve path back in.

create table user_recovery_codes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  code_hash  text not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create index user_recovery_codes_user_id_idx on user_recovery_codes (user_id);

alter table user_recovery_codes enable row level security;
alter table user_recovery_codes force row level security;

-- Users may see WHETHER their codes are spent, never the hashes themselves.
-- All writes go through the security-definer RPCs below.
create policy "users read own recovery code state"
  on user_recovery_codes for select
  using (user_id = (select auth.uid()));

-- RLS is row-level only — it does not by itself grant table access, and it cannot
-- restrict which columns a permitted row exposes. Both matter here: without this
-- grant the policy above can never fire (no base SELECT privilege), and if we
-- granted whole-row SELECT instead, a user could read their own code_hash directly,
-- contradicting the policy comment. Column-level grant closes both gaps at once.
grant select (id, user_id, used_at, created_at) on user_recovery_codes to authenticated;

revoke insert, update, delete on user_recovery_codes from authenticated;

-- Replaces the caller's entire code set. Called at enrolment and at regeneration.
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

-- Marks one unused code spent. Returns true on success, false if no code matches.
-- Deliberately returns a boolean rather than raising, so the caller cannot distinguish
-- "wrong code" from "no codes left" by error type.
create or replace function public.redeem_recovery_code(code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid    uuid := (select auth.uid());
  target uuid;
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

  update public.user_recovery_codes set used_at = now() where id = target;
  return true;
end;
$$;

create or replace function public.recovery_codes_remaining()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.user_recovery_codes
  where user_id = (select auth.uid()) and used_at is null;
$$;

revoke all on function public.store_recovery_codes(text[])   from public;
revoke all on function public.redeem_recovery_code(text)     from public;
revoke all on function public.recovery_codes_remaining()     from public;
grant execute on function public.store_recovery_codes(text[]) to authenticated;
grant execute on function public.redeem_recovery_code(text)   to authenticated;
grant execute on function public.recovery_codes_remaining()   to authenticated;
