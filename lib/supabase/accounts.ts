import type { Account } from "@/types"
import { createClient } from "./client"

type AccountRow = {
  id: string
  scenario_id: string
  session_id?: string | null
  name: string
  provider: string
  type: Account["type"]
  current_balance: number
  monthly_contribution: number
  expected_return: number
  annual_fees: number
  contribution_escalation: number
  tfsa_contributions_to_date?: number | null
}

function toRow(account: Account, scenarioId: string): Omit<AccountRow, "session_id"> {
  return {
    id: account.id,
    scenario_id: scenarioId,
    name: account.name,
    provider: account.provider,
    type: account.type,
    current_balance: account.currentBalance,
    monthly_contribution: account.monthlyContribution,
    expected_return: account.expectedReturn,
    annual_fees: account.annualFees,
    contribution_escalation: account.contributionEscalation,
    tfsa_contributions_to_date: account.tfsaContributionsToDate ?? null,
  }
}

function fromRow(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    type: row.type,
    currentBalance: row.current_balance,
    monthlyContribution: row.monthly_contribution,
    expectedReturn: row.expected_return,
    annualFees: row.annual_fees,
    contributionEscalation: row.contribution_escalation,
    tfsaContributionsToDate: row.tfsa_contributions_to_date ?? undefined,
  }
}

export async function fetchAccounts(scenarioId: string): Promise<Account[]> {
  const supabase = createClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("scenario_id", scenarioId)
    .order("created_at")
  if (error) throw error
  return (data ?? []).map((row) => fromRow(row as AccountRow))
}

export async function upsertAccount(account: Account, scenarioId: string): Promise<void> {
  const supabase = createClient()
  if (!supabase) return
  const { error } = await supabase
    .from("accounts")
    .upsert(toRow(account, scenarioId), { onConflict: "id" })
  if (error) throw error
}

export async function cloneAccounts(accounts: Account[], newScenarioId: string): Promise<Account[]> {
  const supabase = createClient()
  if (!supabase) return []
  const cloned = accounts.map((acc) => ({
    ...acc,
    id: crypto.randomUUID(),
  }))
  const rows = cloned.map((acc) => toRow(acc, newScenarioId))
  const { error } = await supabase.from("accounts").insert(rows)
  if (error) throw error
  return cloned
}

export async function deleteAccount(id: string): Promise<void> {
  const supabase = createClient()
  if (!supabase) return
  const { error } = await supabase.from("accounts").delete().eq("id", id)
  if (error) throw error
}
