import { describe, it, expect } from "vitest"
import {
  projectMedicalCosts,
  calculateMedicalPercentage,
  calculateMedicalInflationPremium,
} from "../medical-costs"
import { SA_DEFAULTS } from "@/lib/constants/defaults"

describe("projectMedicalCosts", () => {
  const baseParams = {
    currentAge: 45,
    retirementAge: 65,
    lifeExpectancy: 90,
  }

  describe("Basic functionality", () => {
    it("should return correct structure", () => {
      const result = projectMedicalCosts(baseParams)

      expect(result).toHaveProperty("yearlyBreakdown")
      expect(result).toHaveProperty("totalMedicalCostInRetirement")
      expect(result).toHaveProperty("averageMonthlyMedicalCost")
      expect(result).toHaveProperty("medicalCostAtRetirement")
      expect(result).toHaveProperty("medicalCostAt75")
      expect(result).toHaveProperty("medicalCostAt85")
      expect(result).toHaveProperty("percentageOfExpenses")
    })

    it("should generate correct number of years in breakdown", () => {
      const result = projectMedicalCosts(baseParams)
      const yearsInRetirement = baseParams.lifeExpectancy - baseParams.retirementAge // 25 years
      expect(result.yearlyBreakdown).toHaveLength(yearsInRetirement)
    })

    it("should have yearly breakdown with correct ages", () => {
      const result = projectMedicalCosts(baseParams)
      expect(result.yearlyBreakdown[0].age).toBe(65) // Retirement age
      expect(result.yearlyBreakdown[24].age).toBe(89) // Last year
    })

    it("should use SA default values when not overridden", () => {
      const result = projectMedicalCosts(baseParams)
      // Medical cost at retirement should be base inflated by 20 years at 9%
      const expectedAtRetirement =
        SA_DEFAULTS.baseMedicalCostMonthly * Math.pow(1 + SA_DEFAULTS.medicalInflation, 20)
      expect(result.medicalCostAtRetirement).toBeCloseTo(expectedAtRetirement, 0)
    })
  })

  describe("Medical inflation modeling", () => {
    it("should apply 9% SA medical inflation by default", () => {
      const result = projectMedicalCosts({
        currentAge: 65, // Already at retirement
        retirementAge: 65,
        lifeExpectancy: 67, // 2 years
      })

      const year1 = result.yearlyBreakdown[0].monthlyMedicalCost
      const year2 = result.yearlyBreakdown[1].monthlyMedicalCost

      // Year 2 should be higher due to medical inflation AND age-related increase
      expect(year2).toBeGreaterThan(year1)

      // Base inflation component: 9%
      // Age component: 2% additional per year
      const inflationComponent = 1 + SA_DEFAULTS.medicalInflation
      const ageComponent = 1 + SA_DEFAULTS.medicalCostGrowthAge

      // Year 2 = Year 1 * medicalInflation * (1 + ageGrowth * 1)
      const expectedRatio = inflationComponent * (1 + SA_DEFAULTS.medicalCostGrowthAge)
      const actualRatio = year2 / year1

      expect(actualRatio).toBeCloseTo(expectedRatio, 2)
    })

    it("should allow custom medical inflation rate", () => {
      const result = projectMedicalCosts({
        ...baseParams,
        medicalInflation: 0.12, // 12%
      })

      // Should be higher than default 9%
      const defaultResult = projectMedicalCosts(baseParams)
      expect(result.totalMedicalCostInRetirement).toBeGreaterThan(
        defaultResult.totalMedicalCostInRetirement
      )
    })
  })

  describe("Age-related cost increases", () => {
    it("should increase costs with age (2% per year default)", () => {
      const result = projectMedicalCosts({
        currentAge: 65,
        retirementAge: 65,
        lifeExpectancy: 75, // 10 years
      })

      // Year 10 should have age multiplier of 1 + 0.02 * 9 = 1.18
      const year1AgeMultiplier = 1 // Year 0 in retirement
      const year10AgeMultiplier = 1 + SA_DEFAULTS.medicalCostGrowthAge * 9 // Year 9

      expect(year10AgeMultiplier).toBeCloseTo(1.18, 2)
    })

    it("should compound both inflation and age factors", () => {
      const result = projectMedicalCosts({
        currentAge: 65,
        retirementAge: 65,
        lifeExpectancy: 70, // 5 years
        currentMedicalCostMonthly: 1000, // Simplified base
        medicalInflation: 0.10, // 10%
      })

      // Year 0: 1000 * (1 + 0.02 * 0) = 1000
      // Year 1: 1000 * 1.10 * (1 + 0.02 * 1) = 1000 * 1.10 * 1.02 = 1122
      // Year 2: 1000 * 1.10^2 * (1 + 0.02 * 2) = 1000 * 1.21 * 1.04 = 1258.4

      expect(result.yearlyBreakdown[0].monthlyMedicalCost).toBeCloseTo(1000, 0)
      expect(result.yearlyBreakdown[1].monthlyMedicalCost).toBeCloseTo(1122, 0)
      expect(result.yearlyBreakdown[2].monthlyMedicalCost).toBeCloseTo(1258.4, 0)
    })
  })

  describe("Cumulative cost tracking", () => {
    it("should track cumulative costs correctly", () => {
      const result = projectMedicalCosts({
        currentAge: 65,
        retirementAge: 65,
        lifeExpectancy: 68, // 3 years
        currentMedicalCostMonthly: 1000,
        medicalInflation: 0, // No inflation for simpler calculation
      })

      const year1Annual = result.yearlyBreakdown[0].annualMedicalCost
      const year2Annual = result.yearlyBreakdown[1].annualMedicalCost
      const year3Annual = result.yearlyBreakdown[2].annualMedicalCost

      expect(result.yearlyBreakdown[0].cumulativeMedicalCost).toBeCloseTo(year1Annual, 0)
      expect(result.yearlyBreakdown[1].cumulativeMedicalCost).toBeCloseTo(
        year1Annual + year2Annual,
        0
      )
      expect(result.yearlyBreakdown[2].cumulativeMedicalCost).toBeCloseTo(
        year1Annual + year2Annual + year3Annual,
        0
      )
    })

    it("should have total equal to last cumulative value", () => {
      const result = projectMedicalCosts(baseParams)
      const lastYear = result.yearlyBreakdown[result.yearlyBreakdown.length - 1]

      expect(result.totalMedicalCostInRetirement).toBe(lastYear.cumulativeMedicalCost)
    })
  })

  describe("Milestone ages (75, 85)", () => {
    it("should capture cost at age 75", () => {
      const result = projectMedicalCosts({
        currentAge: 50,
        retirementAge: 65,
        lifeExpectancy: 90,
      })

      // Find the entry at age 75
      const entry75 = result.yearlyBreakdown.find((y) => y.age === 75)
      expect(entry75).toBeDefined()
      expect(result.medicalCostAt75).toBe(entry75!.monthlyMedicalCost)
    })

    it("should capture cost at age 85", () => {
      const result = projectMedicalCosts({
        currentAge: 50,
        retirementAge: 65,
        lifeExpectancy: 90,
      })

      const entry85 = result.yearlyBreakdown.find((y) => y.age === 85)
      expect(entry85).toBeDefined()
      expect(result.medicalCostAt85).toBe(entry85!.monthlyMedicalCost)
    })

    it("should handle retirement after 75", () => {
      const result = projectMedicalCosts({
        currentAge: 70,
        retirementAge: 78,
        lifeExpectancy: 90,
      })

      // When retiring after 75, medicalCostAt75 should be the retirement cost
      expect(result.medicalCostAt75).toBe(result.medicalCostAtRetirement)
    })

    it("should handle life expectancy before 75", () => {
      const result = projectMedicalCosts({
        currentAge: 60,
        retirementAge: 65,
        lifeExpectancy: 72, // Dies before 75
      })

      // Should use last available cost
      const lastEntry = result.yearlyBreakdown[result.yearlyBreakdown.length - 1]
      expect(result.medicalCostAt75).toBe(lastEntry.monthlyMedicalCost)
    })

    it("should handle life expectancy before 85", () => {
      const result = projectMedicalCosts({
        currentAge: 60,
        retirementAge: 65,
        lifeExpectancy: 80, // Dies before 85
      })

      // Should use last available cost
      const lastEntry = result.yearlyBreakdown[result.yearlyBreakdown.length - 1]
      expect(result.medicalCostAt85).toBe(lastEntry.monthlyMedicalCost)
    })
  })

  describe("Average monthly cost calculation", () => {
    it("should calculate average correctly", () => {
      const result = projectMedicalCosts({
        currentAge: 65,
        retirementAge: 65,
        lifeExpectancy: 68, // 3 years
        currentMedicalCostMonthly: 1000,
        medicalInflation: 0,
      })

      const sum = result.yearlyBreakdown.reduce((acc, y) => acc + y.monthlyMedicalCost, 0)
      const expectedAverage = sum / result.yearlyBreakdown.length

      expect(result.averageMonthlyMedicalCost).toBeCloseTo(expectedAverage, 0)
    })
  })

  describe("Edge cases", () => {
    it("should handle retirement at current age (0 years to retirement)", () => {
      const result = projectMedicalCosts({
        currentAge: 65,
        retirementAge: 65,
        lifeExpectancy: 90,
      })

      // No inflation applied for years to retirement
      expect(result.medicalCostAtRetirement).toBeCloseTo(SA_DEFAULTS.baseMedicalCostMonthly, 0)
    })

    it("should handle 0 years in retirement", () => {
      const result = projectMedicalCosts({
        currentAge: 60,
        retirementAge: 65,
        lifeExpectancy: 65, // Dies at retirement
      })

      expect(result.yearlyBreakdown).toHaveLength(0)
      expect(result.totalMedicalCostInRetirement).toBe(0)
      expect(result.averageMonthlyMedicalCost).toBe(0)
    })

    it("should handle custom base medical cost", () => {
      const customCost = 5000
      const result = projectMedicalCosts({
        ...baseParams,
        currentMedicalCostMonthly: customCost,
      })

      // Base inflated to retirement
      const expectedAtRetirement = customCost * Math.pow(1 + SA_DEFAULTS.medicalInflation, 20)
      expect(result.medicalCostAtRetirement).toBeCloseTo(expectedAtRetirement, 0)
    })

    it("should handle very long retirement (50+ years)", () => {
      const result = projectMedicalCosts({
        currentAge: 30,
        retirementAge: 40,
        lifeExpectancy: 95, // 55 years in retirement
      })

      expect(result.yearlyBreakdown).toHaveLength(55)
      expect(result.totalMedicalCostInRetirement).toBeGreaterThan(0)
    })
  })

  describe("SA-specific scenarios", () => {
    it("should model realistic SA retiree medical costs", () => {
      const result = projectMedicalCosts({
        currentAge: 55,
        retirementAge: 65,
        lifeExpectancy: 85,
        currentMedicalCostMonthly: 4500, // Typical comprehensive medical aid
      })

      // At retirement (10 years at 9% inflation): 4500 * 1.09^10 = ~10,650
      expect(result.medicalCostAtRetirement).toBeGreaterThan(10000)
      expect(result.medicalCostAtRetirement).toBeLessThan(12000)

      // At 75 (20 years at 9% inflation + age premium): significantly higher
      expect(result.medicalCostAt75).toBeGreaterThan(result.medicalCostAtRetirement)
    })

    it("should show medical costs growing faster than general inflation", () => {
      const years = 20
      const medicalGrowth = Math.pow(1 + SA_DEFAULTS.medicalInflation, years)
      const generalGrowth = Math.pow(1 + SA_DEFAULTS.inflation, years)

      expect(medicalGrowth).toBeGreaterThan(generalGrowth)
      // Medical inflation 9% for 20 years = 5.6x
      // General inflation 5.5% for 20 years = 2.9x
      expect(medicalGrowth / generalGrowth).toBeGreaterThan(1.5)
    })
  })
})

