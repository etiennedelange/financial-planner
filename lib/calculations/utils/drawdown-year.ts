import { SA_TAX_LIMITS } from "@/lib/constants/limits"
import type { AccountType } from "@/types"
import { safePositiveDivide } from "./invariant-guards"

/**
 * One drawdown year, shared by the deterministic projection and Monte Carlo.
 *
 * This logic previously existed twice — inline in `projection-engine.ts` and copied into
 * `simulation-engine.ts` — the third instance of the copy-don't-export pattern CLAUDE.md
 * warns about. Moving it here also fixed three defects the two copies shared:
 *
 * 1. TIMING. Each pot grew for a full year and the whole year's income was then withdrawn
 *    in one go at year-end, so money spent in February still earned a full year's return.
 *    Income is now paid in 12 equal instalments at each month-end.
 * 2. COMPOUNDING. Drawdown growth was `balance × annualRate` regardless of
 *    `compoundingMethod`, while accumulation compounded monthly. Under `nominal` that is
 *    12.68% effective before retirement but 12.00% after it. Growth now uses the same
 *    monthly rate as accumulation.
 * 3. LIVING ANNUITY BAND. Nothing stopped the model drawing nothing — or everything — from
 *    a pension/RA/preservation fund in a year. The annuitised part of those funds is
 *    modelled as a living annuity, which must pay between 2.5% and 17.5% of its value at
 *    each anniversary. See `LIVING_ANNUITY_DRAWDOWN_BAND_CONFIG`.
 *
 * The withdrawal order is documented on `runDrawdownYear`.
 */

/** Account types whose drawdown is annuity income taxed in full. */
export const PENSION_TYPES: readonly AccountType[] = [
  "pension_fund",
  "retirement_annuity",
  "preservation_fund",
]

export function isPensionType(type: AccountType): boolean {
  return PENSION_TYPES.includes(type)
}

/** The per-account state a drawdown year reads and updates. */
export interface DrawdownPot {
  type: AccountType
  balance: number
  /** Discretionary only: the cost base still invested, for the CGT gain on withdrawal. */
  costBasis: number
}

export interface DrawdownYearOutcome {
  tfsaWithdrawal: number
  discretionaryWithdrawal: number
  pensionWithdrawal: number
  /** Gain portion of discretionary withdrawals, BEFORE the annual exclusion. */
  capitalGainRealized: number
  /** Net-of-fee investment return earned across all pots over the year. */
  growth: number
  /**
   * The pots could not pay the full target this year: they ran out, or the only money
   * left sits in a living annuity already at its 17.5% ceiling.
   */
  shortfall: boolean
}

/**
 * Timing factors for a year in which a total `W` is paid out in 12 equal month-end
 * instalments from a balance `B` earning `monthlyRate` per month:
 *
 *   ending balance = B × growthFactor − W × withdrawalFactor
 *
 * growthFactor = (1 + i)^12, and withdrawalFactor = ((1 + i)^12 − 1) / (12i) is the
 * year-end value of R1/12 paid at each month-end (the future-value annuity factor divided
 * by 12). At i = 0 both are 1, which is the plain `B − W`.
 */
export function monthlyWithdrawalFactors(monthlyRate: number): {
  growthFactor: number
  withdrawalFactor: number
} {
  // A month cannot lose more than everything; below -100% the factors stop meaning anything.
  const i = Number.isFinite(monthlyRate) ? Math.max(-1, monthlyRate) : 0
  const growthFactor = Math.pow(1 + i, 12)
  const withdrawalFactor = Math.abs(i) < 1e-12 ? 1 : (growthFactor - 1) / (12 * i)
  return { growthFactor, withdrawalFactor }
}

/** Relative tolerance below which an unfunded remainder is floating-point noise. */
const SHORTFALL_TOLERANCE = 1e-9

/**
 * Pay one year's income from the pots, mutating their balances and cost bases.
 *
 * Order, chosen to minimise tax over the whole retirement while staying within the living
 * annuity rules:
 *   1. the compulsory 2.5% minimum from each living annuity (it must be paid regardless)
 *   2. more living-annuity income, up to `pensionTaxFreeRoom` — income below the tax-free
 *      threshold costs nothing now, and that room is lost if unused this year
 *   3. discretionary — only the gain is taxed, via CGT with its own annual exclusion
 *   4. more living-annuity income, up to each annuity's 17.5% ceiling
 *   5. TFSA last — tax-free for ever, with no compulsory draw, so it is the reserve that
 *      pays the gap once an annuity reaches its 17.5% ceiling
 *
 * Before 2026-11-01 the TFSA came second. That spent the tax-free threshold's room on
 * nothing in the early years (taxing the same annuity income later at higher marginal
 * rates) and exhausted the TFSA before the ceiling bound, so plans fell short earlier.
 *
 * If the 2.5% minimum alone exceeds the target, the retiree receives more than the target
 * that year; the excess is income, not reinvested.
 *
 * @param pots - mutated in place
 * @param monthlyRates - each pot's monthly return for this year, from
 *   `calculateMonthlyReturn` so it respects the compounding method; index-aligned with `pots`
 * @param targetWithdrawal - the year's total income target (nominal rands)
 * @param pensionTaxFreeRoom - annuity income this year that attracts no income tax: the
 *   age-based tax threshold for this tax year plus any unused s11F credit. Pass 0 to skip
 *   step 2 (annuity income is then drawn only after discretionary money).
 */
