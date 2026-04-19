create table accounts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  name text not null,
  provider text not null default '',
  type text not null check (type in ('pension_fund', 'retirement_annuity', 'preservation_fund', 'tfsa', 'discretionary')),
  current_balance numeric(15,2) not null default 0,
  monthly_contribution numeric(15,2) not null default 0,
  expected_return numeric(5,2) not null default 0,
  annual_fees numeric(5,2) not null default 0,
  contribution_escalation numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index accounts_session_id_idx on accounts (session_id);

alter table accounts enable row level security;

create policy "session users can manage their own accounts"
  on accounts
  for all
  using (session_id = (select auth.uid()))
  with check (session_id = (select auth.uid()));

create function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger accounts_updated_at
  before update on accounts
  for each row execute function update_updated_at();
