/**
 * Debug model — the single data structure behind the /calculator/debug page AND its
 * "Copy" export.
 *
 * The old debug dialog hand-built a second copy of every section as a text dump, so the
 * screen and the clipboard could disagree. Here both are rendered from one `DebugModel`.
 *
 * This module owns NO calculation logic. Every derived figure comes from the same shared
 * function the engine calls (`projectFinalSavings`, `calculateInitialWithdrawal`,
 * `resolveAccountRisk`, `taxThresholdScale`, `getSpendingPhaseMultiplier`) or from the
 * engine's own `ProjectionResult`. Tax limits come from `lib/constants` — never literals.
 *
 * State rules (each was a wrong-number bug in the old window):
 *  - No projection yet        -> engine rows read "—", never a computed-looking fallback.
 *  - Depletion age is null    -> "Lasts to age N", and only when a projection exists.
 *  - Optional config of 0     -> rendered as "0", not dropped (`0 && …` renders text "0").
 *  - A genuine 0 from the engine is shown as 0; no `||` fallbacks that swallow it.
 */
import { SA_DEFAULTS, SA_DEFAULTS_DISPLAY } from "@/lib/constants/defaults"
import { INCOME_TAX_BRACKETS_CONFIG, TAX_YEAR } from "@/lib/constants/tax-year.config"
import { SA_TAX_LIMITS } from "@/lib/constants/limits"
import {
  calculateMonthlyReturn,
  formatMonthlyReturnFormula,
  projectFinalSavings,
} from "@/lib/calculations/utils/projection"
import {
  calculateRetirementTax,
  calculateReplacementRatio,
  taxThresholdScale,
} from "@/lib/calculations/retirement-tax"
import { calculateInitialWithdrawal } from "@/lib/calculations/utils/drawdown-withdrawal"
import { resolveAccountRisk } from "@/lib/calculations/utils/account-risk"
import { getSpendingPhaseMultiplier } from "@/lib/calculations/utils/spending-phase"
import {
  DEFAULT_TAX_THRESHOLD_RELIEF,
  resolveTaxThresholdIndexation,
} from "@/lib/calculations/utils/tax-relief"
import {
  escalate,
  escalateToRetirement,
  retirementRands,
  todayRands,
} from "@/lib/calculations/utils/money-time"
import { NO_VALUE, formatCurrency as formatRand } from "@/lib/utils/currency"
import {
  COMPOUNDING_METHOD_DESCRIPTIONS,
  COMPOUNDING_METHOD_LABELS,
  DRAWDOWN_STRATEGY_LABELS,
  TAX_THRESHOLD_RELIEF_LABELS,
} from "@/types"
import type {
  Account,
  DrawdownConfig,
  MarketAssumptions,
  PersonalInfo,
  ProjectionResult,
  RetirementGoals,
  SimulationResult,
} from "@/types"

/** SA: a retirement fund / RA cannot be accessed before this age (Pension Funds Act, ITA). */
export const MIN_RETIREMENT_ACCESS_AGE = 55

export type DebugGroup = "inputs" | "results" | "reference"

export interface DebugRow {
  id: string
  label: string
  /** Pre-formatted for display and for the copy export */
  value: string
  /** True when `value` is a figure (currency, %, age) — drives mono + tabular-nums */
  numeric: boolean
  /** Money basis / unit, e.g. "nominal, at retirement" */
  basis?: string
}

export interface DebugSection {
  id: string
  title: string
  group: DebugGroup
  rows: DebugRow[]
  /** A formula or note shown below the rows */
  footnote?: string
  /** "formula" renders in mono (it is a calculation); "note" is prose */
  footnoteKind?: "formula" | "note"
}

export type CheckStatus = "match" | "mismatch" | "skipped" | "pending"

export interface ReconciliationCheck {
  id: string
  label: string
  /** What the engine / the page shows */
  engine: string
  /** What an independent route to the same number gives */
  independent: string
  delta: string
  status: CheckStatus
  /** The largest |difference| still read as a Match; only set when the figures were compared */
  tolerance?: string
  /** Why a check was skipped, or how the independent route works */
  note: string
}

export interface DebugModel {
  generatedAt: Date
  compounding: { label: string; description: string; formula: string }
  /** True when the store has changed and the projection has not caught up yet */
  recalculating: boolean
  hasProjection: boolean
  checks: ReconciliationCheck[]
  sections: DebugSection[]
}

