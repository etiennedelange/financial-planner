import type {
  Account,
  CompoundingMethod,
  PersonalInfo,
  RetirementGoals,
  MarketAssumptions,
  DrawdownConfig,
  SimulationConfig,
  SimulationRun,
  SimulationResult,
} from "@/types"
import { INVESTMENT_TYPES } from "@/types"
import {
  createSeededRandom,
  generateFactorShocks,
  getPercentile,
  returnsFromShocks,
} from "./random-returns"
import type { RandomSource } from "./random-returns"
import { SA_DEFAULTS } from "@/lib/constants/defaults"
import { SA_TAX_LIMITS } from "@/lib/constants/limits"
import { getSpendingPhaseMultiplier } from "@/lib/calculations/utils/spending-phase"
import {
  calculateEffectiveAnnualReturn,
  calculateMonthlyReturn,
} from "@/lib/calculations/utils/projection"
import { finiteOrZero, sanitizeAccounts } from "@/lib/calculations/utils/invariant-guards"
import { resolveAccountRisk, type AccountRisk } from "@/lib/calculations/utils/account-risk"
import {
  calculateIndexedIncomeTax,
  calculateLumpSumCommutation,
  taxThresholdForAge,
  taxThresholdScale,
} from "@/lib/calculations/retirement-tax"
import {
  calculateInitialWithdrawal,
  calculateNextWithdrawal,
} from "@/lib/calculations/utils/drawdown-withdrawal"
import {
  isPensionType,
  runDrawdownYear,
  type DrawdownPot,
} from "@/lib/calculations/utils/drawdown-year"
import {
  admitTfsaContribution,
  createTfsaAllowance,
  startTfsaYear,
} from "@/lib/calculations/utils/tfsa-allowance"
import {
  resolveTaxThresholdIndexation,
  type TaxThresholdIndexation,
} from "@/lib/calculations/utils/tax-relief"

/**
 * Simulate a single run with stochastic returns.
 *
 * Accumulation, TFSA limits, lump-sum commutation and each drawdown year go through the
 * same shared functions as the deterministic projection, so at zero volatility the two
 * engines produce the same balances. The remaining, deliberate differences are the
 * `desiredIncomeFloor` withdrawal baseline (see `WithdrawalBaseline`) and tax, which is
 * computed for reporting only.
 */
