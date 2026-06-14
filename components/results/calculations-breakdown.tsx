"use client"

import { PageCard } from "@/components/ui/page-card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { useShallow } from "zustand/react/shallow"
import { SA_DEFAULTS } from "@/lib/constants/defaults"
import { SA_TAX_LIMITS } from "@/lib/constants/limits"
import { getSpendingPhaseMultiplier } from "@/lib/calculations/utils/spending-phase"
import { calculateMonthlyReturn, formatMonthlyReturnFormula } from "@/lib/calculations/utils/projection"
import { calculateRAOptimization } from "@/lib/calculations/utils/ra-optimization"
import { formatCurrency } from "@/lib/utils/currency"
import type { ProjectionResult } from "@/types"

function formatPercent(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`
}

function getSpendingPhaseName(yearsInRetirement: number): string {
  if (yearsInRetirement <= 15) return "Go-Go"
  if (yearsInRetirement <= 25) return "Slow-Go"
  return "No-Go"
}

interface CalculationsBreakdownProps {
  projection: ProjectionResult | null
}

export function CalculationsBreakdown({ projection }: CalculationsBreakdownProps) {
  const { accounts, personalInfo, retirementGoals, assumptions, drawdownConfig, displayMode } =
    useCalculatorStore(
      useShallow(state => ({
        accounts: state.accounts,
        personalInfo: state.personalInfo,
        retirementGoals: state.retirementGoals,
        assumptions: state.assumptions,
        drawdownConfig: state.drawdownConfig,
        displayMode: state.displayMode,
      }))
    )

  const inflationRate = retirementGoals.inflationRate / 100
  const yearsToRetirement = personalInfo.retirementAge - personalInfo.currentAge
  // Display-mode-aware currency formatter: yearsFromNow=0 for today's values, yearsToRetirement for retirement values
  const fmt = (value: number, yearsFromNow: number = 0) =>
    formatCurrency(value, displayMode, yearsFromNow, inflationRate)

  const calculations = (() => {
    if (!projection || accounts.length === 0) return null

    // Aggregate account data (for Input Summary display)
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.currentBalance, 0)
    const totalMonthlyContribution = accounts.reduce(
      (sum, acc) => sum + acc.monthlyContribution,
      0
    )
    const totalAnnualContribution = totalMonthlyContribution * 12

    const weightedReturn =
      totalBalance > 0
        ? accounts.reduce(
            (sum, acc) =>
              sum + (acc.expectedReturn / 100) * (acc.currentBalance / totalBalance),
            0
          )
        : SA_DEFAULTS.equityReturn

    const weightedFees =
      totalBalance > 0
        ? accounts.reduce(
            (sum, acc) =>
              sum + (acc.annualFees / 100) * (acc.currentBalance / totalBalance),
            0
          )
        : 0.01

    const avgEscalation =
      accounts.reduce((sum, acc) => sum + acc.contributionEscalation / 100, 0) /
      accounts.length

    const netReturn = weightedReturn - weightedFees
    const yearsInRetirement = personalInfo.lifeExpectancy - personalInfo.retirementAge
    const monthlyReturn = calculateMonthlyReturn(netReturn, assumptions.compoundingMethod)
    const desiredMonthlyAtRetirement =
      retirementGoals.desiredMonthlyIncome *
      Math.pow(1 + inflationRate, yearsToRetirement)

    // Tax rebates based on retirement age
    let applicableRebate: number = SA_TAX_LIMITS.primaryRebate
    let taxThreshold: number = SA_TAX_LIMITS.taxThresholdUnder65
    if (personalInfo.retirementAge >= 75) {
      applicableRebate =
        SA_TAX_LIMITS.primaryRebate +
        SA_TAX_LIMITS.secondaryRebate +
        SA_TAX_LIMITS.tertiaryRebate
      taxThreshold = SA_TAX_LIMITS.taxThreshold75Plus
    } else if (personalInfo.retirementAge >= 65) {
      applicableRebate = SA_TAX_LIMITS.primaryRebate + SA_TAX_LIMITS.secondaryRebate
      taxThreshold = SA_TAX_LIMITS.taxThreshold65To74
    }

    const firstRetirementYear =
      projection.yearlyProjections.find(
        (p) => p.age === personalInfo.retirementAge
      ) ?? null

    return {
      // Aggregate inputs
      totalBalance,
      totalMonthlyContribution,
      totalAnnualContribution,
      weightedReturn,
      weightedFees,
      netReturn,
      avgEscalation,
      inflationRate,
      monthlyReturn,
      yearsToRetirement,
      yearsInRetirement,
      volatility: assumptions.equityVolatility,
      desiredMonthlyAtRetirement,

      // Tax info
      firstRetirementYear,
      applicableRebate,
      taxThreshold,

      // Formula strings
      formulas: {
        monthlyReturn: formatMonthlyReturnFormula(netReturn, assumptions.compoundingMethod),
        futureExpenses: `${fmt(retirementGoals.desiredMonthlyIncome)} × (1 + ${formatPercent(inflationRate * 100)})^${yearsToRetirement} = ${fmt(desiredMonthlyAtRetirement, yearsToRetirement)}`,
        targetNestEgg: `${fmt(desiredMonthlyAtRetirement * 12, yearsToRetirement)} ÷ ${formatPercent(drawdownConfig.initialWithdrawalRate)} = ${fmt((desiredMonthlyAtRetirement * 12) / (drawdownConfig.initialWithdrawalRate / 100), yearsToRetirement)}`,
      },
    }
  })()

  if (!calculations || !projection) {
    return <PageCard label="Calculations Breakdown" description="Add accounts to see detailed calculations" />
  }

  return (
    <div className="space-y-4">
      <PageCard label="Calculations Breakdown" description="Detailed view of all calculations and formulas used" />

      <Accordion type="multiple" defaultValue={["inputs", "formulas"]} className="space-y-2">
        {/* Input Summary */}
        <AccordionItem value="inputs" className="border rounded-lg px-4">
          <AccordionTrigger className="text-base font-semibold">
            1. Input Summary
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">
                  Account Totals
                </h4>
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell>Current Balance</TableCell>
                      <TableCell className="text-right font-mono">
                        {fmt(calculations.totalBalance)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Monthly Contributions</TableCell>
                      <TableCell className="text-right font-mono">
                        {fmt(calculations.totalMonthlyContribution)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Annual Contributions</TableCell>
                      <TableCell className="text-right font-mono">
                        {fmt(calculations.totalAnnualContribution)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Weighted Return</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatPercent(calculations.weightedReturn * 100)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Weighted Fees</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatPercent(calculations.weightedFees * 100)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Net Return</TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatPercent(calculations.netReturn * 100)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Contribution Escalation</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatPercent(calculations.avgEscalation * 100)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">
                  Time & Goals
                </h4>
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell>Current Age</TableCell>
                      <TableCell className="text-right font-mono">
                        {personalInfo.currentAge}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Retirement Age</TableCell>
                      <TableCell className="text-right font-mono">
                        {personalInfo.retirementAge}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Years to Retirement</TableCell>
                      <TableCell className="text-right font-mono">
                        {calculations.yearsToRetirement}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Life Expectancy</TableCell>
                      <TableCell className="text-right font-mono">
                        {personalInfo.lifeExpectancy}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Years in Retirement</TableCell>
                      <TableCell className="text-right font-mono">
                        {calculations.yearsInRetirement}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Inflation Rate</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatPercent(calculations.inflationRate * 100)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Desired Income (today)</TableCell>
                      <TableCell className="text-right font-mono">
                        {fmt(retirementGoals.desiredMonthlyIncome)}/mo
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Withdrawal Rate</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatPercent(drawdownConfig.initialWithdrawalRate)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Key Formulas */}
        <AccordionItem value="formulas" className="border rounded-lg px-4">
          <AccordionTrigger className="text-base font-semibold">
            2. Key Formulas
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium">Monthly Return (from annual):</p>
                  <code className="text-sm bg-background px-2 py-1 rounded block mt-1">
                    {calculations.formulas.monthlyReturn}
                  </code>
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Desired Income at Retirement (inflated):
                  </p>
                  <code className="text-sm bg-background px-2 py-1 rounded block mt-1">
                    {calculations.formulas.futureExpenses}
                  </code>
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Target Nest Egg (using {formatPercent(drawdownConfig.initialWithdrawalRate)} withdrawal):
                  </p>
                  <code className="text-sm bg-background px-2 py-1 rounded block mt-1">
                    {calculations.formulas.targetNestEgg}
                  </code>
                </div>
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <h4 className="font-medium">Accumulation Phase (Monthly Compounding)</h4>
                <p className="text-sm text-muted-foreground">
                  For each month: Balance = (Balance + Contribution) × (1 + Monthly Return)
                </p>
                <p className="text-sm text-muted-foreground">
                  Contributions grow by {formatPercent(calculations.avgEscalation * 100)} annually (smoothed monthly)
                </p>
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <h4 className="font-medium">Drawdown Phase (Return Before Withdraw)</h4>
                <p className="text-sm text-muted-foreground">
                  1. Apply investment return on full balance
                </p>
                <p className="text-sm text-muted-foreground">
                  2. Apply spending phase multiplier (Go-Go/Slow-Go/No-Go)
                </p>
                <p className="text-sm text-muted-foreground">
                  3. Withdraw adjusted amount
                </p>
                <p className="text-sm text-muted-foreground">
                  4. Inflate withdrawal for next year
                </p>
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <h4 className="font-medium">Spending Phases</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phase</TableHead>
                      <TableHead>Years</TableHead>
                      <TableHead>Multiplier</TableHead>
                      <TableHead>Rationale</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Go-Go</TableCell>
                      <TableCell>0-15</TableCell>
                      <TableCell>100%</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        Active retirement, travel, hobbies
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Slow-Go</TableCell>
                      <TableCell>15-25</TableCell>
                      <TableCell>80%</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        Reduced activity, less travel
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>No-Go</TableCell>
                      <TableCell>25+</TableCell>
                      <TableCell>70-120%</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        Lower base + increasing medical costs
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Accumulation Projections */}
        <AccordionItem value="accumulation" className="border rounded-lg px-4">
          <AccordionTrigger className="text-base font-semibold">
            3. Accumulation Phase ({calculations.yearsToRetirement} years)
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <div className="rounded-lg bg-primary/5 p-4">
                <p className="text-lg font-semibold text-primary">
                  Portfolio at Retirement:{" "}
                  {fmt(projection.portfolioAtRetirement, yearsToRetirement)}
                  {displayMode === 'real' && <span className="text-sm font-normal ml-1 text-muted-foreground">(today&apos;s value)</span>}
                </p>
              </div>

              <div className="max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Year</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead className="text-right">Start Balance</TableHead>
                      <TableHead className="text-right">Contributions</TableHead>
                      <TableHead className="text-right">Growth</TableHead>
                      <TableHead className="text-right">End Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projection.yearlyProjections
                      .filter((p) => p.age < personalInfo.retirementAge)
                      .map((proj) => (
                        <TableRow key={proj.year}>
                          <TableCell>{proj.year}</TableCell>
                          <TableCell>{proj.age}</TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {fmt(proj.startingBalance, proj.age - personalInfo.currentAge)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-blue-600 dark:text-blue-400">
                            +{fmt(proj.contributions, proj.age - personalInfo.currentAge)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-green-600 dark:text-green-400">
                            +{fmt(proj.growth, proj.age - personalInfo.currentAge)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-medium">
                            {fmt(proj.endingBalance, proj.age - personalInfo.currentAge)}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Drawdown Projections */}
        <AccordionItem value="drawdown" className="border rounded-lg px-4">
          <AccordionTrigger className="text-base font-semibold">
            4. Drawdown Phase ({calculations.yearsInRetirement} years planned)
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg bg-secondary/60 p-4">
                  <p className="text-sm text-muted-foreground">
                    Initial Monthly Withdrawal
                  </p>
                  <p className="text-lg font-semibold text-foreground font-mono">
                    {fmt(projection.monthlyIncomeAtRetirement, yearsToRetirement)}/month
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    (Inflated from {fmt(retirementGoals.desiredMonthlyIncome)})
                  </p>
                </div>
                <div
                  className={`rounded-lg p-4 ${
                    projection.portfolioDepletionAge
                      ? "bg-destructive/10"
                      : "bg-primary/5"
                  }`}
                >
                  <p className="text-sm text-muted-foreground">Portfolio Depletion</p>
                  <p
                    className={`text-lg font-semibold ${
                      projection.portfolioDepletionAge
                        ? "text-destructive"
                        : "text-primary"
                    }`}
                  >
                    {projection.portfolioDepletionAge
                      ? `Age ${projection.portfolioDepletionAge}`
                      : `Lasts beyond age ${personalInfo.lifeExpectancy}`}
                  </p>
                </div>
              </div>

              <div className="max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Yr</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead className="text-right">Start</TableHead>
                      <TableHead className="text-right">Growth</TableHead>
                      <TableHead>Phase</TableHead>
                      <TableHead className="text-right text-green-700 dark:text-green-400">TFSA</TableHead>
                      <TableHead className="text-right text-blue-700 dark:text-blue-400">Discret.</TableHead>
                      <TableHead className="text-right text-orange-700 dark:text-orange-400">Pension</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                      <TableHead className="text-right">End</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projection.yearlyProjections
                      .filter((p) => p.age >= personalInfo.retirementAge)
                      .map((proj, idx) => {
                        const yearsIn = proj.age - personalInfo.retirementAge
                        const phaseName = getSpendingPhaseName(yearsIn)
                        const phaseMultiplier = getSpendingPhaseMultiplier(yearsIn)
                        return (
                          <TableRow
                            key={proj.year}
                            className={proj.endingBalance <= 0 ? "bg-red-50 dark:bg-red-950" : ""}
                          >
                            <TableCell>{idx + 1}</TableCell>
                            <TableCell>{proj.age}</TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {fmt(proj.startingBalance, proj.age - personalInfo.currentAge)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-green-600 dark:text-green-400">
                              +{fmt(proj.growth, proj.age - personalInfo.currentAge)}
                            </TableCell>
                            <TableCell>
                              <span className="text-xs">
                                {phaseName} ({formatPercent(phaseMultiplier * 100, 0)})
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-green-700 dark:text-green-400">
                              {proj.tfsaWithdrawal ? fmt(proj.tfsaWithdrawal, proj.age - personalInfo.currentAge) : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-blue-700 dark:text-blue-400">
                              {proj.discretionaryWithdrawal ? fmt(proj.discretionaryWithdrawal, proj.age - personalInfo.currentAge) : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-orange-700 dark:text-orange-400">
                              {proj.pensionWithdrawal ? fmt(proj.pensionWithdrawal, proj.age - personalInfo.currentAge) : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-destructive">
                              {proj.incomeTax > 0 ? `-${fmt(proj.incomeTax, proj.age - personalInfo.currentAge)}` : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm font-medium">
                              {fmt(proj.endingBalance, proj.age - personalInfo.currentAge)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                TFSA (tax-free) → Discretionary (CGT only) → Pension/RA (full income tax)
              </p>

              {/* Account Depletion Timeline */}
              {(() => {
                const drawdownRows = projection.yearlyProjections.filter(
                  p => p.age >= personalInfo.retirementAge && p.accountBalances
                )
                if (drawdownRows.length === 0 || accounts.length === 0) return null

                const accountInfos = accounts.map(acc => {
                  const startBal = projection.accountBalancesAtRetirement[acc.id] ?? 0
                  if (startBal <= 0) return null

                  // Find first year balance hits zero
                  const depletionRow = drawdownRows.find(
                    p => (p.accountBalances?.[acc.id] ?? 0) <= 0
                  )
                  const depletionAge = depletionRow?.age ?? null

                  // Balance at life expectancy (last row)
                  const lastRow = drawdownRows[drawdownRows.length - 1]
                  const finalBal = lastRow?.accountBalances?.[acc.id] ?? 0

                  return { acc, startBal, depletionAge, finalBal }
                }).filter(Boolean) as {
                  acc: typeof accounts[0]
                  startBal: number
                  depletionAge: number | null
                  finalBal: number
                }[]

                if (accountInfos.length === 0) return null

                const typeColor: Record<string, string> = {
                  tfsa: "text-green-700 dark:text-green-400",
                  discretionary: "text-blue-700 dark:text-blue-400",
                  pension_fund: "text-orange-700 dark:text-orange-400",
                  retirement_annuity: "text-orange-700 dark:text-orange-400",
                  preservation_fund: "text-orange-700 dark:text-orange-400",
                }
                const typeBg: Record<string, string> = {
                  tfsa: "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800",
                  discretionary: "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800",
                  pension_fund: "bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800",
                  retirement_annuity: "bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800",
                  preservation_fund: "bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800",
                }
                const typeLabel: Record<string, string> = {
                  tfsa: "TFSA",
                  discretionary: "Discretionary",
                  pension_fund: "Pension Fund",
                  retirement_annuity: "Retirement Annuity",
                  preservation_fund: "Preservation Fund",
                }

                const totalYears = personalInfo.lifeExpectancy - personalInfo.retirementAge

                return (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Account Depletion Timeline</h4>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {accountInfos.map(({ acc, startBal, depletionAge, finalBal }) => {
                        const depletes = depletionAge !== null
                        const yearsActive = depletes
                          ? depletionAge - personalInfo.retirementAge
                          : totalYears
                        const pct = Math.min(100, Math.round((yearsActive / totalYears) * 100))

                        return (
                          <div
                            key={acc.id}
                            className={`rounded-lg border p-3 space-y-2 ${typeBg[acc.type] ?? "bg-muted border-border"}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium leading-tight">{acc.name}</p>
                                <p className={`text-xs ${typeColor[acc.type] ?? "text-muted-foreground"}`}>
                                  {typeLabel[acc.type] ?? acc.type}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                {depletes ? (
                                  <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                                    Depletes age {depletionAge}
                                  </p>
                                ) : (
                                  <p className="text-xs font-semibold text-green-700 dark:text-green-400">
                                    Lasts to age {personalInfo.lifeExpectancy}+
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Start: {fmt(startBal, yearsToRetirement)}</span>
                                <span>End: {depletes ? "—" : fmt(finalBal, personalInfo.lifeExpectancy - personalInfo.currentAge)}</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-background/60 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    depletes
                                      ? "bg-red-400 dark:bg-red-600"
                                      : "bg-green-500 dark:bg-green-600"
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {depletes
                                  ? `${yearsActive} of ${totalYears} retirement years`
                                  : `Full ${totalYears} retirement years`}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Monte Carlo Info */}
        <AccordionItem value="montecarlo" className="border rounded-lg px-4">
          <AccordionTrigger className="text-base font-semibold">
            5. Monte Carlo Simulation
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <div className="rounded-lg border p-4 space-y-2">
                <h4 className="font-medium">How It Works</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Run 1,000 simulations with random returns</li>
                  <li>Each year&apos;s return is drawn from a log-normal distribution</li>
                  <li>Track how many simulations don&apos;t run out of money</li>
                  <li>Success rate = successful runs ÷ total runs × 100</li>
                </ol>
              </div>

              <div className="rounded-lg bg-muted p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium">Log-Normal Return Formula:</p>
                  <code className="text-sm bg-background px-2 py-1 rounded block mt-1">
                    logMean = ln(1 + return) - 0.5 × volatility²
                  </code>
                  <code className="text-sm bg-background px-2 py-1 rounded block mt-1">
                    randomReturn = e^(logMean + volatility × Z) - 1
                  </code>
                  <p className="text-xs text-muted-foreground mt-1">
                    where Z is a standard normal random variable (Box-Muller transform)
                  </p>
                </div>
              </div>

              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell>Expected Return (net of fees)</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatPercent(calculations.netReturn * 100)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Volatility (Std Dev)</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatPercent(calculations.volatility)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Number of Simulations</TableCell>
                    <TableCell className="text-right font-mono">1,000</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Retirement Tax Analysis */}
        <AccordionItem value="tax-analysis" className="border rounded-lg px-4">
          <AccordionTrigger className="text-base font-semibold">
            6. Retirement Tax Analysis
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              {/* Lump Sum Commutation */}
              {projection.lumpSumCommutation.lumpSumPercentage > 0 ? (
                <div className="rounded-lg bg-warning/10 p-4">
                  <h4 className="font-medium text-warning mb-3">
                    Lump Sum Commutation at Retirement ({projection.lumpSumCommutation.lumpSumPercentage}%)
                  </h4>
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell>Gross Lump Sum</TableCell>
                        <TableCell className="text-right font-mono">
                          {fmt(projection.lumpSumCommutation.lumpSumAmount, yearsToRetirement)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Lump Sum Tax</TableCell>
                        <TableCell className="text-right font-mono text-red-600 dark:text-red-400">
                          -{fmt(projection.lumpSumCommutation.lumpSumTax, yearsToRetirement)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Net Lump Sum Received</TableCell>
                        <TableCell className="text-right font-mono font-medium text-green-600 dark:text-green-400">
                          {fmt(projection.lumpSumCommutation.netLumpSum, yearsToRetirement)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Remaining Portfolio (for annuity)</TableCell>
                        <TableCell className="text-right font-mono">
                          {fmt(projection.lumpSumCommutation.remainingPortfolio, yearsToRetirement)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-sm text-muted-foreground">Effective Lump Sum Tax Rate</TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">
                          {projection.lumpSumCommutation.lumpSumAmount > 0
                            ? formatPercent((projection.lumpSumCommutation.lumpSumTax / projection.lumpSumCommutation.lumpSumAmount) * 100)
                            : "0.00%"}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  <p className="text-xs text-muted-foreground mt-2">
                    First R550,000 is tax-free; R550k–R770k @ 18%; R770k–R1.155M @ 27%; above R1.155M @ 36%
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                  No lump sum configured. Adjust &quot;Lump Sum at Retirement&quot; in Market Assumptions to model a cash payment at retirement.
                </div>
              )}

              <div className="rounded-lg bg-secondary/60 p-4">
                <h4 className="font-medium text-foreground mb-3">
                  Lifetime Tax Summary
                </h4>
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Total Income Tax (All Years)</TableCell>
                      <TableCell className="text-right font-mono text-red-600 dark:text-red-400">
                        {fmt(projection.totalLifetimeIncomeTax, yearsToRetirement)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Average Effective Tax Rate</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatPercent(projection.averageEffectiveTaxRate)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Lump Sum Tax (At Retirement)</TableCell>
                      <TableCell className="text-right font-mono">
                        {fmt(projection.totalLumpSumTax, yearsToRetirement)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Medical Aid (Total)</TableCell>
                      <TableCell className="text-right font-mono">
                        {fmt(projection.totalMedicalAidContributions, yearsToRetirement)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="font-medium">SA Tax Structure (2026/2027)</h4>
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    <strong>Your Age at Retirement:</strong> {personalInfo.retirementAge} years
                  </p>
                  <p className="text-muted-foreground">
                    <strong>Applicable Tax Rebate:</strong> {fmt(calculations.applicableRebate)}
                    {personalInfo.retirementAge >= 75 && " (Primary + Secondary + Tertiary)"}
                    {personalInfo.retirementAge >= 65 && personalInfo.retirementAge < 75 && " (Primary + Secondary)"}
                    {personalInfo.retirementAge < 65 && " (Primary only)"}
                  </p>
                  <p className="text-muted-foreground">
                    <strong>Tax-Free Threshold:</strong> {fmt(calculations.taxThreshold)}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <h4 className="font-medium mb-3">Yearly Tax Projections (First 10 Years)</h4>
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Year</TableHead>
                        <TableHead>Age</TableHead>
                        <TableHead className="text-right">Gross Withdrawal</TableHead>
                        <TableHead className="text-right">Income Tax</TableHead>
                        <TableHead className="text-right">Net Income</TableHead>
                        <TableHead className="text-right">Effective Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projection.yearlyProjections
                        .filter((p) => p.age >= personalInfo.retirementAge)
                        .slice(0, 10)
                        .map((proj) => (
                          <TableRow key={proj.year}>
                            <TableCell>{proj.year}</TableCell>
                            <TableCell>{proj.age}</TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {fmt(proj.withdrawals, proj.age - personalInfo.currentAge)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-destructive">
                              -{fmt(proj.incomeTax, proj.age - personalInfo.currentAge)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-green-600 dark:text-green-400">
                              {fmt(proj.netIncome, proj.age - personalInfo.currentAge)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {proj.withdrawals > 0
                                ? formatPercent((proj.incomeTax / proj.withdrawals) * 100)
                                : "0.00%"}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Sample Retirement Payslip */}
        <AccordionItem value="payslip" className="border rounded-lg px-4">
          <AccordionTrigger className="text-base font-semibold">
            7. Sample Retirement Payslip
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <div className="rounded-lg border-2 border-primary p-6 bg-background">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold">Retirement Income Breakdown</h3>
                  <p className="text-sm text-muted-foreground">
                    First Year of Retirement (Age {personalInfo.retirementAge})
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b">
                    <span className="font-medium">Gross Monthly Withdrawal:</span>
                    <span className="font-mono text-lg">
                      {fmt(projection.monthlyIncomeAtRetirement, yearsToRetirement)}
                    </span>
                  </div>

                  <div className="space-y-2 pl-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Less: Income Tax</span>
                      <span className="font-mono text-red-600 dark:text-red-400">
                        -{fmt(
                          calculations.firstRetirementYear
                            ? calculations.firstRetirementYear.incomeTax / 12
                            : 0,
                          yearsToRetirement
                        )}
                      </span>
                    </div>
                    {calculations.firstRetirementYear && calculations.firstRetirementYear.lumpSumTax > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Less: Lump Sum Tax (One-time)</span>
                        <span className="font-mono text-red-600 dark:text-red-400">
                          -{fmt(calculations.firstRetirementYear.lumpSumTax / 12, yearsToRetirement)}
                        </span>
                      </div>
                    )}
                    {calculations.firstRetirementYear && calculations.firstRetirementYear.medicalAidContribution > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Less: Medical Aid</span>
                        <span className="font-mono text-red-600 dark:text-red-400">
                          -{fmt(calculations.firstRetirementYear.medicalAidContribution / 12, yearsToRetirement)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t-2 border-primary">
                    <span className="text-lg font-bold">Net Monthly Income:</span>
                    <span className="font-mono text-2xl font-bold text-green-600 dark:text-green-400">
                      {fmt(projection.monthlyNetIncomeAtRetirement, yearsToRetirement)}
                    </span>
                  </div>

                  <div className="mt-6 pt-4 border-t space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Annual Gross Income:</span>
                      <span className="font-mono">
                        {fmt(projection.monthlyIncomeAtRetirement * 12, yearsToRetirement)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Annual Net Income:</span>
                      <span className="font-mono text-green-600 dark:text-green-400">
                        {fmt(projection.monthlyNetIncomeAtRetirement * 12, yearsToRetirement)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Effective Tax Rate (Year 1):</span>
                      <span className="font-mono">
                        {calculations.firstRetirementYear && calculations.firstRetirementYear.withdrawals > 0
                          ? formatPercent(
                              (calculations.firstRetirementYear.incomeTax /
                                calculations.firstRetirementYear.withdrawals) *
                                100
                            )
                          : "0.00%"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-muted p-4">
                <h4 className="font-medium mb-2">Understanding Your Retirement Income</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Gross withdrawal is taken from your retirement portfolio</li>
                  <li>Income tax is calculated using SA tax brackets with age-based rebates</li>
                  <li>Net income is what you actually receive for living expenses</li>
                  <li>Tax rates increase as withdrawals increase (progressive taxation)</li>
                  <li>Older retirees benefit from higher rebates (lower effective tax)</li>
                </ul>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* RA Contribution Optimization */}
        {(() => {
          if (personalInfo.annualIncome <= 0) return (
            <AccordionItem value="ra-optimization" className="border rounded-lg px-4">
              <AccordionTrigger className="text-base font-semibold">
                8. RA/Pension Contribution Optimisation
              </AccordionTrigger>
              <AccordionContent>
                <div className="rounded-lg border border-muted bg-muted/40 p-4 text-sm text-muted-foreground space-y-1">
                  <p>Enter your <strong>Annual Income</strong> under <strong>Planning Inputs</strong> to see personalised RA deduction optimisation.</p>
                </div>
              </AccordionContent>
            </AccordionItem>
          )
          return (() => {
          const opt = calculateRAOptimization(personalInfo.annualIncome, accounts)
          const hasRAAccounts = opt.currentMonthlyContributions > 0 || accounts.some(
            a => ['pension_fund', 'retirement_annuity', 'preservation_fund'].includes(a.type)
          )

          return (
            <AccordionItem value="ra-optimization" className="border rounded-lg px-4">
              <AccordionTrigger className="text-base font-semibold">
                8. RA/Pension Contribution Optimisation
                {!opt.isFullyUtilized && opt.annualTaxSaving > 0 && (
                  <span className="ml-2 text-sm font-normal text-amber-600 dark:text-amber-400">
                    Save {formatCurrency(opt.annualTaxSaving)} in tax/year
                  </span>
                )}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  {/* Summary cards */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg bg-muted p-3 space-y-1">
                      <p className="text-xs text-muted-foreground">Annual Deduction Limit</p>
                      <p className="font-semibold">{formatCurrency(opt.annualDeductionLimit)}</p>
                      <p className="text-xs text-muted-foreground">
                        min(27.5% × {formatCurrency(personalInfo.annualIncome)}, R430k)
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Income from Planning Inputs
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted p-3 space-y-1">
                      <p className="text-xs text-muted-foreground">Current Annual Contributions</p>
                      <p className="font-semibold">{formatCurrency(opt.currentAnnualContributions)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(opt.currentMonthlyContributions)}/month across RA/pension accounts
                      </p>
                    </div>
                    <div className={`rounded-lg p-3 space-y-1 ${
                      opt.isFullyUtilized
                        ? "bg-primary/5"
                        : "bg-warning/10"
                    }`}>
                      <p className="text-xs text-muted-foreground">Unused Deduction Room</p>
                      <p className={`font-semibold ${
                        opt.isFullyUtilized
                          ? "text-primary"
                          : "text-warning"
                      }`}>
                        {opt.isFullyUtilized ? "Fully utilised" : formatCurrency(opt.remainingRoom)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {opt.utilizationPct.toFixed(0)}% of limit used
                      </p>
                    </div>
                  </div>

                  {/* Utilisation bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Deduction utilisation</span>
                      <span>{opt.utilizationPct.toFixed(1)}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          opt.utilizationPct >= 100
                            ? "bg-primary"
                            : opt.utilizationPct >= 60
                            ? "bg-warning"
                            : "bg-destructive"
                        }`}
                        style={{ width: `${Math.min(100, opt.utilizationPct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Tax saving callout */}
                  {!opt.isFullyUtilized && opt.annualTaxSaving > 0 && (
                    <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 space-y-2">
                      <p className="font-medium text-warning">
                        You could save {formatCurrency(opt.annualTaxSaving)}/year in income tax
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Increase your combined RA/pension contributions from{" "}
                        <span className="font-medium">{formatCurrency(opt.currentMonthlyContributions)}/month</span> to{" "}
                        <span className="font-medium">{fmt(opt.optimalMonthlyContribution)}/month</span>{" "}
                        ({fmt(opt.remainingRoom)}/year additional) to fully utilise your deduction limit.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Additional monthly contribution needed: {fmt(opt.optimalMonthlyContribution - opt.currentMonthlyContributions)}/month
                      </p>
                    </div>
                  )}

                  {opt.isFullyUtilized && (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                      <p className="font-medium text-primary">
                        Your RA/pension deduction limit is fully utilised.
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        You are contributing the maximum deductible amount. Consider a TFSA for additional tax-free savings (R36k/year, R500k lifetime).
                      </p>
                    </div>
                  )}

                  {opt.isOverLimit && (() => {
                    const annualExcess = opt.currentAnnualContributions - opt.annualDeductionLimit
                    const accumulated = projection?.accumulatedExcessCredit ?? 0
                    const creditToLumpSum = projection?.lumpSumCommutation.creditAppliedToLumpSum ?? 0
                    const creditToDrawdown = projection?.lumpSumCommutation.creditCarriedIntoDrawdown ?? 0
                    return (
                      <div className="space-y-3">
                        <div className="rounded-lg border border-border bg-secondary/60 p-4 space-y-3">
                          <p className="font-medium text-foreground">
                            Section 11F carry-forward credit
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(annualExcess)}/year of your contributions exceed the deduction limit and are not tax-deductible now.
                            These disallowed contributions accumulate as a carry-forward credit that reduces your tax at retirement.
                          </p>
                          <div className="grid gap-3 sm:grid-cols-3 pt-1">
                            <div className="rounded-lg bg-background/60 p-3 space-y-1">
                              <p className="text-xs text-muted-foreground">Annual excess</p>
                              <p className="font-semibold">{formatCurrency(annualExcess)}</p>
                              <p className="text-xs text-muted-foreground">not deductible this year</p>
                            </div>
                            <div className="rounded-lg bg-background/60 p-3 space-y-1">
                              <p className="text-xs text-muted-foreground">Accumulated credit at retirement</p>
                              <p className="font-semibold">{accumulated > 0 ? formatCurrency(accumulated) : "—"}</p>
                              <p className="text-xs text-muted-foreground">total carry-forward built up</p>
                            </div>
                            <div className="rounded-lg bg-background/60 p-3 space-y-1">
                              <p className="text-xs text-muted-foreground">Applied at retirement</p>
                              <p className="font-semibold">
                                {creditToLumpSum > 0 ? formatCurrency(creditToLumpSum) : "—"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {creditToDrawdown > 0
                                  ? `+ ${formatCurrency(creditToDrawdown)} offsets annuity income`
                                  : "reduces taxable lump sum"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  {!hasRAAccounts && (
                    <p className="text-sm text-muted-foreground">
                      Add a Pension Fund, Retirement Annuity, or Preservation Fund account to see personalised optimisation suggestions.
                    </p>
                  )}

                  {/* How it works */}
                  <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
                    <p className="font-medium">How the deduction works</p>
                    <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Contributions to pension funds, RAs, and preservation funds reduce your taxable income</li>
                      <li>Limit: the lesser of 27.5% of your income or R430,000 per year</li>
                      <li>Tax saved = marginal tax rate × amount deducted (varies by bracket)</li>
                      <li>Excess contributions accumulate as a Section 11F credit — this reduces your taxable lump sum at retirement, with any remainder offsetting annuity income</li>
                      <li>Source: s11(k) of the Income Tax Act, 2026/2027 limits</li>
                    </ul>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })()
        })()}
      </Accordion>
    </div>
  )
}
