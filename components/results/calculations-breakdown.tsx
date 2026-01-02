"use client"

import { useMemo } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { SA_DEFAULTS } from "@/lib/constants/defaults"

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPercent(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`
}

export function CalculationsBreakdown() {
  const { accounts, personalInfo, retirementGoals, assumptions, drawdownConfig } =
    useCalculatorStore()

  const calculations = useMemo(() => {
    if (accounts.length === 0) return null

    // Aggregate account data
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
    const inflationRate = retirementGoals.inflationRate / 100

    // Time periods
    const yearsToRetirement = personalInfo.retirementAge - personalInfo.currentAge
    const yearsInRetirement = personalInfo.lifeExpectancy - personalInfo.retirementAge

    // Monthly compounding rates
    // Using simple division to match Excel FV and industry convention (nominal annual rate)
    // Original: const monthlyReturn = Math.pow(1 + netReturn, 1 / 12) - 1
    const monthlyReturn = netReturn / 12

    // Project accumulation phase with monthly compounding
    let projectedBalance = totalBalance
    const yearlyProjections: Array<{
      year: number
      age: number
      startBalance: number
      contributions: number
      growth: number
      endBalance: number
    }> = []

    for (let year = 0; year < yearsToRetirement; year++) {
      const startBalance = projectedBalance
      let yearContributions = 0
      let yearGrowth = 0

      for (let month = 0; month < 12; month++) {
        // Apply growth first (end-of-period contributions, matches Excel FV type=0)
        const monthGrowth = projectedBalance * monthlyReturn
        yearGrowth += monthGrowth
        projectedBalance += monthGrowth
        // Then add contribution
        const monthlyContribution =
          (totalAnnualContribution / 12) *
          Math.pow(1 + avgEscalation, year + month / 12)
        yearContributions += monthlyContribution
        projectedBalance += monthlyContribution
      }

      yearlyProjections.push({
        year: year + 1,
        age: personalInfo.currentAge + year,
        startBalance,
        contributions: yearContributions,
        growth: yearGrowth,
        endBalance: projectedBalance,
      })
    }

    const portfolioAtRetirement = projectedBalance

    // Calculate withdrawal
    const desiredMonthlyAtRetirement =
      retirementGoals.desiredMonthlyIncome *
      Math.pow(1 + inflationRate, yearsToRetirement)

    let initialAnnualWithdrawal: number
    switch (drawdownConfig.strategy) {
      case "fixed_percentage":
        initialAnnualWithdrawal =
          portfolioAtRetirement * (drawdownConfig.initialWithdrawalRate / 100)
        break
      case "fixed_amount_inflation_adjusted":
        initialAnnualWithdrawal = desiredMonthlyAtRetirement * 12
        break
      default:
        initialAnnualWithdrawal =
          portfolioAtRetirement * (drawdownConfig.initialWithdrawalRate / 100)
    }

    // Project drawdown phase
    let drawdownBalance = portfolioAtRetirement
    let annualWithdrawal = initialAnnualWithdrawal
    const drawdownProjections: Array<{
      year: number
      age: number
      startBalance: number
      growth: number
      spendingPhase: string
      spendingMultiplier: number
      withdrawal: number
      endBalance: number
    }> = []

    for (let year = 0; year < Math.min(yearsInRetirement, 40); year++) {
      const startBalance = drawdownBalance

      // Spending phase
      let spendingPhase: string
      let spendingMultiplier: number
      if (year <= 15) {
        spendingPhase = "Go-Go"
        spendingMultiplier = 1.0
      } else if (year <= 25) {
        spendingPhase = "Slow-Go"
        spendingMultiplier = 0.8
      } else {
        spendingPhase = "No-Go"
        const baseRate = 0.7
        const medicalPremium = (0.15 * (year - 25)) / 10
        spendingMultiplier = Math.min(baseRate + medicalPremium, 1.2)
      }

      // Apply return first
      const growth = drawdownBalance * netReturn
      drawdownBalance += growth

      // Then withdraw
      const adjustedWithdrawal = annualWithdrawal * spendingMultiplier
      const actualWithdrawal = Math.min(adjustedWithdrawal, drawdownBalance)
      drawdownBalance = Math.max(0, drawdownBalance - actualWithdrawal)

      drawdownProjections.push({
        year: year + 1,
        age: personalInfo.retirementAge + year,
        startBalance,
        growth,
        spendingPhase,
        spendingMultiplier,
        withdrawal: actualWithdrawal,
        endBalance: drawdownBalance,
      })

      if (drawdownBalance <= 0) break

      annualWithdrawal *= 1 + inflationRate
    }

    // Find depletion age
    const depletionYear = drawdownProjections.find((p) => p.endBalance <= 0)
    const depletionAge = depletionYear?.age || null

    return {
      // Inputs
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

      // Accumulation
      portfolioAtRetirement,
      yearlyProjections,

      // Drawdown
      desiredMonthlyAtRetirement,
      initialAnnualWithdrawal,
      initialMonthlyWithdrawal: initialAnnualWithdrawal / 12,
      drawdownProjections,
      depletionAge,

      // Formulas
      formulas: {
        monthlyReturn: `(1 + ${formatPercent(netReturn * 100)})^(1/12) - 1 = ${formatPercent(monthlyReturn * 100, 4)}`,
        futureExpenses: `${formatCurrency(retirementGoals.desiredMonthlyIncome)} × (1 + ${formatPercent(inflationRate * 100)})^${yearsToRetirement} = ${formatCurrency(desiredMonthlyAtRetirement)}`,
        targetNestEgg: `${formatCurrency(desiredMonthlyAtRetirement * 12)} ÷ ${formatPercent(drawdownConfig.initialWithdrawalRate)} = ${formatCurrency((desiredMonthlyAtRetirement * 12) / (drawdownConfig.initialWithdrawalRate / 100))}`,
      },
    }
  }, [accounts, personalInfo, retirementGoals, assumptions, drawdownConfig])

  if (!calculations) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Calculations Breakdown</CardTitle>
          <CardDescription>Add accounts to see detailed calculations</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Calculations Breakdown</CardTitle>
          <CardDescription>
            Detailed view of all calculations and formulas used
          </CardDescription>
        </CardHeader>
      </Card>

      <Accordion type="multiple" defaultValue={["inputs", "formulas"]} className="space-y-2">
        {/* Input Summary */}
        <AccordionItem value="inputs" className="border rounded-lg px-4">
          <AccordionTrigger className="text-lg font-semibold">
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
                        {formatCurrency(calculations.totalBalance)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Monthly Contributions</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(calculations.totalMonthlyContribution)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Annual Contributions</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(calculations.totalAnnualContribution)}
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
                        {formatCurrency(retirementGoals.desiredMonthlyIncome)}/mo
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
          <AccordionTrigger className="text-lg font-semibold">
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
          <AccordionTrigger className="text-lg font-semibold">
            3. Accumulation Phase ({calculations.yearsToRetirement} years)
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <div className="rounded-lg bg-green-50 dark:bg-green-950 p-4">
                <p className="text-lg font-semibold text-green-700 dark:text-green-300">
                  Portfolio at Retirement:{" "}
                  {formatCurrency(calculations.portfolioAtRetirement)}
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
                    {calculations.yearlyProjections.map((proj) => (
                      <TableRow key={proj.year}>
                        <TableCell>{proj.year}</TableCell>
                        <TableCell>{proj.age}</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(proj.startBalance)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-blue-600 dark:text-blue-400">
                          +{formatCurrency(proj.contributions)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-green-600 dark:text-green-400">
                          +{formatCurrency(proj.growth)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-medium">
                          {formatCurrency(proj.endBalance)}
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
          <AccordionTrigger className="text-lg font-semibold">
            4. Drawdown Phase ({calculations.yearsInRetirement} years planned)
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-4">
                  <p className="text-sm text-muted-foreground">
                    Initial Monthly Withdrawal
                  </p>
                  <p className="text-lg font-semibold text-blue-700 dark:text-blue-300">
                    {formatCurrency(calculations.initialMonthlyWithdrawal)}/month
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    (Inflated from {formatCurrency(retirementGoals.desiredMonthlyIncome)})
                  </p>
                </div>
                <div
                  className={`rounded-lg p-4 ${
                    calculations.depletionAge
                      ? "bg-red-50 dark:bg-red-950"
                      : "bg-green-50 dark:bg-green-950"
                  }`}
                >
                  <p className="text-sm text-muted-foreground">Portfolio Depletion</p>
                  <p
                    className={`text-lg font-semibold ${
                      calculations.depletionAge
                        ? "text-red-700 dark:text-red-300"
                        : "text-green-700 dark:text-green-300"
                    }`}
                  >
                    {calculations.depletionAge
                      ? `Age ${calculations.depletionAge}`
                      : `Lasts beyond age ${personalInfo.lifeExpectancy}`}
                  </p>
                </div>
              </div>

              <div className="max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Year</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead className="text-right">Start</TableHead>
                      <TableHead className="text-right">Growth</TableHead>
                      <TableHead>Phase</TableHead>
                      <TableHead className="text-right">Withdrawal</TableHead>
                      <TableHead className="text-right">End</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calculations.drawdownProjections.map((proj) => (
                      <TableRow
                        key={proj.year}
                        className={proj.endBalance <= 0 ? "bg-red-50 dark:bg-red-950" : ""}
                      >
                        <TableCell>{proj.year}</TableCell>
                        <TableCell>{proj.age}</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(proj.startBalance)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-green-600 dark:text-green-400">
                          +{formatCurrency(proj.growth)}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs">
                            {proj.spendingPhase} ({formatPercent(proj.spendingMultiplier * 100, 0)})
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-red-600 dark:text-red-400">
                          -{formatCurrency(proj.withdrawal)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-medium">
                          {formatCurrency(proj.endBalance)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Monte Carlo Info */}
        <AccordionItem value="montecarlo" className="border rounded-lg px-4">
          <AccordionTrigger className="text-lg font-semibold">
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
      </Accordion>
    </div>
  )
}
