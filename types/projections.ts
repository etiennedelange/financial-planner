export interface YearlyProjection {
  year: number
  age: number
  startingBalance: number
  contributions: number
  growth: number
  fees: number
  withdrawals: number
  endingBalance: number
  inflationAdjustedWithdrawal: number
}

export interface ProjectionResult {
  yearlyProjections: YearlyProjection[]
  portfolioAtRetirement: number
  monthlyIncomeAtRetirement: number
  portfolioDepletionAge: number | null // null if never depletes
  shortfallAmount: number
  surplusAmount: number
}
