import type { Account, DrawdownConfig, MarketAssumptions, PersonalInfo, RetirementGoals } from "@/types"
import type { Expense, ExpenseGroup } from "@/types/expenses"
import { createScenario, listScenarios, markScenarioClaimComplete } from "./scenarios"
import { cloneAccounts, fetchAccounts } from "./accounts"
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
 * The rule: claim ONLY when the account has zero scenarios server-side, or has exactly one
 * unfinished claim of its own. A returning user signing in on a borrowed browser must never
 * have server data overwritten by whatever is in that browser. There is deliberately no
 * merge — two divergent retirement plans have no correct merge, and guessing produces
 * numbers the user cannot explain.
 *
 * Resumable, not just interruptible: the scenario row `claimLocalData` creates starts with
 * `claim_complete = false` and is only marked complete after accounts and expenses finish
 * copying. If a failure happens between those steps, the next sign-in finds that same
 * incomplete scenario (by the flag, not by guessing from empty data — a real account can
 * legitimately have a scenario with zero accounts) and finishes the copy rather than either
 * losing it or refusing to retry. `cloneAccounts` is skipped on resume if accounts already
 * made it across; `migrateExpensesToSession` is naturally idempotent (it no-ops once the
 * session has its own expense data), so it's safe to call unconditionally. A failure before
 * `createScenario` succeeds leaves no server row at all, so localStorage is retried as a
 * fresh claim. Safe to call repeatedly — once nothing is incomplete and a scenario exists,
 * it reports `server-has-data` and stops.
 */
export async function claimLocalData(
  userId: string,
  local: LocalSnapshot
): Promise<ClaimResult> {
  const existing = await listScenarios(userId)
  const incomplete = existing.find((s) => !s.claimComplete)

  if (incomplete) {
    const alreadyCloned = await fetchAccounts(incomplete.id)
    if (alreadyCloned.length === 0) {
      await cloneAccounts(local.accounts, incomplete.id)
    }
    await migrateExpensesToSession(userId, local.expenseGroups, local.expenses)
    await markScenarioClaimComplete(incomplete.id)
    return { claimed: true, scenarioId: incomplete.id }
  }

  if (existing.length > 0) return { claimed: false, reason: "server-has-data" }

  const scenarioId = await createScenario(
    userId,
    "My Plan",
    {
      personalInfo: local.personalInfo,
      retirementGoals: local.retirementGoals,
      assumptions: local.assumptions,
      drawdownConfig: local.drawdownConfig,
      displayMode: local.displayMode,
    },
    false
  )

  await cloneAccounts(local.accounts, scenarioId)
  await migrateExpensesToSession(userId, local.expenseGroups, local.expenses)
  await markScenarioClaimComplete(scenarioId)

  return { claimed: true, scenarioId }
}
