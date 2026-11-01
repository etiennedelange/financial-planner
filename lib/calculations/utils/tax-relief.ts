import { TAX_RELIEF_HISTORY } from "@/lib/constants/tax-relief-history"
import type { TaxThresholdRelief } from "@/types"
import type { DecimalRate } from "./money-time"

/**
 * Annual growth rate of each group of SA tax thresholds, as decimals. Each group scales
 * as one unit: an income tax table's brackets, rebates and s6A credits must share one
 * factor for `calculateIndexedIncomeTax` to be exact.
 */
export interface TaxThresholdIndexation {
  /** Brackets, rebates and s6A medical credits */
  incomeTax: DecimalRate
  /** Retirement lump-sum tax table */
  lumpSum: DecimalRate
  /** s11F rand cap on retirement fund deductions (the 27.5% rate never changes) */
  retirementDeductionCap: DecimalRate
  /** CGT annual exclusion */
  cgtExclusion: DecimalRate
}

export const DEFAULT_TAX_THRESHOLD_RELIEF: TaxThresholdRelief = "historical"

const years = TAX_RELIEF_HISTORY.cpiAnnualAveragePercent.length

function annualGrowth({ from, to }: { from: number; to: number }): number {
  return Math.pow(to / from, 1 / years) - 1
}

/** Average annual CPI over the history window, as a decimal (≈ 4.87%). */
export const HISTORICAL_CPI_RATE: DecimalRate =
  Math.pow(
    TAX_RELIEF_HISTORY.cpiAnnualAveragePercent.reduce((f, pct) => f * (1 + pct / 100), 1),
    1 / years,
  ) - 1

/**
 * The share of inflation SARS passed on to each threshold group over the history window:
 * annual threshold growth ÷ annual CPI. The income tax share averages the primary rebate,
 * the 18% bracket ceiling and the main-member medical credit, which moved together.
 */
export const HISTORICAL_RELIEF_SHARE: Readonly<Record<keyof TaxThresholdIndexation, number>> =
  (() => {
    const t = TAX_RELIEF_HISTORY.thresholds
    const share = (g: number) => g / HISTORICAL_CPI_RATE
    return {
      incomeTax:
        (share(annualGrowth(t.primaryRebate)) +
          share(annualGrowth(t.firstBracketCeiling)) +
          share(annualGrowth(t.medicalCreditMainMember))) /
        3,
      lumpSum: share(annualGrowth(t.retirementLumpSumTaxFree)),
      retirementDeductionCap: share(annualGrowth(t.retirementDeductionCap)),
      cgtExclusion: share(annualGrowth(t.cgtAnnualExclusion)),
    }
  })()

/**
 * Resolve the tax-relief assumption into growth rates for the plan's inflation rate.
 *
 * `historical` applies each group's historical share to the PLAN's inflation, not the
 * historical CPI, so a higher inflation assumption also brings proportionally more relief —
 * relief is a response to inflation, not a fixed rand schedule.
 *
 * @param relief - the user's setting; `undefined` (plans saved before 2026-10-31) means
 *   {@link DEFAULT_TAX_THRESHOLD_RELIEF}
 * @param inflationRate - the plan's inflation as a decimal (0.055)
 */
export function resolveTaxThresholdIndexation(
  relief: TaxThresholdRelief | undefined,
  inflationRate: DecimalRate,
): TaxThresholdIndexation {
  const rate = Number.isFinite(inflationRate) ? inflationRate : 0
  const mode = relief ?? DEFAULT_TAX_THRESHOLD_RELIEF
  if (mode === "none") {
    return { incomeTax: 0, lumpSum: 0, retirementDeductionCap: 0, cgtExclusion: 0 }
  }
  if (mode === "full") {
    return { incomeTax: rate, lumpSum: rate, retirementDeductionCap: rate, cgtExclusion: rate }
  }
  return {
    incomeTax: HISTORICAL_RELIEF_SHARE.incomeTax * rate,
    lumpSum: HISTORICAL_RELIEF_SHARE.lumpSum * rate,
    retirementDeductionCap: HISTORICAL_RELIEF_SHARE.retirementDeductionCap * rate,
    cgtExclusion: HISTORICAL_RELIEF_SHARE.cgtExclusion * rate,
  }
}

const pct = (decimal: number) => `${(decimal * 100).toFixed(1)}%`

/**
 * Plain-English caveat for the chosen assumption, shown next to projected tax figures.
 *
 * @param inflationRatePercent - the plan's inflation as a percentage (5.5)
 */
export function describeTaxReliefAssumption(
  relief: TaxThresholdRelief | undefined,
  inflationRatePercent: number,
): string {
  const mode = relief ?? DEFAULT_TAX_THRESHOLD_RELIEF
  const unknowable =
    "Treasury sets relief in each Budget, so future tax cannot be known and will differ."
  if (mode === "none") {
    return `Stress test: future tax uses today's ${TAX_RELIEF_HISTORY.toTaxYear} brackets and limits forever, with no inflation relief, so tax takes a larger real share every year. ${unknowable}`
  }
  if (mode === "full") {
    return `Assumes tax brackets and limits rise with inflation every year — more relief than SARS granted from ${TAX_RELIEF_HISTORY.fromTaxYear} to ${TAX_RELIEF_HISTORY.toTaxYear}. ${unknowable}`
  }
  const indexation = resolveTaxThresholdIndexation("historical", inflationRatePercent / 100)
  return `Assumes SARS keeps raising thresholds as it did from ${TAX_RELIEF_HISTORY.fromTaxYear} to ${TAX_RELIEF_HISTORY.toTaxYear}: tax brackets by ${pct(indexation.incomeTax)} a year (about ${Math.round(HISTORICAL_RELIEF_SHARE.incomeTax * 100)}% of your ${inflationRatePercent}% inflation), the R550k tax-free lump sum by ${pct(indexation.lumpSum)}. ${unknowable}`
}