export interface DebugInput {
  accounts: Account[]
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
  assumptions: MarketAssumptions
  drawdownConfig: DrawdownConfig
  displayMode: "nominal" | "real"
  projection: ProjectionResult | null
  simulationResult: SimulationResult | null
  /** The deferred-value lag in CalculatorContext */
  isDeferred?: boolean
  generatedAt?: Date
}

// ───────────────────────── formatters ─────────────────────────

const money = (v: number) => formatRand(v, { decimals: 2 })
const pct = (decimal: number) => `${(decimal * 100).toFixed(2)}%`
const rawPct = (percent: number) => `${percent}%`

/** Depletion, honestly: "—" until a projection exists; "Lasts to age N" only when it does. */
export function describeDepletion(
  projection: ProjectionResult | null,
  lifeExpectancy: number,
): string {
  if (!projection) return NO_VALUE
  if (projection.portfolioDepletionAge === null) return `Lasts to age ${lifeExpectancy}`
  return `Age ${projection.portfolioDepletionAge}`
}

function row(
  id: string,
  label: string,
  value: string | number,
  opts: { numeric?: boolean; basis?: string } = {},
): DebugRow {
  return {
    id,
    label,
    value: String(value),
    numeric: opts.numeric ?? true,
    basis: opts.basis,
  }
}

// ───────────────────────── reconciliation ─────────────────────────

const MATCH_TOLERANCE_ABS = 0.01
const MATCH_TOLERANCE_REL = 1e-9

function compare(
  id: string,
  label: string,
  engine: number,
  independent: number,
  note: string,
  format: (v: number) => string = money,
): ReconciliationCheck {
  const delta = engine - independent
  const tolerance = Math.max(MATCH_TOLERANCE_ABS, Math.abs(engine) * MATCH_TOLERANCE_REL)
  return {
    id,
    label,
    engine: format(engine),
    independent: format(independent),
    delta: format(delta),
    status: Math.abs(delta) <= tolerance ? "match" : "mismatch",
    tolerance: format(tolerance),
    note,
  }
}

function pending(id: string, label: string, note: string): ReconciliationCheck {
  return {
    id,
    label,
    engine: NO_VALUE,
    independent: NO_VALUE,
    delta: NO_VALUE,
    status: "pending",
    note,
  }
}

function skipped(id: string, label: string, note: string): ReconciliationCheck {
  return {
    id,
    label,
    engine: NO_VALUE,
    independent: NO_VALUE,
    delta: NO_VALUE,
    status: "skipped",
    note,
  }
}

/**
 * True when a TFSA's contributions would hit the annual or lifetime cap before retirement.
 * The engine clips them (`admitTfsaContribution`); a plain future-value sum cannot, so the
 * independent route is not comparable and the check is skipped rather than reported wrong.
 */
export function tfsaLimitsBind(accounts: Account[], yearsToRetirement: number): boolean {
  const tfsas = accounts.filter((a) => a.type === "tfsa")
  if (tfsas.length === 0 || yearsToRetirement <= 0) return false
  let lifetime = tfsas.reduce((s, a) => s + a.currentBalance, 0)
  for (let y = 0; y < yearsToRetirement; y++) {
    const annual = tfsas.reduce(
      (s, a) =>
        s + a.monthlyContribution * 12 * Math.pow(1 + a.contributionEscalation / 100, y + 1),
      0,
    )
    if (annual > SA_TAX_LIMITS.tfsaAnnualLimit) return true
    lifetime += annual
    if (lifetime > SA_TAX_LIMITS.tfsaLifetimeLimit) return true
  }
  return false
}

