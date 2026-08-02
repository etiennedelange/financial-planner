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

const PENDING_CLAIM_KEY = "rc-pending-claim-scenario-id"

/**
 * Migrates a signed-out visitor's localStorage work into their account on first sign-in.
 *
 * The rule: claim ONLY when the account has zero scenarios server-side, or has exactly one
 * unfinished claim that THIS browser started. A returning user signing in on a borrowed
 * browser must never have server data overwritten by whatever is in that browser. There is
 * deliberately no merge — two divergent retirement plans have no correct merge, and guessing
 * produces numbers the user cannot explain.
 *
 * Resumable, not just interruptible — and ownership-checked, not just presence-checked. The
 * scenario row `claimLocalData` creates starts with `claim_complete = false` and is only
 * marked complete after accounts and expenses finish copying. If a failure happens between
 * those steps, only the browser that started the claim can resume it: the scenario's id is
 * generated client-side and stashed in localStorage BEFORE the row is created, so a different
 * device has no way to guess it and falls back to `server-has-data` instead. Without this,
 * a second device signing in before the first retries would see the same incomplete scenario,
 * find it has no accounts yet, and clone ITS OWN local accounts into the first device's
 * scenario — silently overwriting what the first device was trying to claim. `cloneAccounts`
 * is skipped on resume if accounts already made it across; `migrateExpensesToSession` is
 * naturally idempotent (it no-ops once the session has its own expense data), so it's safe to
 * call unconditionally. A failure before `createScenario` succeeds leaves no server row at
 * all, so the same device's next attempt overwrites the stale pending id and retries fresh.
 * Safe to call repeatedly — once nothing resumable is found and a scenario exists, it reports
 * `server-has-data` and stops.
 *
 * Known gap: if this browser's localStorage is cleared between creating the scenario and
 * finishing the claim, that scenario becomes permanently unresumable from any device (every
 * future sign-in sees `existing.length > 0` and stops) — stuck but safe, not silently wrong,
 * consistent with this function's guarantees, but with no self-service recovery yet.
 */
export async function claimLocalData(
  userId: string,
  local: LocalSnapshot
): Promise<ClaimResult> {
  const existing = await listScenarios(userId)
  const pendingId = localStorage.getItem(PENDING_CLAIM_KEY)
  const ownIncomplete = pendingId
    ? existing.find((s) => s.id === pendingId && !s.claimComplete)
    : undefined

  if (ownIncomplete) {
    const alreadyCloned = await fetchAccounts(ownIncomplete.id)
    if (alreadyCloned.length === 0) {
      await cloneAccounts(local.accounts, ownIncomplete.id)
    }
    await migrateExpensesToSession(userId, local.expenseGroups, local.expenses)
    await markScenarioClaimComplete(ownIncomplete.id)
    localStorage.removeItem(PENDING_CLAIM_KEY)
    return { claimed: true, scenarioId: ownIncomplete.id }
  }

  if (existing.length > 0) return { claimed: false, reason: "server-has-data" }

  const scenarioId = crypto.randomUUID()
  localStorage.setItem(PENDING_CLAIM_KEY, scenarioId)

  await createScenario(
    userId,
    "My Plan",
    {
      personalInfo: local.personalInfo,
      retirementGoals: local.retirementGoals,
      assumptions: local.assumptions,
      drawdownConfig: local.drawdownConfig,
      displayMode: local.displayMode,
    },
    false,
    scenarioId
  )

  await cloneAccounts(local.accounts, scenarioId)
  await migrateExpensesToSession(userId, local.expenseGroups, local.expenses)
  await markScenarioClaimComplete(scenarioId)
  localStorage.removeItem(PENDING_CLAIM_KEY)

  return { claimed: true, scenarioId }
}
