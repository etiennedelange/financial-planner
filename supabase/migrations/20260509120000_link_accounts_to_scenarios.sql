-- Link accounts to scenarios (per-scenario isolation)
alter table accounts add column scenario_id uuid references scenarios(id) on delete cascade;

update accounts
set scenario_id = (
  select id from scenarios
  where scenarios.session_id = accounts.session_id
  order by updated_at desc
  limit 1
);

delete from accounts where scenario_id is null;

alter table accounts alter column scenario_id set not null;

create index accounts_scenario_id_idx on accounts (scenario_id);

drop policy if exists "session users can manage their own accounts" on accounts;

create policy "users can manage accounts in their scenarios"
  on accounts for all
  using (
    scenario_id in (
      select id from scenarios where session_id = (select auth.uid())
    )
  )
  with check (
    scenario_id in (
      select id from scenarios where session_id = (select auth.uid())
    )
  );

-- session_id on accounts is no longer used for RLS
alter table accounts alter column session_id drop not null;
