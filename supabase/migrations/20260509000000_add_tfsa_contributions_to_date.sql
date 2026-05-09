alter table accounts
  add column if not exists tfsa_contributions_to_date numeric null;

comment on column accounts.tfsa_contributions_to_date is
  'TFSA only: cumulative past contributions in rands (excludes growth). Used to enforce R500k lifetime limit.';
