alter table accounts
  add column if not exists investment_type text null;

alter table accounts
  drop constraint if exists accounts_investment_type_check;

alter table accounts
  add constraint accounts_investment_type_check
  check (
    investment_type is null
    or investment_type in (
      'cash',
      'conservative',
      'balanced',
      'sa_equity',
      'global_equity',
      'concentrated_equity'
    )
  );

comment on column accounts.investment_type is
  'What the account is invested in (separate from its tax wrapper in "type"). Drives Monte Carlo volatility and correlation; figures in lib/constants/investment-types.ts. Null = untyped: global equity volatility, full market correlation.';
