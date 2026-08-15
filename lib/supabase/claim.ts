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

export type ClaimSource = "guest" | "user" | "legacy-unknown"

export type ClaimResult =
  | { claimed: true; scenarioId: string }
  | {
      claimed: false
      reason: "server-has-data" | "nothing-local" | "not-guest-owned" | "legacy-ambiguous"
    }

// Per-user scope: one account's in-flight claim is never read or resumed by
// another (a shared device signing in as a second user would otherwise find the
// first user's incomplete scenario id and clone ITS OWN accounts into it).
function pendingClaimKey(userId: string): string {
  return `rc-pending-claim-scenario-id:${userId}`
}

/**
 * Migrates a signed-out visitor's localStorage work into their account on first sign-in.
 *
 * The rule: claim ONLY when the account has zero scenarios server-side, or has exactly one
 * unfinished claim that THIS browser started. A returning user signing in on a borrowed
 * browser must never have server data overwritten by whatever is in that browser. There is
 * deliberately no merge — two divergent retirement plans have no correct merge, and guessing
 * produces numbers the user cannot explain.
 *
 * The `source` argument is the caller's ownership claim, made explicit at every call site:
 * only `source === "guest"` may enter the automatic claim path. A call site that cannot
 * prove the snapshot is guest-owned must not pass `"guest"`. `"user"` (a re-auth of an
 * existing identity) returns server-wins without copying local state; `"legacy-unknown"`
 * (ambiguous pre-scoping state with no attributable user) is not claimable until the user
 * chooses through legacy-local-plan-prompt, which converts it to the guest scope first.
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
 * Known gap (blast radius narrowed, knowingly out of scope for self-service recovery): if
 * this browser's localStorage is cleared between creating the scenario and finishing the
 * claim, that scenario becomes permanently unresumable from any device (every future sign-in
 * sees `existing.length > 0` and stops) — stuck but safe, not silently wrong. The pending
 * marker is now per-user, so this is limited to the same user on the same browser; another
 * account can never pick up the stranded claim.
 */
export async function claimLocalData(
  userId: string,
  local: LocalSnapshot,
  source: ClaimSource
): Promise<ClaimResult> {
  // Ownership gate, decided by the caller: a non-guest snapshot is never
  // automatically copied into an account.
  if (source === "user") return { claimed: false, reason: "not-guest-owned" }
  if (source === "legacy-unknown") return { claimed: false, reason: "legacy-ambiguous" }

  const existing = await listScenarios(userId)
  const pendingId = localStorage.getItem(pendingClaimKey(userId))
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
    localStorage.removeItem(pendingClaimKey(userId))
    return { claimed: true, scenarioId: ownIncomplete.id }
  }

  if (existing.length > 0) return { claimed: false, reason: "server-has-data" }

  const scenarioId = crypto.randomUUID()
  localStorage.setItem(pendingClaimKey(userId), scenarioId)

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
  localStorage.removeItem(pendingClaimKey(userId))

  return { claimed: true, scenarioId }
}
