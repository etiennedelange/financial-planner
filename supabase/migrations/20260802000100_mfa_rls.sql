-- Two-factor enforcement lives here, in RLS, not in middleware.
-- The publishable key ships in the client bundle, so anyone holding a stolen aal1
-- token can call PostgREST directly. Middleware never sees that request; RLS does.
--
-- Defined ONCE and referenced by every policy. Do not inline this predicate per-table —
-- four copies of a security rule is four chances for them to drift apart.

create or replace function public.mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.jwt() ->> 'aal') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors
        where user_id = (select auth.uid())
          and status = 'verified'
      );
$$;

revoke all on function public.mfa_satisfied() from public;
grant execute on function public.mfa_satisfied() to authenticated;

comment on function public.mfa_satisfied() is
  'True when the caller has cleared their second factor, or has none enrolled. '
  'Referenced by every table policy — the single enforcement point for 2FA.';

-- scenarios
drop policy if exists "session users can manage their own scenario" on scenarios;
create policy "users manage own scenarios"
  on scenarios for all
  using       (session_id = (select auth.uid()) and public.mfa_satisfied())
  with check  (session_id = (select auth.uid()) and public.mfa_satisfied());

-- accounts (scoped through scenarios)
drop policy if exists "users can manage accounts in their scenarios" on accounts;
create policy "users manage own accounts"
  on accounts for all
  using (
    public.mfa_satisfied()
    and scenario_id in (select id from scenarios where session_id = (select auth.uid()))
  )
  with check (
    public.mfa_satisfied()
    and scenario_id in (select id from scenarios where session_id = (select auth.uid()))
  );

-- expense_groups
drop policy if exists "users can manage their own expense groups" on expense_groups;
create policy "users manage own expense groups"
  on expense_groups for all
  using       (session_id = (select auth.uid()) and public.mfa_satisfied())
  with check  (session_id = (select auth.uid()) and public.mfa_satisfied());

-- expenses
drop policy if exists "users can manage their own expenses" on expenses;
create policy "users manage own expenses"
  on expenses for all
  using       (session_id = (select auth.uid()) and public.mfa_satisfied())
  with check  (session_id = (select auth.uid()) and public.mfa_satisfied());

-- mfa_satisfied() probes auth.mfa_factors on every policy evaluation.
-- No index added here: auth.mfa_factors is owned by supabase_auth_admin and the
-- migration role (postgres) has DML-only grants on it, not DDL — `create index`
-- fails with "must be owner of table mfa_factors". GoTrue already maintains
-- mfa_factors_user_id_idx on (user_id), which is sufficient: per-user factor
-- counts are capped by [auth.mfa] max_enrolled_factors (10 here), so the lookup
-- this function performs is never a large scan regardless of the status filter.
