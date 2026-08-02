import type { Account, DrawdownConfig, MarketAssumptions, PersonalInfo, RetirementGoals } from "@/types"
import type { Expense, ExpenseGroup } from "@/types/expenses"
import { createScenario, listScenarios } from "./scenarios"
import { cloneAccounts } from "./accounts"
import { migrateExpensesToSession } from "./expenses"

export interface LocalSnapshot {
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
  assumptions: MarketAssumptions
  drawdownConfig: DrawdownConfig
  displayMode: "nominal" | "real"
  accounts: Account[]
  expenseGroups: ExpenseGroup[]
  expenses: Expense[]
}

export type ClaimResult =
  | { claimed: true; scenarioId: string }
  | { claimed: false; reason: "server-has-data" | "nothing-local" }

/**
 * Migrates a signed-out visitor's localStorage work into their account on first sign-in.
 *
 * The rule: claim ONLY when the account has zero scenarios server-side. A returning user
 * signing in on a borrowed browser must never have server data overwritten by whatever is
 * in that browser. There is deliberately no merge — two divergent retirement plans have no
 * correct merge, and guessing produces numbers the user cannot explain.
 *
 * Safe to interrupt: a failure part-way through throws, leaving localStorage intact so the
 * next sign-in retries. Safe to call repeatedly — the second call sees server data and stops.
 */
export async function claimLocalData(
  userId: string,
  local: LocalSnapshot
): Promise<ClaimResult> {
  const existing = await listScenarios(userId)
  if (existing.length > 0) return { claimed: false, reason: "server-has-data" }

  const scenarioId = await createScenario(userId, "My Plan", {
    personalInfo: local.personalInfo,
    retirementGoals: local.retirementGoals,
    assumptions: local.assumptions,
    drawdownConfig: local.drawdownConfig,
    displayMode: local.displayMode,
  })

  await cloneAccounts(local.accounts, scenarioId)
  await migrateExpensesToSession(userId, local.expenseGroups, local.expenses)

  return { claimed: true, scenarioId }
}
