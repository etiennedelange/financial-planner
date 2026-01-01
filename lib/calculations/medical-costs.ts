import { SA_DEFAULTS } from "@/lib/constants/defaults"

interface MedicalCostParams {
  currentAge: number
  retirementAge: number
  lifeExpectancy: number
  currentMedicalCostMonthly?: number // Optional override for current medical aid cost
  generalInflation?: number // decimal
  medicalInflation?: number // decimal
}

interface YearlyMedicalCost {
  age: number
  yearInRetirement: number
  monthlyMedicalCost: number
  annualMedicalCost: number
  cumulativeMedicalCost: number
}

interface MedicalCostProjection {
  yearlyBreakdown: YearlyMedicalCost[]
  totalMedicalCostInRetirement: number
  averageMonthlyMedicalCost: number
  medicalCostAtRetirement: number
  medicalCostAt75: number
  medicalCostAt85: number
  percentageOfExpenses: {
    atRetirement: number
    at75: number
    at85: number
  }
}

/**
 * Calculate projected medical costs throughout retirement
 * Takes into account:
 * 1. Medical inflation (typically 9% in SA vs 5.5% general inflation)
 * 2. Age-related cost increases (medical costs increase with age)
 * 3. Cumulative lifetime medical expenses in retirement
 */
export function projectMedicalCosts(params: MedicalCostParams): MedicalCostProjection {
  const {
    currentAge,
    retirementAge,
    lifeExpectancy,
    currentMedicalCostMonthly = SA_DEFAULTS.baseMedicalCostMonthly,
    generalInflation = SA_DEFAULTS.inflation,
    medicalInflation = SA_DEFAULTS.medicalInflation,
  } = params

  const yearsToRetirement = retirementAge - currentAge
  const yearsInRetirement = lifeExpectancy - retirementAge

  // Calculate medical cost at retirement (inflated from today)
  const medicalCostAtRetirementMonthly =
    currentMedicalCostMonthly * Math.pow(1 + medicalInflation, yearsToRetirement)

  const yearlyBreakdown: YearlyMedicalCost[] = []
  let cumulativeCost = 0
  let medicalCostAt75 = 0
  let medicalCostAt85 = 0

  for (let year = 0; year < yearsInRetirement; year++) {
    const age = retirementAge + year

    // Base medical cost increases with medical inflation
    const baseCost =
      medicalCostAtRetirementMonthly * Math.pow(1 + medicalInflation, year)

    // Additional age-related increase (medical needs grow with age)
    const ageMultiplier = 1 + SA_DEFAULTS.medicalCostGrowthAge * year
    const monthlyMedicalCost = baseCost * ageMultiplier

    const annualMedicalCost = monthlyMedicalCost * 12
    cumulativeCost += annualMedicalCost

    yearlyBreakdown.push({
      age,
      yearInRetirement: year + 1,
      monthlyMedicalCost,
      annualMedicalCost,
      cumulativeMedicalCost: cumulativeCost,
    })

    // Capture costs at specific ages
    if (age === 75) medicalCostAt75 = monthlyMedicalCost
    if (age === 85) medicalCostAt85 = monthlyMedicalCost
  }

  // Handle cases where retirement age is after 75 or 85
  if (retirementAge > 75) medicalCostAt75 = medicalCostAtRetirementMonthly
  if (retirementAge > 85) medicalCostAt85 = medicalCostAtRetirementMonthly

  // If life expectancy doesn't reach these ages, use the last available
  if (medicalCostAt75 === 0 && yearlyBreakdown.length > 0) {
    medicalCostAt75 = yearlyBreakdown[yearlyBreakdown.length - 1].monthlyMedicalCost
  }
  if (medicalCostAt85 === 0 && yearlyBreakdown.length > 0) {
    medicalCostAt85 = yearlyBreakdown[yearlyBreakdown.length - 1].monthlyMedicalCost
  }

  const averageMonthlyMedicalCost =
    yearlyBreakdown.length > 0
      ? yearlyBreakdown.reduce((sum, y) => sum + y.monthlyMedicalCost, 0) /
        yearlyBreakdown.length
      : 0

  return {
    yearlyBreakdown,
    totalMedicalCostInRetirement: cumulativeCost,
    averageMonthlyMedicalCost,
    medicalCostAtRetirement: medicalCostAtRetirementMonthly,
    medicalCostAt75,
    medicalCostAt85,
    percentageOfExpenses: {
      atRetirement: 0, // Will be calculated by caller with actual expenses
      at75: 0,
      at85: 0,
    },
  }
}

/**
 * Calculate what percentage of retirement expenses medical costs represent
 */
export function calculateMedicalPercentage(
  medicalCostMonthly: number,
  totalMonthlyExpenses: number
): number {
  if (totalMonthlyExpenses <= 0) return 0
  return (medicalCostMonthly / totalMonthlyExpenses) * 100
}

/**
 * Calculate the additional savings needed to cover medical inflation premium
 * (the difference between medical inflation and general inflation)
 */
export function calculateMedicalInflationPremium(params: {
  retirementAge: number
  lifeExpectancy: number
  baseMedicalCostMonthly: number
  generalInflation: number
  medicalInflation: number
}): number {
  const {
    retirementAge,
    lifeExpectancy,
    baseMedicalCostMonthly,
    generalInflation,
    medicalInflation,
  } = params

  const yearsInRetirement = lifeExpectancy - retirementAge
  let totalAtMedicalInflation = 0
  let totalAtGeneralInflation = 0

  for (let year = 0; year < yearsInRetirement; year++) {
    const ageMultiplier = 1 + SA_DEFAULTS.medicalCostGrowthAge * year

    // Cost with medical inflation
    const costMedical =
      baseMedicalCostMonthly *
      Math.pow(1 + medicalInflation, year) *
      ageMultiplier *
      12
    totalAtMedicalInflation += costMedical

    // Cost with general inflation
    const costGeneral =
      baseMedicalCostMonthly *
      Math.pow(1 + generalInflation, year) *
      ageMultiplier *
      12
    totalAtGeneralInflation += costGeneral
  }

  // The premium is the additional amount needed due to higher medical inflation
  return totalAtMedicalInflation - totalAtGeneralInflation
}
