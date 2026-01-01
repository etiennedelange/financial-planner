// Retirement lump sum tax table (2024/2025)
export const RETIREMENT_LUMP_SUM_TAX_TABLE = [
  { threshold: 550000, rate: 0, previousTax: 0 },
  { threshold: 770000, rate: 0.18, previousTax: 0 },
  { threshold: 1100000, rate: 0.27, previousTax: 39600 },
  { threshold: Infinity, rate: 0.36, previousTax: 128700 },
] as const

// Income tax brackets (2024/2025)
export const INCOME_TAX_BRACKETS = [
  { min: 0, max: 237100, rate: 0.18, baseTax: 0 },
  { min: 237101, max: 370500, rate: 0.26, baseTax: 42678 },
  { min: 370501, max: 512800, rate: 0.31, baseTax: 77362 },
  { min: 512801, max: 673000, rate: 0.36, baseTax: 121475 },
  { min: 673001, max: 857900, rate: 0.39, baseTax: 179147 },
  { min: 857901, max: 1817000, rate: 0.41, baseTax: 251258 },
  { min: 1817001, max: Infinity, rate: 0.45, baseTax: 644489 },
] as const

/**
 * Calculate income tax based on taxable income
 */
export function calculateIncomeTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0

  for (const bracket of INCOME_TAX_BRACKETS) {
    if (taxableIncome <= bracket.max) {
      return bracket.baseTax + (taxableIncome - bracket.min + 1) * bracket.rate
    }
  }

  // Shouldn't reach here, but handle edge case
  const lastBracket = INCOME_TAX_BRACKETS[INCOME_TAX_BRACKETS.length - 1]
  return (
    lastBracket.baseTax + (taxableIncome - lastBracket.min + 1) * lastBracket.rate
  )
}

/**
 * Calculate retirement lump sum tax
 */
export function calculateLumpSumTax(lumpSum: number): number {
  if (lumpSum <= RETIREMENT_LUMP_SUM_TAX_TABLE[0].threshold) return 0

  for (let i = 1; i < RETIREMENT_LUMP_SUM_TAX_TABLE.length; i++) {
    const bracket = RETIREMENT_LUMP_SUM_TAX_TABLE[i]
    const prevBracket = RETIREMENT_LUMP_SUM_TAX_TABLE[i - 1]

    if (lumpSum <= bracket.threshold) {
      return (
        bracket.previousTax + (lumpSum - prevBracket.threshold) * bracket.rate
      )
    }
  }

  // Handle amounts above highest threshold
  const lastBracket =
    RETIREMENT_LUMP_SUM_TAX_TABLE[RETIREMENT_LUMP_SUM_TAX_TABLE.length - 1]
  const secondLastBracket =
    RETIREMENT_LUMP_SUM_TAX_TABLE[RETIREMENT_LUMP_SUM_TAX_TABLE.length - 2]

  return (
    lastBracket.previousTax +
    (lumpSum - secondLastBracket.threshold) * lastBracket.rate
  )
}
