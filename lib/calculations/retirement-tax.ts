import { calculateIncomeTax, calculateLumpSumTax } from '../constants/tax-tables'
import { SA_TAX_LIMITS } from '../constants/limits'

/**
 * Configuration for retirement tax calculations
 */
export interface RetirementTaxConfig {
  age: number // Current age for determining applicable rebates
  lumpSumPercentage?: number // Percentage of portfolio to take as lump sum (0-100)
  monthlyMedicalAid?: number // Monthly medical aid contribution
  preRetirementIncome?: number // Annual pre-retirement income for replacement ratio
}

/**
 * Result of retirement tax calculation
 */
export interface RetirementTaxResult {
  grossIncome: number // Annual withdrawal before tax
  incomeTax: number // Annual income tax (after rebates)
  lumpSumTax: number // One-time lump sum tax
  medicalAidContribution: number // Annual medical aid contribution
  netIncome: number // After all taxes and deductions
  effectiveTaxRate: number // Effective tax rate (%)
  applicableRebate: number // Tax rebate applied based on age
}

/**
 * Calculate income tax with age-based rebates applied
 * @param annualIncome Gross annual income
 * @param age Current age
 * @returns Net tax after rebates
 */
export function calculateIncomeTaxWithRebates(
  annualIncome: number,
  age: number
): number {
  if (annualIncome <= 0) return 0

  // Calculate gross tax
  const grossTax = calculateIncomeTax(annualIncome)

  // Determine applicable rebate based on age
  let rebate = SA_TAX_LIMITS.primaryRebate

  if (age >= 75) {
    // All three rebates apply
    rebate =
      SA_TAX_LIMITS.primaryRebate +
      SA_TAX_LIMITS.secondaryRebate +
      SA_TAX_LIMITS.tertiaryRebate
  } else if (age >= 65) {
    // Primary and secondary rebates apply
    rebate = SA_TAX_LIMITS.primaryRebate + SA_TAX_LIMITS.secondaryRebate
  }

  // Net tax after rebate (can't go negative)
  const netTax = Math.max(0, grossTax - rebate)

  return netTax
}

/**
 * Check if income is below tax-free threshold for given age
 * @param annualIncome Gross annual income
 * @param age Current age
 * @returns True if income is below tax-free threshold
 */
export function isBelowTaxThreshold(annualIncome: number, age: number): boolean {
  if (age >= 75) {
    return annualIncome <= SA_TAX_LIMITS.taxThreshold75Plus
  } else if (age >= 65) {
    return annualIncome <= SA_TAX_LIMITS.taxThreshold65To74
  } else {
    return annualIncome <= SA_TAX_LIMITS.taxThresholdUnder65
  }
}

/**
 * Calculate retirement income tax for a given year
 * @param grossWithdrawal Annual gross withdrawal amount
 * @param config Tax configuration including age, medical aid, etc.
 * @returns Complete tax calculation result
 */
export function calculateRetirementTax(
  grossWithdrawal: number,
  config: RetirementTaxConfig
): RetirementTaxResult {
  // Calculate income tax with rebates
  const incomeTax = calculateIncomeTaxWithRebates(grossWithdrawal, config.age)

  // Calculate annual medical aid contribution
  const medicalAidContribution = (config.monthlyMedicalAid || 0) * 12

  // Lump sum tax (typically only applicable at retirement)
  const lumpSumTax = 0 // Will be calculated separately for retirement year

  // Net income after all deductions
  const netIncome =
    grossWithdrawal - incomeTax - lumpSumTax - medicalAidContribution

  // Effective tax rate
  const effectiveTaxRate =
    grossWithdrawal > 0 ? (incomeTax / grossWithdrawal) * 100 : 0

  // Get applicable rebate
  let applicableRebate = SA_TAX_LIMITS.primaryRebate
  if (config.age >= 75) {
    applicableRebate =
      SA_TAX_LIMITS.primaryRebate +
      SA_TAX_LIMITS.secondaryRebate +
      SA_TAX_LIMITS.tertiaryRebate
  } else if (config.age >= 65) {
    applicableRebate =
      SA_TAX_LIMITS.primaryRebate + SA_TAX_LIMITS.secondaryRebate
  }

  return {
    grossIncome: grossWithdrawal,
    incomeTax,
    lumpSumTax,
    medicalAidContribution,
    netIncome,
    effectiveTaxRate,
    applicableRebate,
  }
}

