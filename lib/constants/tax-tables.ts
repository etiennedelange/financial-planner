import {
  INCOME_TAX_BRACKETS_CONFIG,
  RETIREMENT_LUMP_SUM_CONFIG,
} from './tax-year.config'

export const INCOME_TAX_BRACKETS = INCOME_TAX_BRACKETS_CONFIG
export const RETIREMENT_LUMP_SUM_TAX_TABLE = RETIREMENT_LUMP_SUM_CONFIG

/**
 * Calculate income tax based on taxable income
 */
export function calculateIncomeTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0

  for (const bracket of INCOME_TAX_BRACKETS) {
    if (taxableIncome <= bracket.max) {
      return bracket.baseTax + (taxableIncome - bracket.min) * bracket.rate
    }
  }

  const lastBracket = INCOME_TAX_BRACKETS[INCOME_TAX_BRACKETS.length - 1]
  return (
    lastBracket.baseTax + (taxableIncome - lastBracket.min) * lastBracket.rate
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

  const lastBracket =
    RETIREMENT_LUMP_SUM_TAX_TABLE[RETIREMENT_LUMP_SUM_TAX_TABLE.length - 1]
  const secondLastBracket =
    RETIREMENT_LUMP_SUM_TAX_TABLE[RETIREMENT_LUMP_SUM_TAX_TABLE.length - 2]

  return (
    lastBracket.previousTax +
    (lumpSum - secondLastBracket.threshold) * lastBracket.rate
  )
}
