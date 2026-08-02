-- Tracks whether a claimLocalData() call finished copying accounts/expenses
-- after creating the scenario row. Without this, a claim interrupted between
-- creating the scenario and finishing the copy is indistinguishable from a
-- real, established (if currently empty) account — and a naive retry would
-- either silently drop the missing data forever, or wrongly merge unrelated
-- local browser data into someone else's real account.
alter table scenarios
  add column claim_complete boolean not null default true;
