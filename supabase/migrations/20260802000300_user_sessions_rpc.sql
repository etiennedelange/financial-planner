-- auth.sessions is not exposed through PostgREST, so device listing needs an
-- explicit, tightly-scoped accessor. It returns the caller's own sessions only.

create or replace function public.my_sessions()
returns table (
  id         uuid,
  created_at timestamptz,
  updated_at timestamptz,
  user_agent text,
  ip         inet,
  is_current boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id,
         s.created_at,
         s.updated_at,
         s.user_agent,
         s.ip,
         s.id = ((select auth.jwt() ->> 'session_id'))::uuid as is_current
  from auth.sessions s
  where s.user_id = (select auth.uid())
  order by s.updated_at desc;
$$;

revoke all on function public.my_sessions() from public;
grant execute on function public.my_sessions() to authenticated;
