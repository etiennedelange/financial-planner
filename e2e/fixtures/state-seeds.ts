import type { CalculatorState } from '../helpers/state-manager'
import type { Account } from '@/types'

/**
 * Preset states for different test scenarios
 *
 * These states represent realistic South African retirement scenarios
 * and can be seeded into localStorage for testing.
 */

/**
 * Empty state - First-time user
 */
export const EMPTY_STATE: Partial<CalculatorState> = {
  accounts: [],
}

/**
 * Single TFSA account
 * Scenario: Young professional starting to save
 */
export const SINGLE_TFSA_STATE: Partial<CalculatorState> = {
  accounts: [
    {
      id: 'tfsa-001',
      name: 'Tax Free Savings',
      provider: 'Allan Gray',
      type: 'tfsa',
      currentBalance: 150000, // R150k
      monthlyContribution: 3000, // R3k/month (R36k/year = annual limit)
      expectedReturn: 11, // 11% p.a.
      annualFees: 0.5, // 0.5% TER
      contributionEscalation: 6, // 6% annual increase
    },
  ],
}

/**
 * Multi-account portfolio
 * Scenario: Established professional with diversified retirement savings
 */
export const MULTI_ACCOUNT_STATE: Partial<CalculatorState> = {
  accounts: [
    // TFSA
    {
      id: 'tfsa-001',
      name: 'Tax Free Savings',
      provider: 'Allan Gray',
      type: 'tfsa',
      currentBalance: 350000,
      monthlyContribution: 3000, // Annual limit
      expectedReturn: 11,
      annualFees: 0.5,
      contributionEscalation: 6,
    },
    // Retirement Annuity
    {
      id: 'ra-001',
      name: 'Retirement Annuity',
      provider: '10X Investments',
      type: 'retirement_annuity',
      currentBalance: 450000,
      monthlyContribution: 5000,
      expectedReturn: 10.5,
      annualFees: 1.0,
      contributionEscalation: 7, // Salary linked
    },
    // Pension Fund
    {
      id: 'pension-001',
      name: 'Company Pension Fund',
      provider: 'Sanlam',
      type: 'pension_fund',
      currentBalance: 800000,
      monthlyContribution: 4000, // Employer + employee
      expectedReturn: 9.5,
      annualFees: 1.2,
      contributionEscalation: 7,
    },
  ],
}

/**
 * Near-retirement scenario
 * Scenario: 63-year-old preparing to retire at 65
 */
export const RETIREMENT_READY_STATE: Partial<CalculatorState> = {
  accounts: [
    {
      id: 'ra-001',
      name: 'Retirement Annuity',
      provider: '10X Investments',
      type: 'retirement_annuity',
      currentBalance: 2500000,
      monthlyContribution: 8000,
      expectedReturn: 10,
      annualFees: 0.9,
      contributionEscalation: 5,
    },
    {
      id: 'pension-001',
      name: 'Company Pension Fund',
      provider: 'Old Mutual',
      type: 'pension_fund',
      currentBalance: 4200000,
      monthlyContribution: 6000,
      expectedReturn: 9,
      annualFees: 1.1,
      contributionEscalation: 5,
    },
    {
      id: 'preservation-001',
      name: 'Preservation Fund',
      provider: 'Allan Gray',
      type: 'preservation_fund',
      currentBalance: 1800000,
      monthlyContribution: 0, // No contributions allowed
      expectedReturn: 10.5,
      annualFees: 0.8,
      contributionEscalation: 0,
    },
  ],
  personalInfo: {
    currentAge: 63,
    retirementAge: 65,
    lifeExpectancy: 90,
    annualIncome: 800000,
  },
  retirementGoals: {
    desiredMonthlyIncome: 40000, // R40k/month in today's Rands
    inflationRate: 5.5,
    legacyAmount: 500000,
  },
}

/**
 * TFSA at contribution limit
 * Scenario: TFSA has hit R500k lifetime limit, no new contributions
 * This tests the R0 contribution scenario documented in testing plan
 */
export const TFSA_AT_LIMIT_STATE: Partial<CalculatorState> = {
  accounts: [
    {
      id: 'tfsa-001',
      name: 'Tax Free Savings (At Limit)',
      provider: 'Allan Gray',
      type: 'tfsa',
      currentBalance: 500000, // Lifetime limit reached
      monthlyContribution: 0, // No new contributions allowed
      expectedReturn: 11,
      annualFees: 0.5,
      contributionEscalation: 0, // Irrelevant when contribution is R0
    },
  ],
}

/**
 * Old pension fund (no longer contributing)
 * Scenario: Pension from previous employer, no longer working there
 * Tests R0 contribution with 0% escalation scenario
 */
export const OLD_PENSION_STATE: Partial<CalculatorState> = {
  accounts: [
    {
      id: 'pension-001',
      name: 'Old Employer Pension',
      provider: 'Liberty',
      type: 'pension_fund',
      currentBalance: 750000,
      monthlyContribution: 0, // No longer employed
      expectedReturn: 9,
      annualFees: 1.2,
      contributionEscalation: 0, // No escalation on R0
    },
  ],
}

/**
 * Helper function to generate accounts for testing
 */
export function createAccount(overrides: Partial<Account>): Account {
  return {
    id: `account-${Date.now()}`,
    name: 'Test Account',
    provider: 'Test Provider',
    type: 'discretionary',
    currentBalance: 100000,
    monthlyContribution: 1000,
    expectedReturn: 10,
    annualFees: 1,
    contributionEscalation: 6,
    ...overrides,
  }
}
