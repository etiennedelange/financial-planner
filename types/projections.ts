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
  accountSources?: AccountSourceBreakdown[] // Optional: which accounts contributed to withdrawal
}

export interface LumpSumCommutationResult {
  lumpSumPercentage: number
  lumpSumAmount: number // Gross amount taken as lump sum
  lumpSumTax: number // Tax payable on lump sum
  netLumpSum: number // Net amount received after tax
  remainingPortfolio: number // Portfolio available for ongoing drawdown
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
}
