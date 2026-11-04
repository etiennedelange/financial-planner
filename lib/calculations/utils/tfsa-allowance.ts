import { TFSA_LIMITS_CONFIG } from "@/lib/constants/tax-year.config"
import type { Account } from "@/types"

/**
 * A taxpayer's remaining TFSA contribution room, shared by ALL of their TFSA accounts.
 *
 * The annual (R46,000) and lifetime (R500,000) limits apply to the person, in aggregate
 * across every TFSA they hold (SARS Budget 2026 FAQ). Both engines previously tracked the
 * limits per account, so two TFSAs at R4,000/month each admitted R92,000 a year; and
 * Monte Carlo did not enforce them at all, so its TFSA balances could be several times the
 * deterministic engine's for the same inputs.
 *
 * The limits are NOT indexed for inflation, unlike the tax thresholds (see
 * `taxThresholdScale`). The lifetime limit has not changed since TFSAs launched in 2015,
 * and the annual limit has moved only by occasional legislated steps, so holding them at
 * their nominal 2026/27 values is the conservative assumption.
 *
 * Years here are projection years starting today, not March-to-February tax years.
 */
export interface TfsaAllowance {
  lifetimeUsed: number
  usedThisYear: number
}

/** Seed the lifetime usage from every TFSA's contributions to date. */
export function createTfsaAllowance(accounts: Account[]): TfsaAllowance {
  const lifetimeUsed = accounts.reduce(
    (sum, acc) => (acc.type === "tfsa" ? sum + Math.max(0, acc.tfsaContributionsToDate ?? 0) : sum),
    0,
  )
  return { lifetimeUsed, usedThisYear: 0 }
}

/** Reset the annual counter at the start of each projection year. */
export function startTfsaYear(allowance: TfsaAllowance): void {
  allowance.usedThisYear = 0
}

/**
 * Admit as much of `intended` as the remaining annual and lifetime room allows.
 *
 * @returns the admitted amount (to be invested) and the excess. The excess is not
 *   invested anywhere — it is reported so the UI can show the 40% penalty that would apply
 *   had it been contributed.
 */
export function admitTfsaContribution(
  allowance: TfsaAllowance,
  intended: number,
): { admitted: number; excess: number } {
  const remainingLifetime = Math.max(0, TFSA_LIMITS_CONFIG.lifetimeLimit - allowance.lifetimeUsed)
  const remainingAnnual = Math.max(0, TFSA_LIMITS_CONFIG.annualLimit - allowance.usedThisYear)
  const admitted = Math.max(0, Math.min(intended, remainingLifetime, remainingAnnual))
  allowance.lifetimeUsed += admitted
  allowance.usedThisYear += admitted
  return { admitted, excess: Math.max(0, intended - admitted) }
}