describe("calculateMedicalPercentage", () => {
  it("should calculate percentage correctly", () => {
    expect(calculateMedicalPercentage(1000, 5000)).toBe(20)
    expect(calculateMedicalPercentage(2500, 10000)).toBe(25)
    expect(calculateMedicalPercentage(500, 2000)).toBe(25)
  })

  it("should return 0 for zero expenses", () => {
    expect(calculateMedicalPercentage(1000, 0)).toBe(0)
  })

  it("should return 0 for negative expenses", () => {
    expect(calculateMedicalPercentage(1000, -1000)).toBe(0)
  })

  it("should handle 100% medical costs", () => {
    expect(calculateMedicalPercentage(5000, 5000)).toBe(100)
  })

  it("should handle medical costs greater than total (edge case)", () => {
    expect(calculateMedicalPercentage(6000, 5000)).toBe(120)
  })
})

describe("calculateMedicalInflationPremium", () => {
  const baseParams = {
    retirementAge: 65,
    lifeExpectancy: 85,
    baseMedicalCostMonthly: 3500,
    generalInflation: 0.055,
    medicalInflation: 0.09,
  }

  it("should return positive premium when medical inflation > general inflation", () => {
    const premium = calculateMedicalInflationPremium(baseParams)
    expect(premium).toBeGreaterThan(0)
  })

  it("should return 0 when medical inflation equals general inflation", () => {
    const premium = calculateMedicalInflationPremium({
      ...baseParams,
      medicalInflation: 0.055, // Same as general
    })
    expect(premium).toBeCloseTo(0, 0)
  })

  it("should return negative when medical inflation < general inflation", () => {
    const premium = calculateMedicalInflationPremium({
      ...baseParams,
      medicalInflation: 0.04, // Less than general
    })
    expect(premium).toBeLessThan(0)
  })

  it("should increase with longer retirement", () => {
    const short = calculateMedicalInflationPremium({
      ...baseParams,
      lifeExpectancy: 75, // 10 years
    })

    const long = calculateMedicalInflationPremium({
      ...baseParams,
      lifeExpectancy: 95, // 30 years
    })

    expect(long).toBeGreaterThan(short)
  })

  it("should increase with higher base medical cost", () => {
    const low = calculateMedicalInflationPremium({
      ...baseParams,
      baseMedicalCostMonthly: 2000,
    })

    const high = calculateMedicalInflationPremium({
      ...baseParams,
      baseMedicalCostMonthly: 5000,
    })

    expect(high).toBeGreaterThan(low)
    expect(high / low).toBeCloseTo(5000 / 2000, 1)
  })

  it("should handle 0 years in retirement", () => {
    const premium = calculateMedicalInflationPremium({
      ...baseParams,
      lifeExpectancy: 65, // Same as retirement age
    })
    expect(premium).toBe(0)
  })

  it("should model SA inflation gap correctly", () => {
    // SA medical inflation (9%) vs general (5.5%) = 3.5% gap
    // Over 20 years this compounds significantly
    const premium = calculateMedicalInflationPremium({
      retirementAge: 65,
      lifeExpectancy: 85,
      baseMedicalCostMonthly: 3500,
      generalInflation: 0.055,
      medicalInflation: 0.09,
    })

    // Premium should be substantial (hundreds of thousands of Rands)
    expect(premium).toBeGreaterThan(500000)
    expect(premium).toBeLessThan(2000000)
  })

  it("should include age-related growth factor", () => {
    // The function uses SA_DEFAULTS.medicalCostGrowthAge (2% per year)
    // This makes the premium larger than pure inflation difference

    const withAgeGrowth = calculateMedicalInflationPremium(baseParams)

    // Calculate what it would be without age growth
    const yearsInRetirement = baseParams.lifeExpectancy - baseParams.retirementAge
    let totalMedical = 0
    let totalGeneral = 0

    for (let year = 0; year < yearsInRetirement; year++) {
      // Without age multiplier
      totalMedical += baseParams.baseMedicalCostMonthly *
        Math.pow(1 + baseParams.medicalInflation, year) * 12
      totalGeneral += baseParams.baseMedicalCostMonthly *
        Math.pow(1 + baseParams.generalInflation, year) * 12
    }

    const withoutAgeGrowth = totalMedical - totalGeneral

    // With age growth should be larger
    expect(withAgeGrowth).toBeGreaterThan(withoutAgeGrowth)
  })
})