export function buildReconciliation(input: DebugInput): ReconciliationCheck[] {
  const { accounts, personalInfo, retirementGoals, assumptions, drawdownConfig, projection } = input
  const yearsToRetirement = personalInfo.retirementAge - personalInfo.currentAge
  const compoundingMethod = assumptions.compoundingMethod ?? "nominal"
  const inflationRate = retirementGoals.inflationRate / 100

  const ids = {
    portfolio: "portfolio-at-retirement",
    income: "initial-income",
    net: "net-income",
    split: "lump-sum-split",
  }
  const labels = {
    portfolio: "Portfolio at retirement",
    income: "Initial annual income",
    net: "Year-1 net income",
    split: "Balance after lump sum",
  }

  if (!projection) {
    const why = "Needs a projection — add an account first."
    return [
      pending(ids.portfolio, labels.portfolio, why),
      pending(ids.income, labels.income, why),
      pending(ids.net, labels.net, why),
      pending(ids.split, labels.split, why),
    ]
  }

  const checks: ReconciliationCheck[] = []

  // 1. Accumulation: engine vs Σ projectFinalSavings per account
  if (tfsaLimitsBind(accounts, yearsToRetirement)) {
    checks.push(
      skipped(
        ids.portfolio,
        labels.portfolio,
        "TFSA annual or lifetime limit caps contributions; the engine clips them and a plain future-value sum cannot.",
      ),
    )
  } else {
    const independent = accounts.reduce(
      (sum, a) =>
        sum +
        projectFinalSavings(
          a.currentBalance,
          a.monthlyContribution,
          yearsToRetirement,
          a.contributionEscalation / 100,
          (a.expectedReturn - a.annualFees) / 100,
          compoundingMethod,
        ),
      0,
    )
    checks.push(
      compare(
        ids.portfolio,
        labels.portfolio,
        projection.portfolioAtRetirement,
        independent,
        `Σ projectFinalSavings per account (${compoundingMethod} compounding), nominal.`,
      ),
    )
  }

  // 2. Initial income: engine vs the shared strategy function on the post-lump-sum balance
  const remaining = projection.lumpSumCommutation.remainingPortfolio
  checks.push(
    compare(
      ids.income,
      labels.income,
      projection.monthlyIncomeAtRetirement * 12,
      calculateInitialWithdrawal(
        remaining,
        retirementGoals.desiredMonthlyIncome,
        drawdownConfig,
        yearsToRetirement,
        inflationRate,
        "strategy",
      ),
      "calculateInitialWithdrawal on the balance left after lump-sum commutation, nominal.",
    ),
  )

  // 3. Net income identity on the first drawdown row
  const first = projection.yearlyProjections[yearsToRetirement]
  if (first) {
    checks.push(
      compare(
        ids.net,
        labels.net,
        projection.monthlyNetIncomeAtRetirement * 12,
        first.withdrawals - first.incomeTax - first.medicalAidContribution,
        "Withdrawals − income tax − medical aid, from the first drawdown row, nominal.",
      ),
    )
  } else {
    checks.push(skipped(ids.net, labels.net, "No drawdown year in the projection."))
  }

  // 4. Balance carried into drawdown: Σ per-account balances vs engine remaining portfolio
  const accountSum = Object.values(projection.accountBalancesAtRetirement).reduce(
    (s, v) => s + v,
    0,
  )
  checks.push(
    compare(
      ids.split,
      labels.split,
      remaining,
      accountSum,
      "Σ per-account balances at the start of drawdown vs the engine's remaining portfolio, nominal.",
    ),
  )

  return checks
}

// ───────────────────────── sections ─────────────────────────

