-- Issue 2: Force RLS even for the table-owner role.
--          Superusers and service_role (BYPASSRLS) are unaffected.
alter table accounts       force row level security;
alter table scenarios      force row level security;
alter table expense_groups force row level security;
alter table expenses       force row level security;

-- Issue 3: Drop the dead session_id column on accounts.
--          It was made nullable in 20260509120000_link_accounts_to_scenarios and
--          is no longer used for RLS or any application query.
drop index if exists accounts_session_id_idx;
alter table accounts drop column if exists session_id;

-- Issue 4: Fix the update_updated_at trigger function.
--          - Use CREATE OR REPLACE so migrations are idempotent.
--          - Add SET search_path = '' to prevent search-path injection attacks.
create or replace function update_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
