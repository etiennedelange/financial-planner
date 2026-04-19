import type { Account } from "@/types"
import { createClient } from "./client"

function toRow(account: Account, sessionId: string) {
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

function fromRow(row: Record<string, unknown>): Account {
  return {
    id: row.id as string,
    name: row.name as string,
    provider: row.provider as string,
    type: row.type as Account["type"],
    currentBalance: Number(row.current_balance),
    monthlyContribution: Number(row.monthly_contribution),
    expectedReturn: Number(row.expected_return),
    annualFees: Number(row.annual_fees),
    contributionEscalation: Number(row.contribution_escalation),
  }
}

export async function fetchAccounts(sessionId: string): Promise<Account[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at")

  if (error) throw error
  return (data ?? []).map(fromRow)
}

export async function upsertAccount(account: Account, sessionId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("accounts")
    .upsert(toRow(account, sessionId), { onConflict: "id" })

  if (error) throw error
}

export async function deleteAccount(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("accounts").delete().eq("id", id)
  if (error) throw error
}
