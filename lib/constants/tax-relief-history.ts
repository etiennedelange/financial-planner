/**
 * Observed SA tax-threshold relief over the decade 2016/17 → 2026/27, the evidence behind
 * the `historical` tax-relief assumption. Each figure is the published SARS value; the
 * engines derive growth rates and shares of inflation from these in
 * `lib/calculations/utils/tax-relief.ts`, so updating a number here updates the assumption.
 *
 * Sources (verified 2026-10-31):
 * - Rebates, 18% bracket ceiling, medical credits, lump-sum table 2016/17–2026/27:
 *   https://www.sars.gov.za/tax-rates/archive-tax-rates/ and the current SARS rates pages
 * - s11F cap R350,000 → R430,000 and CGT exclusion R40,000 → R50,000 ("first increase
 *   since 2017", i.e. the 2016/17 tax year): SARS Budget 2026 FAQ
 * - CPI: Stats SA annual averages for 2023 (6.0%), 2024 (4.4%) and 2025 (3.2%); 2016–2022
 *   from inflation-rates.com because Stats SA's CPI history PDF refuses automated access.
 *   A second aggregator series moves the decade's average by 0.04 points, which changes no
 *   share by more than 0.01.
 *
 * Relief is granted unevenly: brackets were not adjusted for 2019/20, 2024/25 or 2025/26,
 * the R550k lump-sum band moved once (2023/24), and the s11F cap and CGT exclusion each
 * moved once (2026/27). A decade-average smooths those steps into an annual rate.
 *
 * To refresh: move the window forward one year, replacing `from` values with the next
 * year's and appending the latest year's CPI.
 */
export const TAX_RELIEF_HISTORY = {
  fromTaxYear: "2016/17",
  toTaxYear: "2026/27",
  /** Calendar-year average headline CPI, %, for the inflation each Budget responded to. */
  cpiAnnualAveragePercent: [6.6, 5.2, 4.5, 4.1, 3.2, 4.6, 7.0, 6.0, 4.4, 3.2],
  thresholds: {
    /** Income tax: primary rebate, 18% bracket ceiling, s6A main-member credit (monthly) */
    primaryRebate: { from: 13500, to: 17820 },
    firstBracketCeiling: { from: 188000, to: 245100 },
    medicalCreditMainMember: { from: 286, to: 376 },
    /** Retirement lump-sum table: top of the 0% band */
    retirementLumpSumTaxFree: { from: 500000, to: 550000 },
    /** s11F annual rand cap on retirement fund deductions */
    retirementDeductionCap: { from: 350000, to: 430000 },
    /** CGT annual exclusion for individuals */
    cgtAnnualExclusion: { from: 40000, to: 50000 },
  },
} as const
