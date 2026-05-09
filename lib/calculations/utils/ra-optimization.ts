import { calculateIncomeTax } from '@/lib/constants/tax-tables'
import { SA_TAX_LIMITS } from '@/lib/constants/limits'
import type { Account, AccountType } from '@/types'

const RA_TYPES: AccountType[] = ['pension_fund', 'retirement_annuity', 'preservation_fund']

export interface RAOptimizationResult {
  annualDeductionLimit: number        // min(income × 27.5%, R430k)
  currentAnnualContributions: number  // sum of RA/pension/preservation monthly × 12
  remainingRoom: number               // how much more can be deducted tax-free
  utilizationPct: number             // currentAnnualContributions / annualDeductionLimit × 100
  annualTaxSaving: number            // tax saved if full remaining room is used
  optimalMonthlyContribution: number  // annualDeductionLimit / 12
  currentMonthlyContributions: number
  isFullyUtilized: boolean
  isOverLimit: boolean               // contributions exceed deduction limit (excess not deductible)
}

/**
 * Calculate how much RA/pension deduction room the user has and the tax saving from using it.
 *
 * The deduction is applied before income tax — contributions reduce taxable income.
 * Limit: 27.5% of the greater of remuneration or taxable income, capped at R430k.
 *
 * Note: pre-retirement income tax uses only the primary rebate (working-age individuals).
 * This does not account for medical aid credits or secondary/tertiary rebates.
 */
export function calculateRAOptimization(
  annualIncome: number,
  accounts: Account[]
): RAOptimizationResult {
  const annualDeductionLimit = Math.min(
    annualIncome * SA_TAX_LIMITS.pensionRaDeductionRate,
    SA_TAX_LIMITS.pensionRaMaxDeduction
  )

  const currentMonthlyContributions = accounts
    .filter(a => RA_TYPES.includes(a.type))
    .reduce((sum, a) => sum + a.monthlyContribution, 0)

  const currentAnnualContributions = currentMonthlyContributions * 12

  const remainingRoom = Math.max(0, annualDeductionLimit - currentAnnualContributions)
  const utilizationPct =
    annualDeductionLimit > 0
      ? Math.min(100, (currentAnnualContributions / annualDeductionLimit) * 100)
      : 0

  // Tax saving = income tax on current taxable income minus tax after maxing the deduction
  // Both use primary rebate only (pre-retirement, working-age)
  const primaryRebate = SA_TAX_LIMITS.primaryRebate
  const currentDeduction = Math.min(currentAnnualContributions, annualDeductionLimit)
  const currentTaxableIncome = Math.max(0, annualIncome - currentDeduction)
  const optimizedTaxableIncome = Math.max(0, annualIncome - annualDeductionLimit)

  const currentTax = Math.max(0, calculateIncomeTax(currentTaxableIncome) - primaryRebate)
  const optimizedTax = Math.max(0, calculateIncomeTax(optimizedTaxableIncome) - primaryRebate)
  const annualTaxSaving = Math.max(0, currentTax - optimizedTax)

  return {
    annualDeductionLimit,
    currentAnnualContributions,
    remainingRoom,
    utilizationPct,
    annualTaxSaving,
    optimalMonthlyContribution: annualDeductionLimit / 12,
    currentMonthlyContributions,
    isFullyUtilized: remainingRoom <= 0,
    isOverLimit: currentAnnualContributions > annualDeductionLimit,
  }
}
