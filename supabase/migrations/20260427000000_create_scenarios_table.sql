create table scenarios (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique,
  personal_info jsonb not null default '{}',
  retirement_goals jsonb not null default '{}',
  assumptions jsonb not null default '{}',
  drawdown_config jsonb not null default '{}',
  display_mode text not null default 'nominal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index scenarios_session_id_idx on scenarios (session_id);

alter table scenarios enable row level security;

create policy "session users can manage their own scenario"
  on scenarios
  for all
  using (session_id = (select auth.uid()))
  with check (session_id = (select auth.uid()));

create trigger scenarios_updated_at
  before update on scenarios
  for each row execute function update_updated_at();