function simulateSingleRun(
  runId: number,
  accounts: Account[],
  accountRisks: readonly AccountRisk[],
  riskLoadings: ReadonlyMap<string, number>,
  yearsToRetirement: number,
  yearsInRetirement: number,
  inflationRate: number,
  desiredMonthlyIncome: number,
  drawdownConfig: DrawdownConfig,
  currentAge: number,
  compoundingMethod: CompoundingMethod,
  lumpSumPercentage: number,
  taxIndexation: TaxThresholdIndexation,
  rng: RandomSource,
): SimulationRun {
  const totalYears = yearsToRetirement + yearsInRetirement

  // NaN/Infinity inputs must not poison the simulation arithmetic (Phase 9.1).
  const safeAccounts = sanitizeAccounts(accounts)

  // Track each account's balance and cost basis separately during accumulation
  const accountBalances = safeAccounts.map((acc) => acc.currentBalance)
  const accountCostBases = safeAccounts.map((acc) => acc.currentBalance)
  const accountMonthlyContributions = safeAccounts.map((acc) => acc.monthlyContribution)

  // One-factor shocks (generateFactorShocks): a market shock per year, plus one
  // idiosyncratic sequence per investment type present. Untyped accounts take the market
  // shock itself, so a plan with no typed accounts draws exactly what it did before types
  // existed. Full totalYears length so the same sequence carries on into the drawdown
  // phase (indices [yearsToRetirement, totalYears)).
  const { market, groups } = generateFactorShocks(totalYears, riskLoadings, rng)
  const accountReturns = safeAccounts.map((acc, accIdx) => {
    const netReturn = (acc.expectedReturn - acc.annualFees) / 100
    const risk = accountRisks[accIdx]
    const shocks = groups.get(risk.riskGroup) ?? market
    // Centre the random returns on the effective annual growth the deterministic projection
    // compounds to, then convert each draw to monthly geometrically (below). This keeps
    // Monte Carlo's mean equal to the projection under BOTH compounding methods; see
    // calculateEffectiveAnnualReturn for the bias the nominal `R / 12` conversion caused.
    return returnsFromShocks(
      calculateEffectiveAnnualReturn(netReturn, compoundingMethod),
      risk.volatility,
      shocks,
    )
  })

  const yearlyBalances: number[] = []
  let depletionAge: number | null = null

  // TFSA limits are per taxpayer, shared across every TFSA account — mirrors projection-engine.ts
  const tfsaAllowance = createTfsaAllowance(safeAccounts)

  // Accumulation phase - project each account separately
  for (let year = 0; year < yearsToRetirement; year++) {
    startTfsaYear(tfsaAllowance)
    for (let accIdx = 0; accIdx < safeAccounts.length; accIdx++) {
      const acc = safeAccounts[accIdx]
      const accEscalation = acc.contributionEscalation / 100
      // Geometric: (1 + R)^(1/12) − 1, whatever the plan's compounding method
      const monthlyReturn = calculateMonthlyReturn(accountReturns[accIdx][year], "compound")

      // Monthly compounding within each year for this account
      for (let month = 0; month < 12; month++) {
        // Calculate contribution for this month (smooth escalation)
        let contribution =
          accountMonthlyContributions[accIdx] * Math.pow(1 + accEscalation, year + month / 12)
        if (acc.type === "tfsa")
          contribution = admitTfsaContribution(tfsaAllowance, contribution).admitted

        // Apply growth first (end-of-period contributions, matches Excel FV type=0)
        accountBalances[accIdx] = accountBalances[accIdx] * (1 + monthlyReturn)
        accountBalances[accIdx] += contribution
        accountCostBases[accIdx] += contribution
      }
    }

    yearlyBalances.push(accountBalances.reduce((sum, bal) => sum + bal, 0))
  }

  // Lump sum commutation is only available on pension/RA/preservation balances, and SA
  // law caps it at one-third of the retirement-fund interest — mirrors projection-engine.ts.
  const pensionBalanceAtRetirement = safeAccounts.reduce(
    (sum, acc, idx) => (isPensionType(acc.type) ? sum + accountBalances[idx] : sum),
    0,
  )
  const cappedLumpSumPercentage = Math.min(
    Math.max(0, lumpSumPercentage),
    SA_TAX_LIMITS.maxLumpSumCommutationPercentage,
  )
  const lumpSumFraction = pensionBalanceAtRetirement > 0 ? cappedLumpSumPercentage / 100 : 0
  // The s11F excess-contribution credit is not tracked here, so this reported lump-sum tax
  // can exceed the deterministic figure for plans that contribute over the deduction cap.
  const lumpSumTax =
    pensionBalanceAtRetirement > 0
      ? calculateLumpSumCommutation(
          pensionBalanceAtRetirement,
          cappedLumpSumPercentage,
          0,
          taxThresholdScale(yearsToRetirement, taxIndexation.lumpSum),
        ).lumpSumTax
      : 0

  // Build per-account drawdown state with post-lump-sum balances (only pension-type
  // accounts are reduced by the commutation fraction)
  const drawdownPots: DrawdownPot[] = safeAccounts.map((acc, idx) => {
    const fraction = isPensionType(acc.type) ? lumpSumFraction : 0
    return {
      type: acc.type,
      balance: accountBalances[idx] * (1 - fraction),
      costBasis: accountCostBases[idx] * (1 - fraction),
    }
  })

  let balance = drawdownPots.reduce((sum, a) => sum + a.balance, 0)

  // Drawdown phase - calculate withdrawal based on strategy
  let withdrawal = calculateInitialWithdrawal(
    balance,
    desiredMonthlyIncome,
    drawdownConfig,
    yearsToRetirement,
    inflationRate,
    // Success rate must measure whether the user reaches their income goal, so the
    // desired income acts as a floor here. See WithdrawalBaseline.
    "desiredIncomeFloor",
  )

  let lifetimeIncomeTax = 0

  for (let year = 0; year < yearsInRetirement; year++) {
    const age = currentAge + yearsToRetirement + year
    if (balance <= 0 && !depletionAge) depletionAge = age

    // From year 1 onward, recompute the base withdrawal per-strategy against the live
    // start-of-year balance — mirrors projection-engine.ts so the deterministic and Monte
    // Carlo engines diverge identically across drawdown strategies.
    if (year > 0) {
      withdrawal = calculateNextWithdrawal(
        withdrawal,
        balance,
        drawdownConfig,
        yearsToRetirement + year,
        inflationRate,
        desiredMonthlyIncome,
      )
    }

    // Each account continues its own stochastic return sequence from accumulation
    const monthlyRates = accountReturns.map((returns) =>
      calculateMonthlyReturn(returns[yearsToRetirement + year], "compound"),
    )
    // Every rand threshold below is indexed to this tax year (see taxThresholdScale)
    const yearsFromNow = yearsToRetirement + year
    const thresholdScale = taxThresholdScale(yearsFromNow, taxIndexation.incomeTax)

    // Annuity income below the age-based threshold is tax-free, so it is drawn first —
    // mirrors projection-engine.ts (which also adds the s11F credit MC does not track)
    const target = withdrawal * getSpendingPhaseMultiplier(year)
    const outcome = runDrawdownYear(
      drawdownPots,
      monthlyRates,
      target,
      taxThresholdForAge(age) * thresholdScale,
    )

    // Same depletion rule as the deterministic engine: the first year the income could
    // not be paid in full. Previously this was detected only at the START of the next
    // year, so Monte Carlo reported every depletion one year later than the projection.
    if (outcome.shortfall && !depletionAge) depletionAge = age

    // Tax is computed for reporting only (it does not force additional portfolio
    // liquidation, matching how the deterministic engine treats tax as a reduction of
    // net spendable income).
    const taxableCapitalGain = Math.max(
      0,
      outcome.capitalGainRealized -
        SA_TAX_LIMITS.cgtAnnualExclusion *
          taxThresholdScale(yearsFromNow, taxIndexation.cgtExclusion),
    )
    const taxableIncome =
      outcome.pensionWithdrawal + taxableCapitalGain * SA_TAX_LIMITS.cgtInclusionRateIndividual
    lifetimeIncomeTax += calculateIndexedIncomeTax(taxableIncome, age, undefined, thresholdScale)

    balance = Math.max(
      0,
      drawdownPots.reduce((sum, a) => sum + a.balance, 0),
    )
    yearlyBalances.push(balance)
  }

  return {
    runId,
    yearlyBalances,
    finalBalance: balance,
    depletionAge,
    // A run succeeds when it paid the full income every year. Under the living annuity
    // 17.5% ceiling a failing run can keep a residual balance, so "balance > 0" no longer
    // identifies success.
    success: depletionAge === null,
    lifetimeIncomeTax,
    lumpSumTax,
  }
}

