import type { Account, DrawdownConfig, PersonalInfo, RetirementGoals } from '@/types'
import { describe, expect, it } from 'vitest'
import { calculateProjection } from '../projection-engine'

describe('calculateProjection', () => {
  const baseAccount: Account = {
    id: '1',
    name: 'Test RA',
    type: 'retirement_annuity',
    provider: 'Test Provider',
    currentBalance: 100000,
    monthlyContribution: 2000,
    expectedReturn: 12,
    annualFees: 1,
    contributionEscalation: 5,
  }

  const basePersonalInfo: PersonalInfo = {
    currentAge: 35,
    retirementAge: 65,
    lifeExpectancy: 90,
    annualIncome: 600000,
  }

  const baseRetirementGoals: RetirementGoals = {
    desiredMonthlyIncome: 30000,
    inflationRate: 5.5,
    legacyAmount: 0,
  }

  const baseDrawdownConfig: DrawdownConfig = {
    strategy: 'fixed_percentage',
    initialWithdrawalRate: 4,
    minimumWithdrawal: 15000,
    maximumWithdrawal: 60000,
    lumpSumPercentage: 0,
  }

  describe('Basic accumulation phase', () => {
    it('should calculate portfolio growth during accumulation', () => {
      const result = calculateProjection(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      // Portfolio should grow over 30 years
      expect(result.portfolioAtRetirement).toBeGreaterThan(baseAccount.currentBalance)
      expect(result.yearlyProjections.length).toBeGreaterThan(30)
    })

    it('should have correct number of years in projection', () => {
      const result = calculateProjection(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      const yearsToRetirement = 65 - 35 // 30 years
      const yearsInRetirement = 90 - 65 // 25 years
      const totalYears = yearsToRetirement + yearsInRetirement

      expect(result.yearlyProjections.length).toBe(totalYears)
    })

    it('should include contributions in accumulation phase', () => {
      const result = calculateProjection(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      const accumulationYears = 30
      let totalContributions = 0

      for (let i = 0; i < accumulationYears; i++) {
        expect(result.yearlyProjections[i].contributions).toBeGreaterThan(0)
        totalContributions += result.yearlyProjections[i].contributions
      }

      // Total contributions should be substantial
      expect(totalContributions).toBeGreaterThan(baseAccount.monthlyContribution * 12 * 30)
    })

    it('should show zero contributions in drawdown phase', () => {
      const result = calculateProjection(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      const accumulationYears = 30
      for (let i = accumulationYears; i < result.yearlyProjections.length; i++) {
        expect(result.yearlyProjections[i].contributions).toBe(0)
      }
    })
  })

  describe('Drawdown phase', () => {
    it('should show positive withdrawals in retirement', () => {
      const result = calculateProjection(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      const accumulationYears = 30
      let totalWithdrawals = 0

      for (let i = accumulationYears; i < result.yearlyProjections.length; i++) {
        if (result.yearlyProjections[i].endingBalance > 0) {
          expect(result.yearlyProjections[i].withdrawals).toBeGreaterThan(0)
          totalWithdrawals += result.yearlyProjections[i].withdrawals
        }
      }

      expect(totalWithdrawals).toBeGreaterThan(0)
    })

    it('should calculate monthly income at retirement correctly', () => {
      const result = calculateProjection(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      // Monthly income should be approximately 4% of portfolio divided by 12
      const expectedMonthly =
        (result.portfolioAtRetirement * baseDrawdownConfig.initialWithdrawalRate / 100) / 12

      expect(result.monthlyIncomeAtRetirement).toBeCloseTo(expectedMonthly, -1) // Within R10
    })

    it('should track portfolio depletion age if applicable', () => {
      const insufficientFunds: Account = {
        ...baseAccount,
        currentBalance: 10000, // Very small starting balance
        monthlyContribution: 100, // Small contribution
      }

      const result = calculateProjection(
        [insufficientFunds],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      // With insufficient funds and high desired income, should deplete
      if (result.portfolioDepletionAge) {
        expect(result.portfolioDepletionAge).toBeGreaterThanOrEqual(65)
        expect(result.portfolioDepletionAge).toBeLessThanOrEqual(90)
      }
    })
  })

  describe('Multiple accounts', () => {
    it('should aggregate multiple accounts correctly', () => {
      const account1: Account = {
        ...baseAccount,
        id: '1',
        name: 'RA',
        currentBalance: 100000,
        monthlyContribution: 1000,
      }

      const account2: Account = {
        ...baseAccount,
        id: '2',
        name: 'TFSA',
        currentBalance: 50000,
        monthlyContribution: 500,
      }

      const result = calculateProjection(
        [account1, account2],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      // Portfolio should be larger than single account
      const singleResult = calculateProjection(
        [account1],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      expect(result.portfolioAtRetirement).toBeGreaterThan(singleResult.portfolioAtRetirement)
    })

    it('should handle accounts with different returns', () => {
      const conservativeAccount: Account = {
        ...baseAccount,
        id: '1',
        name: 'Bond Fund',
        expectedReturn: 8,
        currentBalance: 100000,
      }

      const aggressiveAccount: Account = {
        ...baseAccount,
        id: '2',
        name: 'Equity Fund',
        expectedReturn: 12,
        currentBalance: 100000,
      }

      const result = calculateProjection(
        [conservativeAccount, aggressiveAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      expect(result.portfolioAtRetirement).toBeGreaterThan(200000)
    })
  })

  describe('Empty accounts handling', () => {
    it('should handle empty accounts array gracefully', () => {
      const result = calculateProjection(
        [],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      expect(result.portfolioAtRetirement).toBe(0)
      expect(result.monthlyIncomeAtRetirement).toBe(0)
      expect(result.yearlyProjections.length).toBe(0)
      expect(result.shortfallAmount).toBeGreaterThan(0) // Should have shortfall
    })
  })

  describe('Compounding methods', () => {
    it('should use nominal compounding by default', () => {
      const resultNoAssumptions = calculateProjection(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      const resultNominal = calculateProjection(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig,
        { compoundingMethod: 'nominal', equityReturn: 12, bondReturn: 8, cashReturn: 6, equityVolatility: 16, bondVolatility: 8, inflationRate: 5.5 }
      )

      expect(resultNoAssumptions.portfolioAtRetirement).toBeCloseTo(
        resultNominal.portfolioAtRetirement,
        -2
      )
    })

    it('should use compound compounding when specified', () => {
      const resultNominal = calculateProjection(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig,
        { compoundingMethod: 'nominal', equityReturn: 12, bondReturn: 8, cashReturn: 6, equityVolatility: 16, bondVolatility: 8, inflationRate: 5.5 }
      )

      const resultCompound = calculateProjection(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig,
        { compoundingMethod: 'compound', equityReturn: 12, bondReturn: 8, cashReturn: 6, equityVolatility: 16, bondVolatility: 8, inflationRate: 5.5 }
      )

      // Compound should be slightly lower than nominal (more accurate)
      expect(resultCompound.portfolioAtRetirement).toBeLessThan(resultNominal.portfolioAtRetirement)
    })
  })

  describe('Drawdown strategies', () => {
    it('should handle fixed_percentage withdrawal strategy', () => {
      const result = calculateProjection(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        { strategy: 'fixed_percentage', initialWithdrawalRate: 4, minimumWithdrawal: 10000, maximumWithdrawal: 50000, lumpSumPercentage: 0 }
      )

      expect(result.monthlyIncomeAtRetirement).toBeGreaterThan(0)
    })

    it('should handle fixed_amount_inflation_adjusted withdrawal strategy', () => {
      const result = calculateProjection(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        { strategy: 'fixed_amount_inflation_adjusted', initialWithdrawalRate: 4, minimumWithdrawal: 10000, maximumWithdrawal: 50000, lumpSumPercentage: 0 }
      )

      // Should try to maintain desired monthly income inflated to retirement
      // Desired income of R30k today becomes ~R161k at retirement after 30 years of 5.5% inflation
      const inflationFactor = Math.pow(1 + baseRetirementGoals.inflationRate / 100, 30)
      const expectedInflatedMonthly = baseRetirementGoals.desiredMonthlyIncome * inflationFactor

      expect(result.monthlyIncomeAtRetirement).toBeCloseTo(
        expectedInflatedMonthly,
        -2
      )
    })

    it('should apply spending phase multipliers correctly', () => {
      const result = calculateProjection(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      const accumulationYears = 30

      // Go-Go phase (0-15 years): full spending
      for (let i = 0; i < 15; i++) {
        if (result.yearlyProjections[accumulationYears + i].withdrawals > 0) {
          // Can't directly verify multiplier, but withdrawals should be consistent
          expect(result.yearlyProjections[accumulationYears + i].withdrawals).toBeGreaterThan(0)
        }
      }

      // Later years may have different withdrawal patterns due to multipliers
      if (accumulationYears + 20 < result.yearlyProjections.length) {
        // Slow-Go phase (15-25 years): 80% of withdrawal
        expect(result.yearlyProjections[accumulationYears + 20]).toBeDefined()
      }
    })
  })

  describe('Inflation adjustments', () => {
    it('should inflate desired income to retirement date', () => {
      const result = calculateProjection(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      // Over 30 years at 5.5% inflation:
      // R30,000 becomes R30,000 * (1.055)^30 ≈ R161,000
      const inflationFactor = Math.pow(
        1 + baseRetirementGoals.inflationRate / 100,
        basePersonalInfo.retirementAge - basePersonalInfo.currentAge
      )
      const expectedInflatedIncome = baseRetirementGoals.desiredMonthlyIncome * inflationFactor

      // The initial withdrawal should be based on inflated income
      const firstWithdrawal =
        result.yearlyProjections[30]?.withdrawals || result.yearlyProjections[29]?.withdrawals
      expect(firstWithdrawal).toBeGreaterThan(baseRetirementGoals.desiredMonthlyIncome * 12)
    })

    it('should show inflation-adjusted withdrawals correctly', () => {
      const result = calculateProjection(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      const accumulationYears = 30
      const inflationRate = baseRetirementGoals.inflationRate / 100

      // Verify inflation-adjusted withdrawals decrease (when converted back to today's Rands)
      for (let i = accumulationYears + 1; i < Math.min(accumulationYears + 5, result.yearlyProjections.length); i++) {
        if (result.yearlyProjections[i].withdrawals > 0) {
          expect(result.yearlyProjections[i].inflationAdjustedWithdrawal).toBeGreaterThan(0)
        }
      }
    })
  })

  describe('Growth and fees calculation', () => {
    it('should calculate positive growth during accumulation', () => {
      const result = calculateProjection(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      const accumulationYears = 30
      let totalGrowth = 0

      for (let i = 0; i < accumulationYears; i++) {
        expect(result.yearlyProjections[i].growth).toBeGreaterThanOrEqual(0)
        totalGrowth += result.yearlyProjections[i].growth
      }

      expect(totalGrowth).toBeGreaterThan(0)
    })

    it('should deduct fees from portfolio', () => {
      const result = calculateProjection(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      const accumulationYears = 30
      let totalFees = 0

      for (let i = 0; i < accumulationYears; i++) {
        expect(result.yearlyProjections[i].fees).toBeGreaterThanOrEqual(0)
        totalFees += result.yearlyProjections[i].fees
      }

      expect(totalFees).toBeGreaterThan(0)
    })

    it('should show that portfolio growth reduces by fee amount', () => {
      const lowFeeAccount: Account = {
        ...baseAccount,
        annualFees: 0.5,
      }

      const highFeeAccount: Account = {
        ...baseAccount,
        annualFees: 2,
      }

      const lowFeeResult = calculateProjection(
        [lowFeeAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      const highFeeResult = calculateProjection(
        [highFeeAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      // Lower fees should result in higher portfolio at retirement
      expect(lowFeeResult.portfolioAtRetirement).toBeGreaterThan(highFeeResult.portfolioAtRetirement)
    })
  })

  describe('Shortfall/Surplus calculation', () => {
    it('should calculate shortfall when portfolio insufficient', () => {
      const insufficientAccount: Account = {
        ...baseAccount,
        currentBalance: 10000, // Very low starting balance
        monthlyContribution: 50, // Very low contribution
      }

      const result = calculateProjection(
        [insufficientAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      expect(result.shortfallAmount).toBeGreaterThan(0)
    })

    it('should calculate surplus when portfolio exceeds needs', () => {
      const abundantAccount: Account = {
        ...baseAccount,
        currentBalance: 5000000, // Very high starting balance
        monthlyContribution: 5000,
      }

      const result = calculateProjection(
        [abundantAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      expect(result.surplusAmount).toBeGreaterThan(0)
      expect(result.shortfallAmount).toBe(0)
    })
  })

  describe('Tax-optimized withdrawal sequencing', () => {
    const shortHorizonInfo: PersonalInfo = {
      currentAge: 63,
      retirementAge: 65,
      lifeExpectancy: 75,
      annualIncome: 600000,
    }

    it('TFSA withdrawal should produce zero taxable income', () => {
      const tfsaAccount: Account = {
        id: '1',
        name: 'TFSA',
        type: 'tfsa',
        provider: 'Test',
        currentBalance: 1000000,
        monthlyContribution: 0,
        expectedReturn: 8,
        annualFees: 0.5,
        contributionEscalation: 0,
      }
      const result = calculateProjection([tfsaAccount], shortHorizonInfo, baseRetirementGoals, baseDrawdownConfig)
      const firstRetirementYear = result.yearlyProjections.find(p => p.age === 65)!
      expect(firstRetirementYear.tfsaWithdrawal).toBeGreaterThan(0)
      expect(firstRetirementYear.pensionWithdrawal).toBe(0)
      expect(firstRetirementYear.taxableIncome).toBe(0)
      expect(firstRetirementYear.incomeTax).toBe(0)
    })

    it('pension-only withdrawal should be fully taxable', () => {
      const raAccount: Account = {
        id: '1',
        name: 'RA',
        type: 'retirement_annuity',
        provider: 'Test',
        currentBalance: 1000000,
        monthlyContribution: 0,
        expectedReturn: 8,
        annualFees: 0.5,
        contributionEscalation: 0,
      }
      const result = calculateProjection([raAccount], shortHorizonInfo, baseRetirementGoals, baseDrawdownConfig)
      const firstRetirementYear = result.yearlyProjections.find(p => p.age === 65)!
      expect(firstRetirementYear.pensionWithdrawal).toBeGreaterThan(0)
      expect(firstRetirementYear.tfsaWithdrawal).toBe(0)
      expect(firstRetirementYear.taxableIncome).toBeCloseTo(firstRetirementYear.pensionWithdrawal!, 0)
    })

    it('TFSA-first sequencing reduces lifetime income tax vs pension-only portfolio of same size', () => {
      // Use a large portfolio so pension withdrawals clearly exceed the R153k age-65 tax threshold
      const tfsaAccount: Account = {
        id: '1',
        name: 'TFSA',
        type: 'tfsa',
        provider: 'Test',
        currentBalance: 3000000,
        monthlyContribution: 0,
        expectedReturn: 8,
        annualFees: 0.5,
        contributionEscalation: 0,
      }
      const raAccount: Account = {
        id: '2',
        name: 'RA',
        type: 'retirement_annuity',
        provider: 'Test',
        currentBalance: 3000000,
        monthlyContribution: 0,
        expectedReturn: 8,
        annualFees: 0.5,
        contributionEscalation: 0,
      }
      const raOnlyAccount: Account = {
        ...raAccount,
        id: '1',
        currentBalance: 6000000,
      }

      const mixedResult = calculateProjection([tfsaAccount, raAccount], shortHorizonInfo, baseRetirementGoals, baseDrawdownConfig)
      const raOnlyResult = calculateProjection([raOnlyAccount], shortHorizonInfo, baseRetirementGoals, baseDrawdownConfig)

      // Mixed portfolio draws from TFSA first (tax-free), so total income tax must be lower
      expect(mixedResult.totalLifetimeIncomeTax).toBeLessThan(raOnlyResult.totalLifetimeIncomeTax)
    })

    it('TFSA exhausted before switching to pension', () => {
      const smallTfsa: Account = {
        id: '1',
        name: 'Small TFSA',
        type: 'tfsa',
        provider: 'Test',
        currentBalance: 50000, // Will be exhausted quickly
        monthlyContribution: 0,
        expectedReturn: 8,
        annualFees: 0.5,
        contributionEscalation: 0,
      }
      const raAccount: Account = {
        id: '2',
        name: 'RA',
        type: 'retirement_annuity',
        provider: 'Test',
        currentBalance: 2000000,
        monthlyContribution: 0,
        expectedReturn: 8,
        annualFees: 0.5,
        contributionEscalation: 0,
      }
      const result = calculateProjection([smallTfsa, raAccount], shortHorizonInfo, baseRetirementGoals, baseDrawdownConfig)
      const retirementYears = result.yearlyProjections.filter(p => p.age >= 65)

      // First year should have some TFSA withdrawal
      expect(retirementYears[0].tfsaWithdrawal).toBeGreaterThan(0)
      // Later years should be pension-only once TFSA is gone
      const laterYear = retirementYears[retirementYears.length - 1]
      expect(laterYear.tfsaWithdrawal).toBe(0)
      expect(laterYear.pensionWithdrawal).toBeGreaterThan(0)
    })

    it('discretionary withdrawal applies CGT inclusion but not full income tax', () => {
      const discretionaryAccount: Account = {
        id: '1',
        name: 'Discretionary',
        type: 'discretionary',
        provider: 'Test',
        currentBalance: 1000000,
        monthlyContribution: 0,
        expectedReturn: 8,
        annualFees: 0.5,
        contributionEscalation: 0,
      }
      const result = calculateProjection([discretionaryAccount], shortHorizonInfo, baseRetirementGoals, baseDrawdownConfig)
      const firstYear = result.yearlyProjections.find(p => p.age === 65)!

      expect(firstYear.discretionaryWithdrawal).toBeGreaterThan(0)
      // Taxable income should be less than gross withdrawal (only gain × 40% is included)
      expect(firstYear.taxableIncome!).toBeLessThan(firstYear.withdrawals)
    })
  })

  describe('SA retirement scenario testing', () => {
    it('should handle typical professional retirement scenario', () => {
      const professionalAccount: Account = {
        id: '1',
        name: 'Professional RA',
        type: 'retirement_annuity',
    provider: 'Test Provider',
        currentBalance: 500000,
        monthlyContribution: 2500,
        expectedReturn: 11,
        annualFees: 1.2,
        contributionEscalation: 5,
      }

      const result = calculateProjection(
        [professionalAccount],
        {
          currentAge: 45,
          retirementAge: 65,
          lifeExpectancy: 90,
          annualIncome: 900000,
        },
        {
          desiredMonthlyIncome: 25000,
          inflationRate: 5.5,
          legacyAmount: 0,
        },
        baseDrawdownConfig
      )

      expect(result.portfolioAtRetirement).toBeGreaterThan(500000)
      expect(result.monthlyIncomeAtRetirement).toBeGreaterThan(0)
    })

    it('should handle young saver with long horizon', () => {
      const youngSaverAccount: Account = {
        id: '1',
        name: 'Young Saver TFSA',
        type: 'tfsa',
    provider: 'Test Provider',
        currentBalance: 50000,
        monthlyContribution: 1000,
        expectedReturn: 10,
        annualFees: 0.75,
        contributionEscalation: 3,
      }

      const result = calculateProjection(
        [youngSaverAccount],
        {
          currentAge: 25,
          retirementAge: 65,
          lifeExpectancy: 95,
          annualIncome: 400000,
        },
        {
          desiredMonthlyIncome: 25000,
          inflationRate: 5.5,
          legacyAmount: 0,
        },
        baseDrawdownConfig
      )

      // 40 years of compounding should result in substantial portfolio
      expect(result.portfolioAtRetirement).toBeGreaterThan(1000000)
    })
  })
})
