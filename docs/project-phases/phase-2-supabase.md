# Phase 2: Supabase Integration 🔲 PENDING

**Goal:** Set up database infrastructure for persistent data storage.

**Tasks:**
- [ ] Initialize Supabase project
- [ ] Design database schema:
  - `users` table (handled by Supabase Auth)
  - `accounts` table (retirement accounts per user)
  - `scenarios` table (saved calculation scenarios)
  - `calculation_history` table (historical results)
- [ ] Implement Row Level Security (RLS) policies
- [ ] Set up database migrations
- [ ] Create TypeScript types from database schema

**Schema Design:**
```sql
-- accounts table
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT,
  type TEXT NOT NULL, -- pension_fund, retirement_annuity, preservation_fund, tfsa, discretionary
  current_balance DECIMAL(15,2) NOT NULL,
  monthly_contribution DECIMAL(15,2) NOT NULL,
  expected_return DECIMAL(5,2) NOT NULL,
  annual_fees DECIMAL(5,2) NOT NULL,
  contribution_escalation DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- scenarios table
CREATE TABLE scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  personal_info JSONB NOT NULL,
  retirement_goals JSONB NOT NULL,
  assumptions JSONB NOT NULL,
  drawdown_config JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```