export function buildDebugModel(input: DebugInput): DebugModel {
  const {
    accounts,
    personalInfo,
    retirementGoals,
    assumptions,
    drawdownConfig,
    displayMode,
    projection,
    simulationResult,
  } = input

  const compoundingMethod = assumptions.compoundingMethod ?? "nominal"
  const yearsToRetirement = personalInfo.retirementAge - personalInfo.currentAge
  const yearsInRetirement = personalInfo.lifeExpectancy - personalInfo.retirementAge
  const inflationRate = retirementGoals.inflationRate / 100
  const hasProjection = projection !== null

  // Weighted aggregates — mirror projection-engine's weighting rule (balance weights, or
  // contribution weights when the balance is R0)
  const totalBalance = accounts.reduce((s, a) => s + a.currentBalance, 0)
  const totalMonthlyContribution = accounts.reduce((s, a) => s + a.monthlyContribution, 0)
  const weightBy = (pick: (a: Account) => number, empty: number) => {
    if (totalBalance > 0)
      return accounts.reduce((s, a) => s + (pick(a) / 100) * (a.currentBalance / totalBalance), 0)
    if (totalMonthlyContribution > 0)
      return accounts.reduce(
        (s, a) => s + (pick(a) / 100) * (a.monthlyContribution / totalMonthlyContribution),
        0,
      )
    return empty
  }
  const weightedReturn = weightBy((a) => a.expectedReturn, SA_DEFAULTS.equityReturn)
  const weightedFees = weightBy((a) => a.annualFees, 0.01)
  const netReturn = weightedReturn - weightedFees
  const avgEscalation =
    accounts.length > 0
      ? accounts.reduce((s, a) => s + a.contributionEscalation / 100, 0) / accounts.length
      : SA_DEFAULTS.contributionEscalation
  const weightingMethod =
    totalBalance === 0 ? "Contribution weights (balance is R0)" : "Balance weights"
  const monthlyReturn = calculateMonthlyReturn(netReturn, compoundingMethod)
  const monthlyFeeRate = Math.pow(1 + weightedFees, 1 / 12) - 1
  const formula = formatMonthlyReturnFormula(netReturn, compoundingMethod)

  // Retirement-year tax context, indexed exactly as the engine indexes it
  const thresholdScale = taxThresholdScale(
    yearsToRetirement,
    resolveTaxThresholdIndexation(assumptions.taxThresholdRelief, inflationRate).incomeTax,
  )
  const rebate =
    calculateRetirementTax(0, { age: personalInfo.retirementAge }).applicableRebate * thresholdScale
  const baseThreshold =
    personalInfo.retirementAge >= 75
      ? SA_TAX_LIMITS.taxThreshold75Plus
      : personalInfo.retirementAge >= 65
        ? SA_TAX_LIMITS.taxThreshold65To74
        : SA_TAX_LIMITS.taxThresholdUnder65
  const taxThreshold = baseThreshold * thresholdScale

  // Year-1 drawdown, read from the engine's own row — never re-taxed here
  const first = projection?.yearlyProjections[yearsToRetirement]
  const topMarginalRate = INCOME_TAX_BRACKETS_CONFIG[INCOME_TAX_BRACKETS_CONFIG.length - 1].rate

  const annualContribution = totalMonthlyContribution * 12
  const maxDeduction = Math.min(
    annualContribution,
    personalInfo.annualIncome * SA_TAX_LIMITS.pensionRaDeductionRate,
    SA_TAX_LIMITS.pensionRaMaxDeduction,
  )
  const taxSavings = maxDeduction * topMarginalRate

  const volatility = assumptions.equityVolatility

  const sections: DebugSection[] = []

  // ── Inputs ──
  sections.push({
    id: "personal",
    title: "Personal information",
    group: "inputs",
    rows: [
      row("current-age", "Current age", personalInfo.currentAge),
      row("retirement-age", "Retirement age", personalInfo.retirementAge),
      row("life-expectancy", "Life expectancy", personalInfo.lifeExpectancy),
      row("annual-income", "Annual income", money(personalInfo.annualIncome), {
        basis: "today's rands",
      }),
      row("years-to-retirement", "Years to retirement", yearsToRetirement),
      row("years-in-retirement", "Years in retirement", yearsInRetirement),
    ],
    footnote:
      yearsToRetirement < 0
        ? "Retirement age is below current age — accumulation is skipped."
        : undefined,
  })

  sections.push({
    id: "goals",
    title: "Retirement goals",
    group: "inputs",
    rows: [
      row("desired-income", "Desired monthly income", money(retirementGoals.desiredMonthlyIncome), {
        basis: "today's rands",
      }),
      row("inflation", "Inflation", rawPct(retirementGoals.inflationRate)),
      row("legacy", "Legacy amount", money(retirementGoals.legacyAmount), {
        basis: "today's rands",
      }),
    ],
  })

  accounts.forEach((acc, i) => {
    sections.push({
      id: `account-${acc.id}`,
      title: `Account ${i + 1}: ${acc.name} (${acc.type})`,
      group: "inputs",
      rows: [
        row("provider", "Provider", acc.provider, { numeric: false }),
        row("balance", "Balance", money(acc.currentBalance), { basis: "today's rands" }),
        row("contribution", "Monthly contribution", money(acc.monthlyContribution), {
          basis: "today's rands",
        }),
        row("return", "Expected return", rawPct(acc.expectedReturn)),
        row("fees", "Annual fees", rawPct(acc.annualFees)),
        row("escalation", "Contribution escalation", rawPct(acc.contributionEscalation)),
      ],
    })
  })
  if (accounts.length === 0) {
    sections.push({
      id: "accounts-empty",
      title: "Accounts",
      group: "inputs",
      rows: [],
      footnote: "No accounts configured. Add one on the Accounts page to produce a projection.",
    })
  }

  const dc = drawdownConfig
  sections.push({
    id: "drawdown",
    title: "Drawdown configuration",
    group: "inputs",
    rows: [
      row("strategy", "Strategy", DRAWDOWN_STRATEGY_LABELS[dc.strategy], { numeric: false }),
      row("initial-rate", "Initial withdrawal rate", rawPct(dc.initialWithdrawalRate)),
      row("min-withdrawal", "Minimum withdrawal", money(dc.minimumWithdrawal), {
        basis: "monthly",
      }),
      row("max-withdrawal", "Maximum withdrawal", money(dc.maximumWithdrawal), {
        basis: "monthly",
      }),
      row("lump-sum", "Lump sum at retirement", rawPct(dc.lumpSumPercentage)),
      // `!== undefined`, never truthiness: a configured 0 is a value, not an absence
      ...(dc.upperGuardrail !== undefined
        ? [row("upper-guardrail", "Upper guardrail", rawPct(dc.upperGuardrail))]
        : []),
      ...(dc.lowerGuardrail !== undefined
        ? [row("lower-guardrail", "Lower guardrail", rawPct(dc.lowerGuardrail))]
        : []),
      ...(dc.monthlyMedicalAid !== undefined
        ? [
            row("medical-aid", "Medical aid", money(dc.monthlyMedicalAid), {
              basis: "monthly",
            }),
          ]
        : []),
      ...(dc.medicalAidDependants !== undefined
        ? [row("medical-dependants", "Medical aid dependants", dc.medicalAidDependants)]
        : []),
    ],
  })

  const risks = accounts.map((a) => ({
    name: a.name,
    ...resolveAccountRisk(a, volatility / 100),
  }))
  sections.push({
    id: "market",
    title: "Market assumptions",
    group: "inputs",
    rows: [
      row("equity-return", "Equity return", rawPct(assumptions.equityReturn)),
      row("bond-return", "Bond return", rawPct(assumptions.bondReturn)),
      row("cash-return", "Cash return", rawPct(assumptions.cashReturn)),
      row("equity-vol", "Equity volatility", rawPct(assumptions.equityVolatility), {
        basis: "applies to untyped accounts",
      }),
      row("bond-vol", "Bond volatility", rawPct(assumptions.bondVolatility), {
        basis: "not used by the engine",
      }),
      row("assumption-inflation", "Inflation", rawPct(assumptions.inflationRate)),
      ...risks.map((r, i) =>
        row(
          `mc-risk-${i}`,
          `Monte Carlo risk: ${r.name}`,
          `${r.investmentType ?? "untyped"} · ${(r.volatility * 100).toFixed(1)}% vol · ρ ${r.factorLoading}`,
          { numeric: true },
        ),
      ),
    ],
  })

  // ── Results ──
  sections.push({
    id: "aggregates",
    title: "Portfolio aggregates",
    group: "results",
    rows: [
      row("weighting", "Weighting method", weightingMethod, { numeric: false }),
      row("total-balance", "Total balance", money(totalBalance), { basis: "today's rands" }),
      row("total-monthly", "Total monthly contribution", money(totalMonthlyContribution), {
        basis: "today's rands",
      }),
      row("total-annual", "Total annual contribution", money(annualContribution), {
        basis: "today's rands",
      }),
      row("weighted-return", "Weighted return", pct(weightedReturn)),
      row("weighted-fees", "Weighted fees", pct(weightedFees)),
      row("avg-escalation", "Average escalation", pct(avgEscalation)),
      row("net-return", "Net return", pct(netReturn), { basis: "return − fees" }),
      row("monthly-return", "Monthly return rate", pct(monthlyReturn), {
        basis: `${compoundingMethod} compounding`,
      }),
      row("monthly-fee", "Monthly fee rate", pct(monthlyFeeRate)),
    ],
    footnote: formula,
    footnoteKind: "formula",
  })

  const engine = (v: number | undefined, fmt: (n: number) => string) =>
    v === undefined ? NO_VALUE : fmt(v)

  const initialAnnual = projection ? projection.monthlyIncomeAtRetirement * 12 : undefined
  sections.push({
    id: "withdrawal",
    title: "Withdrawal at retirement",
    group: "results",
    rows: [
      row(
        "desired-at-retirement",
        "Desired monthly income",
        money(escalate(retirementGoals.desiredMonthlyIncome, yearsToRetirement, inflationRate)),
        { basis: "nominal, at retirement" },
      ),
      row(
        "portfolio-at-retirement",
        "Portfolio at retirement",
        engine(projection?.portfolioAtRetirement, money),
        {
          basis: "nominal",
        },
      ),
      row("initial-annual", "Initial withdrawal, annual", engine(initialAnnual, money), {
        basis: "nominal, gross",
      }),
      row(
        "initial-monthly",
        "Initial withdrawal, monthly",
        engine(projection?.monthlyIncomeAtRetirement, money),
        { basis: "nominal, gross" },
      ),
      row(
        "depletion",
        "Portfolio depletion",
        describeDepletion(projection, personalInfo.lifeExpectancy),
        {
          basis: "age",
        },
      ),
      row(
        "replacement-ratio",
        "Replacement ratio",
        initialAnnual === undefined
          ? NO_VALUE
          : `${calculateReplacementRatio(
              retirementRands(initialAnnual),
              escalateToRetirement(
                todayRands(personalInfo.annualIncome),
                yearsToRetirement,
                inflationRate,
              ),
            ).toFixed(1)}%`,
        { basis: "gross income ÷ salary escalated to retirement" },
      ),
      row("surplus", "Surplus at life expectancy", engine(projection?.surplusAmount, money), {
        basis: "nominal",
      }),
      row("shortfall", "Shortfall", engine(projection?.shortfallAmount, money), {
        basis: "nominal",
      }),
      row(
        "projection-years",
        "Projection years",
        projection ? projection.yearlyProjections.length : NO_VALUE,
      ),
    ],
  })

  const firstWithdrawals = first?.withdrawals
  const firstYearRate =
    first && first.withdrawals > 0 ? (first.incomeTax / first.withdrawals) * 100 : undefined
  sections.push({
    id: "tax",
    title: "Tax in retirement",
    group: "results",
    rows: [
      row("y1-taxable", "Year-1 taxable income", engine(first?.taxableIncome, money), {
        basis: "nominal",
      }),
      row("y1-credit", "Year-1 s11F credit applied", engine(first?.excessCreditApplied, money), {
        basis: "nominal",
      }),
      row("y1-tax", "Year-1 income tax", engine(first?.incomeTax, money), { basis: "nominal" }),
      row(
        "y1-rate",
        "Year-1 effective rate",
        firstYearRate === undefined
          ? firstWithdrawals === 0
            ? "0.00%"
            : NO_VALUE
          : `${firstYearRate.toFixed(2)}%`,
      ),
      row(
        "avg-rate",
        "Average effective rate",
        engine(projection?.averageEffectiveTaxRate, (n) => `${n.toFixed(2)}%`),
        { basis: "lifetime" },
      ),
      row(
        "lifetime-tax",
        "Lifetime income tax",
        engine(projection?.totalLifetimeIncomeTax, money),
        {
          basis: "nominal",
        },
      ),
      row("rebate", "Age-based rebate", money(rebate), { basis: "indexed to retirement year" }),
      row("threshold", "Tax-free threshold", money(taxThreshold), {
        basis: "indexed to retirement year",
      }),
      row(
        "below-threshold",
        "Year-1 income below threshold",
        first?.taxableIncome === undefined
          ? NO_VALUE
          : first.taxableIncome <= taxThreshold
            ? "Yes"
            : "No",
        { numeric: false },
      ),
      row(
        "y1-net-monthly",
        "Year-1 net income, monthly",
        engine(first ? first.netIncome / 12 : undefined, money),
        {
          basis: "nominal, after tax and medical aid",
        },
      ),
    ],
  })

  sections.push({
    id: "contribution-tax",
    title: `Contribution tax relief (${TAX_YEAR})`,
    group: "results",
    rows: [
      row("annual-contribution", "Annual contribution", money(annualContribution)),
      row("max-deduction", "Maximum deduction", money(maxDeduction), {
        basis: `lesser of contribution, ${pct(SA_TAX_LIMITS.pensionRaDeductionRate)} of income, ${money(SA_TAX_LIMITS.pensionRaMaxDeduction)}`,
      }),
      row("tax-savings", "Estimated tax saving", money(taxSavings), {
        basis: `at the top marginal rate, ${pct(topMarginalRate)}`,
      }),
      row("net-cost", "Cost after tax", money(annualContribution - taxSavings)),
      row(
        "can-access-ra",
        "Can access RA",
        personalInfo.currentAge >= MIN_RETIREMENT_ACCESS_AGE ? "Yes" : "No",
        { numeric: false, basis: `from age ${MIN_RETIREMENT_ACCESS_AGE}` },
      ),
    ],
  })

  sections.push({
    id: "monte-carlo",
    title: "Monte Carlo",
    group: "results",
    rows: simulationResult
      ? [
          row("mc-success", "Success rate", `${simulationResult.successRate.toFixed(2)}%`),
          row("mc-runs", "Runs", simulationResult.runs.length.toLocaleString("en-ZA")),
          row(
            "mc-median-depletion",
            "Median depletion age",
            simulationResult.medianDepletionAge === null
              ? "Most runs do not deplete"
              : `Age ${simulationResult.medianDepletionAge}`,
            { numeric: simulationResult.medianDepletionAge !== null },
          ),
          row(
            "mc-avg-final",
            "Average final balance",
            money(simulationResult.averageFinalBalance),
            { basis: "nominal" },
          ),
          ...(["p10", "p25", "p50", "p75", "p90"] as const).map((p) => {
            const series = simulationResult.percentiles[p]
            const last = series[series.length - 1]
            return row(
              `mc-${p}`,
              `${p.toUpperCase()} final balance`,
              last === undefined ? NO_VALUE : money(last),
              { basis: "nominal" },
            )
          }),
          row("mc-volatility", "Volatility, untyped accounts", rawPct(volatility)),
        ]
      : [],
    footnote: simulationResult
      ? undefined
      : "Not run here. Monte Carlo only runs on the Risk page; open it to populate these figures.",
  })

  // ── Reference ──
  sections.push({
    id: "phases",
    title: "Spending phases",
    group: "reference",
    rows: [
      row("phase-go", "Go-go, years 0–15", `×${getSpendingPhaseMultiplier(0).toFixed(2)}`),
      row("phase-slow", "Slow-go, years 16–25", `×${getSpendingPhaseMultiplier(16).toFixed(2)}`),
      row("phase-no", "No-go, year 26", `×${getSpendingPhaseMultiplier(26).toFixed(3)}`, {
        basis: "70% + medical premium, capped at 120%",
      }),
    ],
  })

  sections.push({
    id: "defaults",
    title: "SA default constants",
    group: "reference",
    rows: [
      row("def-inflation", "Inflation", rawPct(SA_DEFAULTS_DISPLAY.inflation)),
      row(
        "def-medical-inflation",
        "Medical inflation",
        rawPct(SA_DEFAULTS_DISPLAY.medicalInflation),
      ),
      row("def-equity", "Equity return", rawPct(SA_DEFAULTS_DISPLAY.equityReturn)),
      row("def-bond", "Bond return", rawPct(SA_DEFAULTS_DISPLAY.bondReturn)),
      row("def-cash", "Cash return", rawPct(SA_DEFAULTS_DISPLAY.cashReturn)),
      row("def-vol", "Equity volatility", rawPct(SA_DEFAULTS_DISPLAY.equityVolatility)),
      row("def-swr", "Safe withdrawal rate", rawPct(SA_DEFAULTS_DISPLAY.safeWithdrawalRate)),
      row("def-medical-cost", "Base medical cost", money(SA_DEFAULTS.baseMedicalCostMonthly), {
        basis: "monthly",
      }),
    ],
  })

  sections.push({
    id: "method",
    title: "Method",
    group: "reference",
    rows: [
      row("compounding", "Compounding method", COMPOUNDING_METHOD_LABELS[compoundingMethod], {
        numeric: false,
        basis: COMPOUNDING_METHOD_DESCRIPTIONS[compoundingMethod],
      }),
      row("tax-year", "Tax year", TAX_YEAR, { numeric: false }),
      row(
        "relief",
        "Future tax relief",
        TAX_THRESHOLD_RELIEF_LABELS[assumptions.taxThresholdRelief ?? DEFAULT_TAX_THRESHOLD_RELIEF],
        { numeric: false },
      ),
      row(
        "display-mode",
        "Other pages display",
        displayMode === "real" ? "Today's rands (real)" : "Future rands (nominal)",
        { numeric: false },
      ),
    ],
    footnote:
      "Every projection comes from lib/calculations/projection-engine.ts, accumulating through projectFinalSavings. Weighted metrics use contribution weights when the balance is R0. Monte Carlo draws log-normal returns with per-account volatility.",
  })

  return {
    generatedAt: input.generatedAt ?? new Date(),
    compounding: {
      label: COMPOUNDING_METHOD_LABELS[compoundingMethod],
      description: COMPOUNDING_METHOD_DESCRIPTIONS[compoundingMethod],
      formula,
    },
    recalculating: input.isDeferred === true,
    hasProjection,
    checks: buildReconciliation(input),
    sections,
  }
}

