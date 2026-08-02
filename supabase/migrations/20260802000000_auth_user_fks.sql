-- session_id columns were plain uuids with no referential integrity. Deleting a user
-- orphaned every row they owned: the data survived, unreachable and unattributed.
-- Adding the constraint requires clearing pre-existing orphans first, or it fails.

delete from expenses       where session_id not in (select id from auth.users);
delete from expense_groups where session_id not in (select id from auth.users);
-- Deleting orphaned scenarios cascades to accounts via the pre-existing
-- accounts.scenario_id -> scenarios(id) FK constraint, removing their accounts too.
delete from scenarios      where session_id not in (select id from auth.users);

alter table scenarios
  add constraint scenarios_session_id_fkey
  foreign key (session_id) references auth.users (id) on delete cascade;

alter table expense_groups
  add constraint expense_groups_session_id_fkey
  foreign key (session_id) references auth.users (id) on delete cascade;

alter table expenses
  add constraint expenses_session_id_fkey
  foreign key (session_id) references auth.users (id) on delete cascade;

-- accounts already cascades via accounts.scenario_id -> scenarios(id) on delete cascade,
-- and scenarios now cascades from auth.users, so accounts are reached transitively.