/**
 * Aggregate results from all simulation runs
 */
function aggregateResults(runs: SimulationRun[], totalYears: number): SimulationResult {
  if (runs.length === 0) {
    return {
      runs: [],
      successRate: 0,
      percentiles: { p10: [], p25: [], p50: [], p75: [], p90: [] },
      medianDepletionAge: null,
      averageFinalBalance: 0,
      averageLifetimeIncomeTax: 0,
      averageLumpSumTax: 0,
    }
  }

  const successCount = runs.filter((r) => r.success).length
  const successRate = (successCount / runs.length) * 100

  // Calculate percentiles for each year
  const percentiles = {
    p10: [] as number[],
    p25: [] as number[],
    p50: [] as number[],
    p75: [] as number[],
    p90: [] as number[],
  }

  for (let year = 0; year < totalYears; year++) {
    const balancesAtYear = runs.map((r) => r.yearlyBalances[year] || 0).sort((a, b) => a - b)

    percentiles.p10.push(getPercentile(balancesAtYear, 10))
    percentiles.p25.push(getPercentile(balancesAtYear, 25))
    percentiles.p50.push(getPercentile(balancesAtYear, 50))
    percentiles.p75.push(getPercentile(balancesAtYear, 75))
    percentiles.p90.push(getPercentile(balancesAtYear, 90))
  }

  const depletionAges = runs
    .map((r) => r.depletionAge)
    .filter((age): age is number => age !== null)
    .sort((a, b) => a - b)

  return {
    runs,
    successRate,
    percentiles,
    medianDepletionAge: depletionAges.length > 0 ? getPercentile(depletionAges, 50) : null,
    averageFinalBalance: runs.reduce((sum, r) => sum + r.finalBalance, 0) / runs.length,
    averageLifetimeIncomeTax:
      runs.reduce((sum, r) => sum + (r.lifetimeIncomeTax ?? 0), 0) / runs.length,
    averageLumpSumTax: runs.reduce((sum, r) => sum + (r.lumpSumTax ?? 0), 0) / runs.length,
  }
}

/**
 * Run Monte Carlo simulation
 */
