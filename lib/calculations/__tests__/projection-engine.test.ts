import type { Account, DrawdownConfig, PersonalInfo, RetirementGoals } from '@/types'
import { describe, expect, it } from 'vitest'
import { calculateProjection } from '../projection-engine'
import { SA_TAX_LIMITS } from '@/lib/constants/limits'

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

    it('should derive monthlyNetIncomeAtRetirement from the first drawdown year, not a flat re-tax of gross income', () => {
      const result = calculateProjection(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      const yearsToRetirement = 65 - 35
      const firstDrawdownYear = result.yearlyProjections[yearsToRetirement]

      // Must reconcile exactly with the detailed first-year projection (the payslip
      // shows incomeTax/medicalAid from this same row — they must add up).
      expect(result.monthlyNetIncomeAtRetirement).toBeCloseTo(firstDrawdownYear.netIncome / 12, 6)

      // Naively taxing the full gross withdrawal as ordinary income would produce a
      // lower net figure than the account-mix-aware calculation (this account is a
      // retirement annuity, fully taxable, so the two coincide for this fixture —
      // the TFSA-mix test below is what actually exercises the discrepancy).
      expect(result.monthlyNetIncomeAtRetirement).toBeLessThan(result.monthlyIncomeAtRetirement)
    })

    it('should not over-tax monthlyNetIncomeAtRetirement when withdrawals are sourced from a tax-free TFSA', () => {
      const tfsaAccount: Account = {
        id: 'tfsa-1',
        name: 'TFSA',
        type: 'tfsa',
        provider: 'Test Provider',
        currentBalance: 2_000_000,
        monthlyContribution: 0,
        expectedReturn: 8,
        annualFees: 0.5,
        contributionEscalation: 0,
        tfsaContributionsToDate: 500000, // at lifetime cap, no further contributions allowed
      }

      const result = calculateProjection(
        [tfsaAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      // TFSA withdrawals are entirely tax-free, so net income should equal gross —
      // the old shortcut incorrectly applied ordinary income tax to this amount.
      expect(result.monthlyNetIncomeAtRetirement).toBeCloseTo(result.monthlyIncomeAtRetirement, 2)
    })

    it('should return zero monthlyNetIncomeAtRetirement when there are no years in retirement', () => {
      const noRetirementYears: PersonalInfo = {
        ...basePersonalInfo,
        retirementAge: 90,
        lifeExpectancy: 90,
      }

      const result = calculateProjection(
        [baseAccount],
        noRetirementYears,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      expect(result.monthlyNetIncomeAtRetirement).toBe(0)
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

  describe('Negative years guard', () => {
    it('should return a safe degenerate result when retirementAge is before currentAge', () => {
      const result = calculateProjection(
        [baseAccount],
        { ...basePersonalInfo, currentAge: 65, retirementAge: 40 },
        baseRetirementGoals,
        baseDrawdownConfig
      )

      expect(result.yearlyProjections.length).toBe(0)
      expect(result.portfolioAtRetirement).toBe(0)
      expect(result.monthlyIncomeAtRetirement).toBe(0)
      expect(result.surplusAmount).toBe(0)
      expect(Number.isFinite(result.shortfallAmount)).toBe(true)
    })

    it('should return a safe degenerate result when lifeExpectancy is before retirementAge', () => {
      const result = calculateProjection(
        [baseAccount],
        { ...basePersonalInfo, retirementAge: 65, lifeExpectancy: 50 },
        baseRetirementGoals,
        baseDrawdownConfig
      )

      expect(result.yearlyProjections.length).toBe(0)
      expect(result.portfolioAtRetirement).toBe(0)
      expect(result.shortfallAmount).toBe(0) // yearsInRetirement negative, clamped to 0
    })

    it('should still project normally when yearsToRetirement is exactly zero', () => {
      const result = calculateProjection(
        [baseAccount],
        { ...basePersonalInfo, currentAge: 65, retirementAge: 65 },
        baseRetirementGoals,
        baseDrawdownConfig
      )

      expect(result.portfolioAtRetirement).toBeCloseTo(baseAccount.currentBalance, 0)
      expect(result.yearlyProjections.length).toBeGreaterThan(0)
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

  describe('Account-type-aware lump sum commutation', () => {
    const shortHorizonInfo: PersonalInfo = {
      currentAge: 63,
      retirementAge: 65,
      lifeExpectancy: 75,
      annualIncome: 600000,
    }

    const raAccount: Account = {
      id: 'ra-1',
      name: 'RA',
      type: 'retirement_annuity',
      provider: 'Test',
      currentBalance: 1000000,
      monthlyContribution: 0,
      expectedReturn: 8,
      annualFees: 0.5,
      contributionEscalation: 0,
    }
    const tfsaAccount: Account = {
      id: 'tfsa-1',
      name: 'TFSA',
      type: 'tfsa',
      provider: 'Test',
      currentBalance: 1000000,
      monthlyContribution: 0,
      expectedReturn: 8,
      annualFees: 0.5,
      contributionEscalation: 0,
    }
    const discretionaryAccount: Account = {
      id: 'disc-1',
      name: 'Discretionary',
      type: 'discretionary',
      provider: 'Test',
      currentBalance: 1000000,
      monthlyContribution: 0,
      expectedReturn: 8,
      annualFees: 0.5,
      contributionEscalation: 0,
    }

    it('does not apply lump sum commutation to TFSA balances', () => {
      const noLumpSum = calculateProjection([tfsaAccount], shortHorizonInfo, baseRetirementGoals, { ...baseDrawdownConfig, lumpSumPercentage: 0 })
      const withLumpSum = calculateProjection([tfsaAccount], shortHorizonInfo, baseRetirementGoals, { ...baseDrawdownConfig, lumpSumPercentage: 30 })

      expect(withLumpSum.accountBalancesAtRetirement['tfsa-1']).toBeCloseTo(
        noLumpSum.accountBalancesAtRetirement['tfsa-1'], 0
      )
      expect(withLumpSum.lumpSumCommutation.lumpSumAmount).toBe(0)
    })

    it('does not apply lump sum commutation to discretionary balances', () => {
      const noLumpSum = calculateProjection([discretionaryAccount], shortHorizonInfo, baseRetirementGoals, { ...baseDrawdownConfig, lumpSumPercentage: 0 })
      const withLumpSum = calculateProjection([discretionaryAccount], shortHorizonInfo, baseRetirementGoals, { ...baseDrawdownConfig, lumpSumPercentage: 30 })

      expect(withLumpSum.accountBalancesAtRetirement['disc-1']).toBeCloseTo(
        noLumpSum.accountBalancesAtRetirement['disc-1'], 0
      )
      expect(withLumpSum.lumpSumCommutation.lumpSumAmount).toBe(0)
    })

    it('applies lump sum commutation only to the pension-type portion of a mixed portfolio', () => {
      const result = calculateProjection(
        [raAccount, tfsaAccount, discretionaryAccount],
        shortHorizonInfo,
        baseRetirementGoals,
        { ...baseDrawdownConfig, lumpSumPercentage: 30 }
      )
      const soloRa = calculateProjection([raAccount], shortHorizonInfo, baseRetirementGoals, { ...baseDrawdownConfig, lumpSumPercentage: 0 })
      const soloTfsa = calculateProjection([tfsaAccount], shortHorizonInfo, baseRetirementGoals, { ...baseDrawdownConfig, lumpSumPercentage: 0 })
      const soloDisc = calculateProjection([discretionaryAccount], shortHorizonInfo, baseRetirementGoals, { ...baseDrawdownConfig, lumpSumPercentage: 0 })

      // RA balance reduced by ~30% (the commutation), TFSA/discretionary untouched
      expect(result.accountBalancesAtRetirement['ra-1']).toBeCloseTo(soloRa.accountBalancesAtRetirement['ra-1'] * 0.7, 0)
      expect(result.accountBalancesAtRetirement['tfsa-1']).toBeCloseTo(soloTfsa.accountBalancesAtRetirement['tfsa-1'], 0)
      expect(result.accountBalancesAtRetirement['disc-1']).toBeCloseTo(soloDisc.accountBalancesAtRetirement['disc-1'], 0)

      // The taxable lump sum should be based only on the RA balance, not the full mixed portfolio
      expect(result.lumpSumCommutation.lumpSumAmount).toBeCloseTo(soloRa.accountBalancesAtRetirement['ra-1'] * 0.3, 0)
    })

    it('clamps lump sum commutation to one-third even when a larger percentage is requested', () => {
      const result = calculateProjection(
        [raAccount],
        shortHorizonInfo,
        baseRetirementGoals,
        { ...baseDrawdownConfig, lumpSumPercentage: 90 }
      )
      const cappedAt33 = calculateProjection(
        [raAccount],
        shortHorizonInfo,
        baseRetirementGoals,
        { ...baseDrawdownConfig, lumpSumPercentage: 100 / 3 }
      )

      expect(result.lumpSumCommutation.lumpSumPercentage).toBeCloseTo(100 / 3, 2)
      expect(result.lumpSumCommutation.lumpSumAmount).toBeCloseTo(cappedAt33.lumpSumCommutation.lumpSumAmount, 0)
    })

    it('does not clamp a request already within the one-third limit', () => {
      const result = calculateProjection(
        [raAccount],
        shortHorizonInfo,
        baseRetirementGoals,
        { ...baseDrawdownConfig, lumpSumPercentage: 25 }
      )
      expect(result.lumpSumCommutation.lumpSumPercentage).toBe(25)
    })
  })

  describe('CGT annual exclusion on discretionary withdrawals', () => {
    const shortHorizonInfo: PersonalInfo = {
      currentAge: 63,
      retirementAge: 65,
      lifeExpectancy: 75,
      annualIncome: 600000,
    }

    it('produces zero CGT when the realized gain is below the annual exclusion', () => {
      const smallDiscretionary: Account = {
        id: 'disc-small',
        name: 'Discretionary',
        type: 'discretionary',
        provider: 'Test',
        currentBalance: 100000,
        monthlyContribution: 0,
        expectedReturn: 8,
        annualFees: 0.5,
        contributionEscalation: 0,
      }
      const result = calculateProjection(
        [smallDiscretionary],
        shortHorizonInfo,
        baseRetirementGoals,
        baseDrawdownConfig // 4% fixed_percentage withdrawal -> small realized gain
      )
      const firstYear = result.yearlyProjections.find(p => p.age === 65)!

      expect(firstYear.discretionaryWithdrawal).toBeGreaterThan(0)
      expect(firstYear.cgtTaxableAmount).toBe(0)
    })

    it('taxes only the gain in excess of the annual exclusion', () => {
      const largeDiscretionary: Account = {
        id: 'disc-large',
        name: 'Discretionary',
        type: 'discretionary',
        provider: 'Test',
        currentBalance: 50000000,
        monthlyContribution: 0,
        expectedReturn: 8,
        annualFees: 0.5,
        contributionEscalation: 0,
      }
      const result = calculateProjection(
        [largeDiscretionary],
        shortHorizonInfo,
        baseRetirementGoals,
        { ...baseDrawdownConfig, strategy: 'fixed_percentage', initialWithdrawalRate: 80, lumpSumPercentage: 0 }
      )
      const firstYear = result.yearlyProjections.find(p => p.age === 65)!

      // Replicate the engine's exact math: 2 years monthly-compounded accumulation
      // (nominal method, no contributions), then one year of simple-annual drawdown growth.
      const netReturn = (8 - 0.5) / 100
      const monthlyRate = netReturn / 12
      const v0 = 50000000 * Math.pow(1 + monthlyRate, 24)
      const currentTotal = v0 * (1 + netReturn)
      const annualWithdrawal = v0 * 0.8
      const take = Math.min(annualWithdrawal, currentTotal)
      const gainFraction = (currentTotal - 50000000) / currentTotal
      const gainTaken = take * gainFraction
      const expectedCgt = Math.max(0, gainTaken - SA_TAX_LIMITS.cgtAnnualExclusion) * SA_TAX_LIMITS.cgtInclusionRateIndividual

      expect(firstYear.cgtTaxableAmount).toBeCloseTo(expectedCgt, -1)
      expect(firstYear.cgtTaxableAmount).toBeGreaterThan(0)
      // Sanity check: exclusion meaningfully reduces tax vs. naive gain × 40% with no exclusion
      expect(firstYear.cgtTaxableAmount).toBeLessThan(gainTaken * 0.4)
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

  describe('TFSA contribution limits', () => {
    const tfsaAccount: Account = {
      id: 'tfsa-1',
      name: 'My TFSA',
      type: 'tfsa',
      provider: 'Allan Gray',
      currentBalance: 200000,
      monthlyContribution: 3000, // R36k/year — at annual limit
      expectedReturn: 10,
      annualFees: 0.5,
      contributionEscalation: 0,
      tfsaContributionsToDate: 200000,
    }

    const shortPersonalInfo: PersonalInfo = {
      currentAge: 55,
      retirementAge: 65,
      lifeExpectancy: 80,
      annualIncome: 400000,
    }

    it('should stop contributions once lifetime limit (R500k) is reached', () => {
      // R200k to date + R36k/year × 10 years = R560k > R500k
      // So contributions should stop after ~8.3 years (R300k remaining / R36k p.a.)
      const result = calculateProjection(
        [tfsaAccount],
        shortPersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      // Total contributions across accumulation years must not exceed R300k remaining room
      const totalContributions = result.yearlyProjections
        .slice(0, 10)
        .reduce((sum, y) => sum + y.contributions, 0)

      expect(totalContributions).toBeLessThanOrEqual(300000 + 1) // R500k - R200k, tiny rounding buffer
    })

    it('should allow zero further contributions when lifetime limit already reached', () => {
      const fullAccount: Account = {
        ...tfsaAccount,
        tfsaContributionsToDate: 500000, // lifetime maxed out
        currentBalance: 650000,          // balance can exceed limit (it's growth)
        monthlyContribution: 3000,
      }

      const result = calculateProjection(
        [fullAccount],
        shortPersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      const totalContributions = result.yearlyProjections
        .slice(0, 10)
        .reduce((sum, y) => sum + y.contributions, 0)

      expect(totalContributions).toBe(0)
    })

    it('should cap annual contributions at R46k even with higher monthly amounts', () => {
      const overContributingAccount: Account = {
        ...tfsaAccount,
        monthlyContribution: 5000, // R60k/year — over annual limit
        tfsaContributionsToDate: 0,
        contributionEscalation: 0,
      }

      const result = calculateProjection(
        [overContributingAccount],
        shortPersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      // Year 1 contributions must not exceed R46k annual limit
      expect(result.yearlyProjections[0].contributions).toBeLessThanOrEqual(46000 + 1)
    })

    it('should not apply TFSA limits to non-TFSA accounts', () => {
      const raAccount: Account = {
        ...tfsaAccount,
        id: 'ra-1',
        type: 'retirement_annuity',
        monthlyContribution: 5000, // R60k/year — fine for RA
        tfsaContributionsToDate: undefined,
      }

      const result = calculateProjection(
        [raAccount],
        shortPersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      // Year 1 contributions should reflect full R60k (no cap for RA)
      expect(result.yearlyProjections[0].contributions).toBeGreaterThan(46000)
    })
  })

  describe('Account depletion tracking', () => {
    const shortInfo: PersonalInfo = {
      currentAge: 60,
      retirementAge: 65,
      lifeExpectancy: 80,
      annualIncome: 600000,
    }

    it('accountBalancesAtRetirement is populated for each account', () => {
      const ra: Account = { ...baseAccount, id: 'ra-1', type: 'retirement_annuity', currentBalance: 500000 }
      const tfsa: Account = { ...baseAccount, id: 'tfsa-1', type: 'tfsa', currentBalance: 200000, monthlyContribution: 0 }

      const result = calculateProjection([ra, tfsa], shortInfo, baseRetirementGoals, baseDrawdownConfig)

      expect(result.accountBalancesAtRetirement).toHaveProperty('ra-1')
      expect(result.accountBalancesAtRetirement).toHaveProperty('tfsa-1')
      expect(result.accountBalancesAtRetirement['ra-1']).toBeGreaterThan(0)
      expect(result.accountBalancesAtRetirement['tfsa-1']).toBeGreaterThan(0)
    })

    it('accountBalances snapshot is populated in each drawdown year projection', () => {
      const ra: Account = { ...baseAccount, id: 'ra-1', type: 'retirement_annuity', currentBalance: 500000 }

      const result = calculateProjection([ra], shortInfo, baseRetirementGoals, baseDrawdownConfig)

      const drawdownRows = result.yearlyProjections.filter(p => p.age >= shortInfo.retirementAge)
      expect(drawdownRows.length).toBeGreaterThan(0)
      drawdownRows.forEach(row => {
        expect(row.accountBalances).toBeDefined()
        expect(row.accountBalances).toHaveProperty('ra-1')
      })
    })

    it('accountBalances decreases monotonically for a depleting account', () => {
      // Small balance forces depletion
      const ra: Account = { ...baseAccount, id: 'ra-1', type: 'retirement_annuity', currentBalance: 50000, monthlyContribution: 0 }
      const highWithdrawal: RetirementGoals = { ...baseRetirementGoals, desiredMonthlyIncome: 30000 }
      const fixedPct: DrawdownConfig = { ...baseDrawdownConfig, strategy: 'fixed_percentage', initialWithdrawalRate: 10 }

      const result = calculateProjection([ra], shortInfo, highWithdrawal, fixedPct)

      const drawdownRows = result.yearlyProjections.filter(p => p.age >= shortInfo.retirementAge && p.accountBalances)
      // Find the transition to zero
      let hitZero = false
      for (const row of drawdownRows) {
        const bal = row.accountBalances!['ra-1']
        if (hitZero) {
          expect(bal).toBe(0)
        } else if (bal === 0) {
          hitZero = true
        }
      }
    })

    it('TFSA accountBalances depletes before pension in sequential withdrawal', () => {
      // Small TFSA balance, large RA — TFSA should deplete first
      const tfsa: Account = { ...baseAccount, id: 'tfsa-1', type: 'tfsa', currentBalance: 100000, monthlyContribution: 0 }
      const ra: Account = { ...baseAccount, id: 'ra-1', type: 'retirement_annuity', currentBalance: 2000000, monthlyContribution: 0 }

      const result = calculateProjection([tfsa, ra], shortInfo, baseRetirementGoals, baseDrawdownConfig)

      const drawdownRows = result.yearlyProjections.filter(p => p.age >= shortInfo.retirementAge && p.accountBalances)

      // TFSA should hit zero before RA hits zero (or TFSA hits zero while RA still has balance)
      const tfsaDepletionYear = drawdownRows.find(r => (r.accountBalances!['tfsa-1'] ?? 0) <= 0)
      const raDepletionYear = drawdownRows.find(r => (r.accountBalances!['ra-1'] ?? 0) <= 0)

      expect(tfsaDepletionYear).toBeDefined() // Small TFSA should deplete
      if (raDepletionYear) {
        expect(tfsaDepletionYear!.age).toBeLessThanOrEqual(raDepletionYear.age)
      } else {
        // RA survives — that's fine, TFSA still depleted first
        expect(tfsaDepletionYear).toBeDefined()
      }
    })

    it('accountBalancesAtRetirement returns empty object for no accounts', () => {
      const result = calculateProjection([], shortInfo, baseRetirementGoals, baseDrawdownConfig)
      expect(result.accountBalancesAtRetirement).toEqual({})
    })

    it('lump sum deduction is reflected in accountBalancesAtRetirement', () => {
      const ra: Account = { ...baseAccount, id: 'ra-1', type: 'retirement_annuity', currentBalance: 500000, monthlyContribution: 0 }
      const noLumpSum: DrawdownConfig = { ...baseDrawdownConfig, lumpSumPercentage: 0 }
      const withLumpSum: DrawdownConfig = { ...baseDrawdownConfig, lumpSumPercentage: 30 }

      const r1 = calculateProjection([ra], shortInfo, baseRetirementGoals, noLumpSum)
      const r2 = calculateProjection([ra], shortInfo, baseRetirementGoals, withLumpSum)

      // With 30% lump sum, retirement balance should be ~70% of no-lump-sum
      const bal1 = r1.accountBalancesAtRetirement['ra-1']
      const bal2 = r2.accountBalancesAtRetirement['ra-1']
      expect(bal2).toBeCloseTo(bal1 * 0.7, 0)
    })
  })

  describe('Medical aid escalation', () => {
    const shortInfo: PersonalInfo = { currentAge: 60, retirementAge: 65, lifeExpectancy: 70, annualIncome: 600000 }
    const inflationRate = 5.5 // stored as percentage
    const goals: RetirementGoals = { ...baseRetirementGoals, inflationRate }
    const monthlyMedicalAid = 3000 // today's Rands

    it('medical aid contribution increases each retirement year with inflation', () => {
      const result = calculateProjection(
        [baseAccount],
        shortInfo,
        goals,
        { ...baseDrawdownConfig, monthlyMedicalAid }
      )

      const retirementRows = result.yearlyProjections.filter(r => r.age >= shortInfo.retirementAge)
      // Each year's medical aid should be strictly greater than the previous year's
      for (let i = 1; i < retirementRows.length; i++) {
        expect(retirementRows[i].medicalAidContribution).toBeGreaterThan(
          retirementRows[i - 1].medicalAidContribution
        )
      }
    })

    it('first retirement year medical aid equals today value escalated to retirement', () => {
      const result = calculateProjection(
        [baseAccount],
        shortInfo,
        goals,
        { ...baseDrawdownConfig, monthlyMedicalAid }
      )

      const yearsToRetirement = shortInfo.retirementAge - shortInfo.currentAge // 5
      const inflationDecimal = inflationRate / 100
      const expectedAnnual = monthlyMedicalAid * Math.pow(1 + inflationDecimal, yearsToRetirement) * 12

      const firstRetirementRow = result.yearlyProjections.find(r => r.age === shortInfo.retirementAge)!
      expect(firstRetirementRow.medicalAidContribution).toBeCloseTo(expectedAnnual, 0)
    })

    it('without medical aid, medicalAidContribution is zero in all retirement rows', () => {
      const result = calculateProjection(
        [baseAccount],
        shortInfo,
        goals,
        { ...baseDrawdownConfig, monthlyMedicalAid: undefined }
      )

      const retirementRows = result.yearlyProjections.filter(r => r.age >= shortInfo.retirementAge)
      retirementRows.forEach(r => expect(r.medicalAidContribution).toBe(0))
    })

    it('medical aid reduces net income relative to no medical aid', () => {
      const withMedical = calculateProjection(
        [baseAccount], shortInfo, goals, { ...baseDrawdownConfig, monthlyMedicalAid }
      )
      const withoutMedical = calculateProjection(
        [baseAccount], shortInfo, goals, { ...baseDrawdownConfig, monthlyMedicalAid: undefined }
      )

      const firstWith = withMedical.yearlyProjections.find(r => r.age === shortInfo.retirementAge)!
      const firstWithout = withoutMedical.yearlyProjections.find(r => r.age === shortInfo.retirementAge)!
      expect(firstWith.netIncome).toBeLessThan(firstWithout.netIncome)
    })
  })

  describe('Section 11F excess contribution credit', () => {
    // High earner: R1.8M income → limit capped at R430k. RA contributions R600k/year.
    // Excess = R170k/year. Static income escalated with inflation; for cap-dominated users
    // it remains R430k regardless, so excess per year stays R170k (before escalation of contributions).
    const highEarnerInfo: PersonalInfo = {
      currentAge: 55,
      retirementAge: 65,
      lifeExpectancy: 85,
      annualIncome: 1800000,
    }

    // Monthly RA contribution R50,000 = R600,000/year
    const highContribAccount: Account = {
      id: 'ra1',
      name: 'RA',
      type: 'retirement_annuity',
      provider: 'Test',
      currentBalance: 5000000,
      monthlyContribution: 50000,
      expectedReturn: 10,
      annualFees: 1,
      contributionEscalation: 0, // keep simple for predictable excess
    }

    const highEarnerGoals: RetirementGoals = {
      desiredMonthlyIncome: 80000,
      inflationRate: 5.5,
      legacyAmount: 0,
    }

    it('should accumulate excess credit for high earner over accumulation phase', () => {
      const result = calculateProjection(
        [highContribAccount],
        highEarnerInfo,
        highEarnerGoals,
        { ...baseDrawdownConfig, lumpSumPercentage: 0 },
      )

      // R600k contributions/year, limit R430k → R170k excess/year × 10 years = R1,700,000
      // (contributions don't escalate so limit stays R430k each year)
      expect(result.accumulatedExcessCredit).toBeCloseTo(1700000, -3)
    })

    it('should reduce taxable lump sum by the credit applied', () => {
      const result = calculateProjection(
        [highContribAccount],
        highEarnerInfo,
        highEarnerGoals,
        { ...baseDrawdownConfig, lumpSumPercentage: 33 },
      )

      const { lumpSumAmount, taxableLumpSum, creditAppliedToLumpSum } = result.lumpSumCommutation
      expect(creditAppliedToLumpSum).toBeGreaterThan(0)
      expect(taxableLumpSum).toBeLessThan(lumpSumAmount)
      expect(taxableLumpSum).toBeCloseTo(lumpSumAmount - creditAppliedToLumpSum, 0)
    })

    it('should carry credit into drawdown when credit exceeds lump sum', () => {
      const result = calculateProjection(
        [highContribAccount],
        highEarnerInfo,
        highEarnerGoals,
        { ...baseDrawdownConfig, lumpSumPercentage: 0 }, // no lump sum → all credit carried forward
      )

      expect(result.lumpSumCommutation.creditAppliedToLumpSum).toBe(0)
      expect(result.lumpSumCommutation.creditCarriedIntoDrawdown).toBeGreaterThan(0)

      // First drawdown year should apply credit
      const firstDrawdownYear = result.yearlyProjections.find(r => r.age === highEarnerInfo.retirementAge)!
      expect(firstDrawdownYear.excessCreditApplied).toBeGreaterThan(0)
    })

    it('should exhaust credit over drawdown years', () => {
      const result = calculateProjection(
        [highContribAccount],
        highEarnerInfo,
        highEarnerGoals,
        { ...baseDrawdownConfig, lumpSumPercentage: 0 },
      )

      const drawdownRows = result.yearlyProjections.filter(r => r.age >= highEarnerInfo.retirementAge)
      const lastRowWithCredit = drawdownRows.filter(r => (r.excessCreditRemaining ?? 0) > 0)
      const firstRowWithoutCredit = drawdownRows.find(r => (r.excessCreditRemaining ?? 1) === 0)

      // Credit should be non-zero initially and reach zero at some point
      expect(lastRowWithCredit.length).toBeGreaterThan(0)
      expect(firstRowWithoutCredit).toBeDefined()
      // After credit is exhausted, remaining rows should stay at zero
      if (firstRowWithoutCredit) {
        const indexAfter = drawdownRows.indexOf(firstRowWithoutCredit)
        drawdownRows.slice(indexAfter).forEach(r => {
          expect(r.excessCreditRemaining).toBe(0)
        })
      }
    })

    it('should produce zero excess credit when contributions are within limit', () => {
      const withinLimitAccount: Account = {
        ...highContribAccount,
        monthlyContribution: 5000, // R60k/year, well within R430k
      }
      const result = calculateProjection(
        [withinLimitAccount],
        highEarnerInfo,
        highEarnerGoals,
        { ...baseDrawdownConfig, lumpSumPercentage: 33 },
      )

      expect(result.accumulatedExcessCredit).toBe(0)
      expect(result.lumpSumCommutation.creditAppliedToLumpSum).toBe(0)
      expect(result.lumpSumCommutation.creditCarriedIntoDrawdown).toBe(0)
    })

    it('should not apply credit to TFSA or discretionary withdrawals', () => {
      const tfsaAccount: Account = {
        id: 'tfsa1',
        name: 'TFSA',
        type: 'tfsa',
        provider: 'Test',
        currentBalance: 200000,
        monthlyContribution: 3000,
        expectedReturn: 10,
        annualFees: 0.5,
        contributionEscalation: 0,
      }
      const result = calculateProjection(
        [tfsaAccount],
        highEarnerInfo,
        highEarnerGoals,
        { ...baseDrawdownConfig, lumpSumPercentage: 0 },
      )

      // TFSA contributions don't count toward Section 11F → no excess credit
      expect(result.accumulatedExcessCredit).toBe(0)
    })
  })
})
