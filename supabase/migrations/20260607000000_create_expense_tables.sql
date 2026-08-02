create table expense_groups (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null,
  name        text not null,
  color       text not null default '#6366f1',
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index expense_groups_session_id_idx on expense_groups (session_id);

alter table expense_groups enable row level security;

create policy "users can manage their own expense groups"
  on expense_groups for all
  using (session_id = (select auth.uid()))
  with check (session_id = (select auth.uid()));

create trigger expense_groups_updated_at
  before update on expense_groups
  for each row execute function update_updated_at();

create table expenses (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null,
  group_id       uuid not null references expense_groups(id) on delete cascade,
  name           text not null,
  amount         numeric(12,2) not null default 0,
  in_retirement  boolean not null default true,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index expenses_session_id_idx on expenses (session_id);
create index expenses_group_id_idx   on expenses (group_id);

alter table expenses enable row level security;

create policy "users can manage their own expenses"
  on expenses for all
  using (session_id = (select auth.uid()))
  with check (session_id = (select auth.uid()));

create trigger expenses_updated_at
  before update on expenses
  for each row execute function update_updated_at();