export function runMonteCarloSimulation(
  accounts: Account[],
  personalInfo: PersonalInfo,
  retirementGoals: RetirementGoals,
  drawdownConfig: DrawdownConfig,
  config: SimulationConfig,
  marketAssumptions?: MarketAssumptions,
): SimulationResult {
  // NaN ages fail `x < 0` comparisons, so a NaN age would poison yearsToRetirement
  // and every downstream division. Route non-finite ages through the empty result
  // rather than degrading to a plausible-looking simulation (Phase 9.1).
  const agesFinite =
    Number.isFinite(personalInfo.currentAge) &&
    Number.isFinite(personalInfo.retirementAge) &&
    Number.isFinite(personalInfo.lifeExpectancy)

  const currentAge = finiteOrZero(personalInfo.currentAge)
  const retirementAge = finiteOrZero(personalInfo.retirementAge)
  const lifeExpectancy = finiteOrZero(personalInfo.lifeExpectancy)

  // Handle empty accounts
  if (accounts.length === 0) {
    return {
      runs: [],
      successRate: 0,
      percentiles: { p10: [], p25: [], p50: [], p75: [], p90: [] },
      medianDepletionAge: retirementAge,
      averageFinalBalance: 0,
    }
  }

  const yearsToRetirement = retirementAge - currentAge
  const yearsInRetirement = lifeExpectancy - retirementAge
  const totalYears = yearsToRetirement + yearsInRetirement
  const inflationRate = finiteOrZero(retirementGoals.inflationRate) / 100

  // Non-finite or inverted ages cannot be simulated meaningfully — return the empty
  // result the same way the empty-accounts path does.
  if (!agesFinite || yearsToRetirement < 0 || yearsInRetirement < 0) {
    return {
      runs: [],
      successRate: 0,
      percentiles: { p10: [], p25: [], p50: [], p75: [], p90: [] },
      medianDepletionAge: retirementAge,
      averageFinalBalance: 0,
    }
  }

  // Volatility for accounts WITHOUT an investment type: market assumptions if provided,
  // otherwise the default. Typed accounts use their type's researched figure.
  const untypedVolatility = marketAssumptions
    ? finiteOrZero(marketAssumptions.equityVolatility) / 100
    : SA_DEFAULTS.equityVolatility
  // Resolved once, from the same sanitised accounts each run uses (a NaN expected return
  // is 0 there, which resolveAccountRisk treats as a cash account — as before).
  // The cautious end of the success range scales every volatility, typed and untyped
  // alike. A non-finite scale means "unscaled"; a negative one is meaningless and clamps
  // to 0 (no volatility at all).
  const volatilityScale = Number.isFinite(config.volatilityScale)
    ? Math.max(0, config.volatilityScale)
    : 1
  const accountRisks = sanitizeAccounts(accounts).map((acc) => {
    const risk = resolveAccountRisk(acc, untypedVolatility)
    return { ...risk, volatility: risk.volatility * volatilityScale }
  })
  // Loadings for the types present, in the fixed INVESTMENT_TYPES order so the generator
  // is consumed reproducibly. Untyped accounts need no entry: they use the market shock.
  const riskLoadings = new Map<string, number>()
  for (const type of INVESTMENT_TYPES) {
    const risk = accountRisks.find((r) => r.investmentType === type)
    if (risk) riskLoadings.set(type, risk.factorLoading)
  }

  // Use compounding method from market assumptions, default to nominal for backward compatibility
  const compoundingMethod = marketAssumptions?.compoundingMethod || "nominal"

  // A seeded source makes the whole simulation reproducible: same seed and inputs =>
  // identical output. Callers that omit randomSeed keep the previous non-deterministic
  // behaviour. Note the SAME generator is threaded through every run, so runs remain
  // independent of one another while the sequence as a whole is reproducible.
  const rng: RandomSource =
    config.randomSeed !== undefined ? createSeededRandom(config.randomSeed) : Math.random

  const runs: SimulationRun[] = []

  for (let runId = 0; runId < config.numberOfRuns; runId++) {
    const run = simulateSingleRun(
      runId,
      accounts,
      accountRisks,
      riskLoadings,
      yearsToRetirement,
      yearsInRetirement,
      inflationRate,
      retirementGoals.desiredMonthlyIncome,
      drawdownConfig,
      personalInfo.currentAge,
      compoundingMethod,
      drawdownConfig.lumpSumPercentage ?? 0,
      // Same tax-relief assumption as projection-engine.ts
      resolveTaxThresholdIndexation(marketAssumptions?.taxThresholdRelief, inflationRate),
      rng,
    )
    runs.push(run)
  }

  return aggregateResults(runs, totalYears)
}