export function runDrawdownYear(
  pots: DrawdownPot[],
  monthlyRates: number[],
  targetWithdrawal: number,
  pensionTaxFreeRoom: number,
): DrawdownYearOutcome {
  const target = Number.isFinite(targetWithdrawal) ? Math.max(0, targetWithdrawal) : 0
  const factors = pots.map((_, k) => monthlyWithdrawalFactors(monthlyRates[k] ?? 0))

  // The most each pot can pay over the year and finish exactly at zero.
  const fundable = pots.map((pot, k) =>
    pot.balance > 0 ? (pot.balance * factors[k].growthFactor) / factors[k].withdrawalFactor : 0,
  )
  // Living annuity band, measured on each annuity's value at the start of the year.
  const ceiling = pots.map((pot, k) =>
    isPensionType(pot.type) && pot.balance > 0
      ? Math.min(fundable[k], pot.balance * SA_TAX_LIMITS.livingAnnuityMaxDrawdownRate)
      : 0,
  )
  const takes = pots.map((pot, k) =>
    isPensionType(pot.type) && pot.balance > 0
      ? Math.min(pot.balance * SA_TAX_LIMITS.livingAnnuityMinDrawdownRate, ceiling[k])
      : 0,
  )

  let remaining = target - takes.reduce((s, t) => s + t, 0)
  /** Draw from pot k until it reaches `limit` in total, the target is met, or `budget` runs out. */
  const drawUpTo = (k: number, limit: number, budget = Infinity) => {
    if (remaining <= 0 || budget <= 0) return 0
    const take = Math.min(remaining, budget, Math.max(0, limit - takes[k]))
    takes[k] += take
    remaining -= take
    return take
  }

  let taxFreeLeft =
    (Number.isFinite(pensionTaxFreeRoom) ? Math.max(0, pensionTaxFreeRoom) : 0) -
    pots.reduce((s, pot, k) => (isPensionType(pot.type) ? s + takes[k] : s), 0)
  pots.forEach((pot, k) => {
    if (isPensionType(pot.type)) taxFreeLeft -= drawUpTo(k, ceiling[k], taxFreeLeft)
  })
  pots.forEach((pot, k) => pot.type === "discretionary" && drawUpTo(k, fundable[k]))
  pots.forEach((pot, k) => isPensionType(pot.type) && drawUpTo(k, ceiling[k]))
  pots.forEach((pot, k) => pot.type === "tfsa" && drawUpTo(k, fundable[k]))

  const outcome: DrawdownYearOutcome = {
    tfsaWithdrawal: 0,
    discretionaryWithdrawal: 0,
    pensionWithdrawal: 0,
    capitalGainRealized: 0,
    growth: 0,
    shortfall: remaining > SHORTFALL_TOLERANCE * Math.max(1, target),
  }

  pots.forEach((pot, k) => {
    const take = takes[k]
    const start = Math.max(0, pot.balance)
    const drained = take > 0 && take >= fundable[k]

    if (pot.type === "discretionary" && take > 0) {
      // Gain share of the start-of-year value; a drained pot uses up its whole cost base.
      const gainFraction = Math.max(
        0,
        Math.min(1, safePositiveDivide(start - pot.costBasis, start)),
      )
      const basisUsed = drained ? pot.costBasis : Math.min(pot.costBasis, take * (1 - gainFraction))
      outcome.capitalGainRealized += Math.max(0, take - basisUsed)
      pot.costBasis = Math.max(0, pot.costBasis - basisUsed)
      outcome.discretionaryWithdrawal += take
    } else if (pot.type === "tfsa") {
      outcome.tfsaWithdrawal += take
    } else if (isPensionType(pot.type)) {
      outcome.pensionWithdrawal += take
    }

    const end = drained
      ? 0
      : Math.max(0, start * factors[k].growthFactor - take * factors[k].withdrawalFactor)
    outcome.growth += end - start + take
    pot.balance = end
  })

  return outcome
}
