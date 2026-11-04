import type { Account, InvestmentType } from "@/types"
import { INVESTMENT_TYPE_RISK } from "@/lib/constants/investment-types"

/** The shock group shared by every account without an investment type */
export const UNTYPED_RISK_GROUP = "untyped"

export interface AccountRisk {
  /** Annual volatility the simulation draws, decimal */
  volatility: number
  /** ρ: how much the account moves with the shared market shock (0–1) */
  factorLoading: number
  /** Accounts in the same group share one shock sequence */
  riskGroup: InvestmentType | typeof UNTYPED_RISK_GROUP
  investmentType: InvestmentType | null
  /**
   * The account's market return in the historical stress test's bad year, decimal;
   * null = it does not fall (keeps its own expected return).
   */
  stressReturn: number | null
}

/**
 * Stress return for an untyped account with a non-zero expected return: the SA equity
 * figure (−37.6%, the 2008–09 category fall). Untyped accounts already take the global
 * EQUITY volatility in Monte Carlo, so treating them as SA equity here is the consistent,
 * cautious reading; a 0% expected return still marks cash, which does not fall.
 */
export const UNTYPED_STRESS_RETURN = INVESTMENT_TYPE_RISK.sa_equity.stressReturn

/**
 * The volatility and market loading for one account — the single place this is decided.
 * Monte Carlo calls it per account; the stress test and debug window must call it too
 * rather than re-deriving the rule.
 *
 * An account WITHOUT an investment type keeps the pre-feature behaviour exactly: the
 * global `untypedVolatility` (or 0 when its expected return is 0%, the old marker for a
 * cash/fixed account) and a full market loading, so it moves in lockstep with the market.
 * Existing plans are never silently reinterpreted.
 *
 * A typed account takes its type's researched volatility and loading regardless of its
 * expected return; the type is the more specific statement of what it holds.
 *
 * @param untypedVolatility - decimal (0.165 = 16.5%); required, so every caller states
 *   which global figure applies to untyped accounts
 */
export function resolveAccountRisk(
  account: Pick<Account, "expectedReturn" | "investmentType">,
  untypedVolatility: number,
): AccountRisk {
  const type = account.investmentType
  if (type && type in INVESTMENT_TYPE_RISK) {
    const { volatility, factorLoading, stressReturn } = INVESTMENT_TYPE_RISK[type]
    return { volatility, factorLoading, riskGroup: type, investmentType: type, stressReturn }
  }
  const isCash = account.expectedReturn === 0
  return {
    volatility: isCash ? 0 : untypedVolatility,
    factorLoading: 1,
    riskGroup: UNTYPED_RISK_GROUP,
    investmentType: null,
    stressReturn: isCash ? null : UNTYPED_STRESS_RETURN,
  }
}