// ───────────────────────── search ─────────────────────────

/** Keep sections/rows matching `query` (case-insensitive, on section title, label, value). */
export function filterSections(sections: DebugSection[], query: string): DebugSection[] {
  const q = query.trim().toLowerCase()
  if (q === "") return sections
  return sections.flatMap((section) => {
    if (section.title.toLowerCase().includes(q)) return [section]
    const rows = section.rows.filter(
      (r) => r.label.toLowerCase().includes(q) || r.value.toLowerCase().includes(q),
    )
    return rows.length > 0 ? [{ ...section, rows }] : []
  })
}

/** Keep checks matching `query` (case-insensitive, on label, note, figures or status text). */
export function filterChecks(checks: ReconciliationCheck[], query: string): ReconciliationCheck[] {
  const q = query.trim().toLowerCase()
  if (q === "") return checks
  return checks.filter((c) =>
    [c.label, c.note, c.engine, c.independent, STATUS_LABEL[c.status]].some((t) =>
      t.toLowerCase().includes(q),
    ),
  )
}

// ───────────────────────── copy export ─────────────────────────

/** How a status reads on the page; searchable so "mismatch" finds the failing rows. */
const STATUS_LABEL: Record<CheckStatus, string> = {
  match: "Match",
  mismatch: "Mismatch",
  skipped: "Not comparable",
  pending: "Pending",
}

