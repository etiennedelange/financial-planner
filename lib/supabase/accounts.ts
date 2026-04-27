import type { Account } from "@/types"
import { createClient } from "./client"

type AccountRow = {
  id: string
  session_id: string
  name: string
  provider: string
  type: Account["type"]
  current_balance: number
  monthly_contribution: number
  expected_return: number
  annual_fees: number
  contribution_escalation: number
}

function toRow(account: Account, sessionId: string): AccountRow {
  return {
    id: account.id,
    session_id: sessionId,
    name: account.name,
    provider: account.provider,
    type: account.type,
    current_balance: account.currentBalance,
    monthly_contribution: account.monthlyContribution,
    expected_return: account.expectedReturn,
    annual_fees: account.annualFees,
    contribution_escalation: account.contributionEscalation,
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
  }
}

export async function fetchAccounts(sessionId: string): Promise<Account[]> {
  const supabase = createClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at")

  if (error) throw error
  return (data ?? []).map((row) => fromRow(row as AccountRow))
}

export async function upsertAccount(account: Account, sessionId: string): Promise<void> {
  const supabase = createClient()
  if (!supabase) return
  const { error } = await supabase
    .from("accounts")
    .upsert(toRow(account, sessionId), { onConflict: "id" })

  if (error) throw error
}

export async function deleteAccount(id: string): Promise<void> {
  const supabase = createClient()
  if (!supabase) return
  const { error } = await supabase.from("accounts").delete().eq("id", id)
  if (error) throw error
}
