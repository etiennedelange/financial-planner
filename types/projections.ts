export interface AccountSourceBreakdown {
  accountId: string
  accountName: string
  withdrawalAmount: number
  percentageOfTotal: number
}

export interface YearlyProjection {
  year: number
  age: number
  startingBalance: number
  contributions: number
  growth: number
  fees: number
  withdrawals: number // Gross withdrawal before tax
  incomeTax: number // Annual income tax on withdrawals
  lumpSumTax: number // One-time lump sum commutation tax (only at retirement)
  medicalAidContribution: number // Annual medical aid contributions
  netIncome: number // After-tax income (withdrawals - incomeTax - lumpSumTax - medicalAid)
  endingBalance: number
  inflationAdjustedWithdrawal: number
  // Tax-optimized withdrawal sequencing breakdown (drawdown years only)
  tfsaWithdrawal?: number // Portion drawn from TFSA (tax-free)
  discretionaryWithdrawal?: number // Portion drawn from discretionary (CGT only)
  pensionWithdrawal?: number // Portion drawn from pension/RA/preservation (full income tax)
  cgtTaxableAmount?: number // CGT inclusion amount (discretionary gains × 40%)
  taxableIncome?: number // Total taxable income (pensionWithdrawal + cgtTaxableAmount)
  accountSources?: AccountSourceBreakdown[] // Optional: which accounts contributed to withdrawal
  // Per-account balance snapshot at year-end (drawdown years only), keyed by account id
  accountBalances?: Record<string, number>
  // Section 11F excess contribution credit applied this drawdown year
  excessCreditApplied?: number
  excessCreditRemaining?: number
  // TFSA excess contribution penalty (40% tax on contributions over annual R46k limit)
  tfsaExcessContributionPenalty?: number
}

export interface LumpSumCommutationResult {
  lumpSumPercentage: number
  lumpSumAmount: number // Gross amount taken as lump sum
  taxableLumpSum: number // Gross lump sum after excess credit reduction (what tax is calculated on)
  lumpSumTax: number // Tax payable on lump sum
  netLumpSum: number // Net amount received after tax
  remainingPortfolio: number // Portfolio available for ongoing drawdown
  accumulatedExcessCredit: number // Total Section 11F credit built up during accumulation
  creditAppliedToLumpSum: number // Portion of credit used to reduce taxable lump sum
  creditCarriedIntoDrawdown: number // Remaining credit carried into annuity phase
}

export interface ProjectionResult {
  yearlyProjections: YearlyProjection[]
  portfolioAtRetirement: number
  monthlyIncomeAtRetirement: number
  monthlyNetIncomeAtRetirement: number // After-tax monthly income
  portfolioDepletionAge: number | null // null if never depletes
  shortfallAmount: number
  surplusAmount: number
  totalLifetimeIncomeTax: number // Total income tax paid over retirement
  totalLumpSumTax: number // One-time lump sum tax at retirement
  totalMedicalAidContributions: number // Total medical aid over retirement
  averageEffectiveTaxRate: number // Average tax rate on withdrawals
  lumpSumCommutation: LumpSumCommutationResult // Lump sum details at retirement
  replacementRatio?: number // Optional: retirement income vs pre-retirement income
  accumulatedExcessCredit: number // Total Section 11F credit built up during accumulation
  // Per-account balance at start of drawdown (after lump sum deduction), keyed by account id
  accountBalancesAtRetirement: Record<string, number>
}