const STATUS_TEXT: Record<CheckStatus, string> = {
  match: "OK",
  mismatch: "MISMATCH",
  skipped: "SKIPPED",
  pending: "PENDING",
}

/** Plain-text export, generated from the same model the page renders. */
/** One check as a line of plain text, for the whole-page export and the per-check copy button. */
export function checkToText(c: ReconciliationCheck): string {
  if (c.status === "skipped" || c.status === "pending") {
    return `[${STATUS_TEXT[c.status]}] ${c.label}: ${c.note}`
  }
  const tol = c.status === "mismatch" && c.tolerance ? ` | tolerance ${c.tolerance}` : ""
  return `[${STATUS_TEXT[c.status]}] ${c.label}: engine ${c.engine} | independent ${c.independent} | delta ${c.delta}${tol}`
}

export type VerdictTone = "match" | "mismatch" | "partial" | "pending"

export interface CheckVerdict {
  tone: VerdictTone
  headline: string
  /** What was left out of the count, when something was */
  detail?: string
}

/**
 * The page's answer to "does everything match?". Only checks that were actually compared
 * (Match or Mismatch) count; skipped and pending checks are never folded into a green.
 */
export function summarizeChecks(checks: ReconciliationCheck[]): CheckVerdict {
  const matches = checks.filter((c) => c.status === "match").length
  const mismatches = checks.filter((c) => c.status === "mismatch").length
  const notCompared = checks.length - matches - mismatches
  const detail = notCompared > 0 ? `${notCompared} not compared` : undefined
  if (mismatches > 0) {
    return {
      tone: "mismatch",
      headline: `${mismatches} of ${checks.length} checks disagree`,
      detail,
    }
  }
  if (matches === 0) return { tone: "pending", headline: "No checks compared yet", detail }
  if (notCompared > 0) {
    return { tone: "partial", headline: `${matches} of ${checks.length} checks match`, detail }
  }
  return { tone: "match", headline: `All ${checks.length} checks match` }
}

export function toDebugText(model: DebugModel): string {
  const lines: string[] = [
    "SA FINANCIAL PLANNER: DEBUG",
    `Generated: ${model.generatedAt.toISOString()}`,
    `Compounding: ${model.compounding.label}`,
    `Monthly return formula: ${model.compounding.formula}`,
    ...(model.recalculating ? ["Note: values may be stale; the projection is recalculating."] : []),
    "",
    "RECONCILIATION",
    ...model.checks.map(checkToText),
  ]
  for (const section of model.sections) {
    lines.push("", section.title.toUpperCase())
    for (const r of section.rows) {
      lines.push(`${r.label}: ${r.value}${r.basis ? ` (${r.basis})` : ""}`)
    }
    if (section.footnote) lines.push(section.footnote)
  }
  return lines.join("\n")
}
