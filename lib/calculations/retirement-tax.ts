import { calculateIncomeTax, calculateLumpSumTax } from '../constants/tax-tables'
import { SA_TAX_LIMITS } from '../constants/limits'
import { MEDICAL_AID_CREDITS_CONFIG } from '../constants/tax-year.config'

/**
 * Configuration for retirement tax calculations
 */
export interface RetirementTaxConfig {
  age: number // Current age for determining applicable rebates
  lumpSumPercentage?: number // Percentage of portfolio to take as lump sum (0-100)
  monthlyMedicalAid?: number // Monthly medical aid contribution paid from income
  medicalAidDependants?: number // Additional beneficiaries (0 = member only)
  preRetirementIncome?: number // Annual pre-retirement income for replacement ratio
}

/**
 * Calculate the annual s6A medical aid tax credit.
 * Credits reduce tax payable directly (not a deduction from income).
 * @param dependants Number of additional beneficiaries (0 = member only)
 */
export function calculateMedicalAidTaxCredit(dependants: number = 0): number {
  const { primaryMemberMonthly, firstDependantMonthly, additionalDependantMonthly } =
    MEDICAL_AID_CREDITS_CONFIG
  let monthlyCredit = primaryMemberMonthly
  if (dependants >= 1) monthlyCredit += firstDependantMonthly
  if (dependants >= 2) monthlyCredit += additionalDependantMonthly * (dependants - 1)
  return monthlyCredit * 12
}

/**
 * Result of retirement tax calculation
 */
export interface RetirementTaxResult {
  grossIncome: number // Annual withdrawal before tax
  incomeTax: number // Annual income tax (after rebates and medical aid credit)
  lumpSumTax: number // One-time lump sum tax
  medicalAidContribution: number // Annual medical aid contribution (cost paid from income)
  medicalAidTaxCredit: number // Annual s6A tax credit applied against income tax
  netIncome: number // After all taxes and deductions
  effectiveTaxRate: number // Effective tax rate (%)
  applicableRebate: number // Tax rebate applied based on age
}

/**
 * Calculate income tax with age-based rebates and optional medical aid tax credit applied.
 * @param annualIncome Gross annual income
 * @param age Current age
 * @param medicalAidDependants Additional beneficiaries; omit or undefined to skip credit
 * @returns Net tax after rebates and credit
 */
export function calculateIncomeTaxWithRebates(
  annualIncome: number,
  age: number,
  medicalAidDependants?: number
): number {
  if (annualIncome <= 0) return 0

  const grossTax = calculateIncomeTax(annualIncome)

  let rebate = SA_TAX_LIMITS.primaryRebate
  if (age >= 75) {
    rebate =
      SA_TAX_LIMITS.primaryRebate +
      SA_TAX_LIMITS.secondaryRebate +
      SA_TAX_LIMITS.tertiaryRebate
  } else if (age >= 65) {
    rebate = SA_TAX_LIMITS.primaryRebate + SA_TAX_LIMITS.secondaryRebate
  }

  const medicalCredit =
    medicalAidDependants !== undefined
      ? calculateMedicalAidTaxCredit(medicalAidDependants)
      : 0

  return Math.max(0, grossTax - rebate - medicalCredit)
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
  // Gross tax before any credits
  const grossTax = grossWithdrawal > 0 ? calculateIncomeTax(grossWithdrawal) : 0

  // Age-based rebate
  let applicableRebate = SA_TAX_LIMITS.primaryRebate
  if (config.age >= 75) {
    applicableRebate =
      SA_TAX_LIMITS.primaryRebate +
      SA_TAX_LIMITS.secondaryRebate +
      SA_TAX_LIMITS.tertiaryRebate
  } else if (config.age >= 65) {
    applicableRebate = SA_TAX_LIMITS.primaryRebate + SA_TAX_LIMITS.secondaryRebate
  }

  // s6A medical aid tax credit (reduces tax payable, not taxable income)
  const medicalAidTaxCredit = config.monthlyMedicalAid
    ? calculateMedicalAidTaxCredit(config.medicalAidDependants ?? 0)
    : 0

  // Net income tax after rebate and medical aid credit (cannot go negative)
  const incomeTax = Math.max(0, grossTax - applicableRebate - medicalAidTaxCredit)

  // Annual medical aid contribution paid from retirement income (a cost, not a tax deduction)
  const medicalAidContribution = (config.monthlyMedicalAid || 0) * 12

  // Lump sum tax (typically only applicable at retirement)
  const lumpSumTax = 0 // Will be calculated separately for retirement year

  // Net income after all taxes and costs
  const netIncome = grossWithdrawal - incomeTax - lumpSumTax - medicalAidContribution

  const effectiveTaxRate = grossWithdrawal > 0 ? (incomeTax / grossWithdrawal) * 100 : 0

  return {
    grossIncome: grossWithdrawal,
    incomeTax,
    lumpSumTax,
    medicalAidContribution,
    medicalAidTaxCredit,
    netIncome,
    effectiveTaxRate,
    applicableRebate,
  }
}

/**
 * Calculate how much of this year's pension/RA/preservation contributions are disallowed
 * (i.e. exceed the Section 11F deduction limit) and should accumulate as a carry-forward credit.
 *
 * The credit reduces the taxable lump sum at retirement and, if any remains, offsets
 * pension annuity income during drawdown.
 */
export function calculateExcessContributionCredit(
  annualPensionContributions: number,
  annualIncome: number,
): number {
  const limit = Math.min(
    annualIncome * SA_TAX_LIMITS.pensionRaDeductionRate,
    SA_TAX_LIMITS.pensionRaMaxDeduction,
  )
  return Math.max(0, annualPensionContributions - limit)
}

/**
 * Calculate lump sum commutation tax at retirement.
 * If accumulatedExcessCredit is provided, it reduces the taxable lump sum before tax
 * is calculated — the credit offsets previously-disallowed contributions that were
 * already taxed as income. Any unused credit carries into the drawdown phase.
 *
 * Note: the credit is applied against the full gross lump sum regardless of account mix
 * (a simplification — legally it applies only to pension/RA/preservation lump sums).
 */
export function calculateLumpSumCommutation(
  portfolioValue: number,
  lumpSumPercentage: number,
  accumulatedExcessCredit: number = 0,
): {
  lumpSumAmount: number
  taxableLumpSum: number
  lumpSumTax: number
  netLumpSum: number
  remainingPortfolio: number
  accumulatedExcessCredit: number
  creditAppliedToLumpSum: number
  creditCarriedIntoDrawdown: number
} {
  const percentage = Math.max(0, Math.min(100, lumpSumPercentage))
  const lumpSumAmount = portfolioValue * (percentage / 100)

  const creditAppliedToLumpSum = Math.min(accumulatedExcessCredit, lumpSumAmount)
  const taxableLumpSum = lumpSumAmount - creditAppliedToLumpSum
  const lumpSumTax = calculateLumpSumTax(taxableLumpSum)
  const netLumpSum = lumpSumAmount - lumpSumTax
  const remainingPortfolio = portfolioValue - lumpSumAmount

  return {
    lumpSumAmount,
    taxableLumpSum,
    lumpSumTax,
    netLumpSum,
    remainingPortfolio,
    accumulatedExcessCredit,
    creditAppliedToLumpSum,
    creditCarriedIntoDrawdown: accumulatedExcessCredit - creditAppliedToLumpSum,
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