/**
 * Calculate lump sum commutation tax at retirement
 * @param portfolioValue Total portfolio value at retirement
 * @param lumpSumPercentage Percentage to take as lump sum (0-100)
 * @returns Lump sum amount, tax payable, and net amount
 */
export function calculateLumpSumCommutation(
  portfolioValue: number,
  lumpSumPercentage: number
): {
  lumpSumAmount: number
  lumpSumTax: number
  netLumpSum: number
  remainingPortfolio: number
} {
  // Validate percentage
  const percentage = Math.max(0, Math.min(100, lumpSumPercentage))

  // Calculate lump sum amount
  const lumpSumAmount = portfolioValue * (percentage / 100)

  // Calculate tax on lump sum
  const lumpSumTax = calculateLumpSumTax(lumpSumAmount)

  // Net lump sum after tax
  const netLumpSum = lumpSumAmount - lumpSumTax

  // Remaining portfolio for ongoing withdrawals
  const remainingPortfolio = portfolioValue - lumpSumAmount

  return {
    lumpSumAmount,
    lumpSumTax,
    netLumpSum,
    remainingPortfolio,
  }
}

/**
 * Calculate replacement ratio (retirement income vs pre-retirement income)
 * @param annualRetirementIncome Annual retirement income (after tax)
 * @param preRetirementIncome Annual pre-retirement income (before tax)
 * @returns Replacement ratio as percentage
 */
export function calculateReplacementRatio(
  annualRetirementIncome: number,
  preRetirementIncome: number
): number {
  if (preRetirementIncome <= 0) return 0

  // For fair comparison, we should compare after-tax amounts
  // But if we only have before-tax pre-retirement income, we estimate
  // Assume average 25% tax rate on pre-retirement income
  const estimatedPreRetirementNetIncome = preRetirementIncome * 0.75

  const replacementRatio =
    (annualRetirementIncome / estimatedPreRetirementNetIncome) * 100

  return replacementRatio
}

/**
 * Calculate total tax burden over retirement period
 * @param yearlyWithdrawals Array of annual withdrawal amounts
 * @param startAge Starting retirement age
 * @param monthlyMedicalAid Monthly medical aid contribution
 * @returns Summary of lifetime tax burden
 */
export function calculateLifetimeTaxBurden(
  yearlyWithdrawals: number[],
  startAge: number,
  monthlyMedicalAid: number = 0
): {
  totalIncomeTax: number
  totalMedicalAid: number
  totalGrossWithdrawals: number
  totalNetIncome: number
  averageEffectiveTaxRate: number
} {
  let totalIncomeTax = 0
  let totalMedicalAid = 0
  let totalGrossWithdrawals = 0

  yearlyWithdrawals.forEach((withdrawal, index) => {
    const age = startAge + index
    const taxResult = calculateRetirementTax(withdrawal, {
      age,
      monthlyMedicalAid,
    })

    totalIncomeTax += taxResult.incomeTax
    totalMedicalAid += taxResult.medicalAidContribution
    totalGrossWithdrawals += withdrawal
  })

  const totalNetIncome = totalGrossWithdrawals - totalIncomeTax - totalMedicalAid

  const averageEffectiveTaxRate =
    totalGrossWithdrawals > 0
      ? (totalIncomeTax / totalGrossWithdrawals) * 100
      : 0

  return {
    totalIncomeTax,
    totalMedicalAid,
    totalGrossWithdrawals,
    totalNetIncome,
    averageEffectiveTaxRate,
  }
}
