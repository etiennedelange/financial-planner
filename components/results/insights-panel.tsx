"use client"

import { useMemo } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  TrendingUp,
  Clock,
  PieChart,
  Heart,
  AlertTriangle,
  CheckCircle2,
  Target,
} from "lucide-react"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { useShallow } from "zustand/react/shallow"
import { calculateOptimalContribution } from "@/lib/calculations/optimal-contribution"
import { calculateCostOfDelay } from "@/lib/calculations/cost-of-delay"
import {
  compareScenarios,
  type ScenarioType,
} from "@/lib/calculations/scenario-comparison"
import { projectMedicalCosts } from "@/lib/calculations/medical-costs"
import { formatCurrency } from "@/lib/utils/currency"
import { InfoTooltip } from "@/components/ui/info-tooltip"

export function InsightsPanel() {
  const { accounts, personalInfo, retirementGoals, drawdownConfig, assumptions, displayMode } =
    useCalculatorStore(
      useShallow(state => ({
        accounts: state.accounts,
        personalInfo: state.personalInfo,
        retirementGoals: state.retirementGoals,
        drawdownConfig: state.drawdownConfig,
        assumptions: state.assumptions,
        displayMode: state.displayMode,
      }))
    )

  const insights = useMemo(() => {
    if (accounts.length === 0) return null

    const totalBalance = accounts.reduce((sum, acc) => sum + acc.currentBalance, 0)
    const totalContribution = accounts.reduce(
      (sum, acc) => sum + acc.monthlyContribution,
      0
    )
    const weightedReturn =
      totalBalance > 0
        ? accounts.reduce(
            (sum, acc) =>
              sum + (acc.expectedReturn / 100) * (acc.currentBalance / totalBalance),
            0
          )
        : 0.1
    const weightedFees =
      totalBalance > 0
        ? accounts.reduce(
            (sum, acc) =>
              sum + (acc.annualFees / 100) * (acc.currentBalance / totalBalance),
            0
          )
        : 0.01
    const avgEscalation =
      accounts.length > 0
        ? accounts.reduce((sum, acc) => sum + acc.contributionEscalation / 100, 0) /
            accounts.length
        : 0.06

    const yearsToRetirement = personalInfo.retirementAge - personalInfo.currentAge
    const inflationRate = retirementGoals.inflationRate / 100

    // Optimal contribution
    const optimalResult = calculateOptimalContribution({
      currentSavings: totalBalance,
      personalInfo,
      retirementGoals,
      drawdownConfig,
      expectedReturn: weightedReturn,
      fees: weightedFees,
      contributionEscalation: avgEscalation,
      compoundingMethod: assumptions.compoundingMethod,
    })

    // Cost of delay
    const costOfDelayResult = calculateCostOfDelay({
      currentSavings: totalBalance,
      monthlyContribution: totalContribution,
      personalInfo,
      retirementGoals,
      expectedReturn: weightedReturn,
      fees: weightedFees,
      contributionEscalation: avgEscalation,
      compoundingMethod: assumptions.compoundingMethod,
    })

    // Scenario comparison
    const scenarioResult = compareScenarios({
      currentSavings: totalBalance,
      monthlyContribution: totalContribution,
      personalInfo,
      retirementGoals,
      drawdownConfig,
      contributionEscalation: avgEscalation,
      fees: weightedFees,
      compoundingMethod: assumptions.compoundingMethod,
    })

    // Medical costs
    const medicalResult = projectMedicalCosts({
      currentAge: personalInfo.currentAge,
      retirementAge: personalInfo.retirementAge,
      lifeExpectancy: personalInfo.lifeExpectancy,
    })

    return {
      optimal: optimalResult,
      costOfDelay: costOfDelayResult,
      scenarios: scenarioResult,
      medical: medicalResult,
      currentContribution: totalContribution,
      yearsToRetirement,
      inflationRate,
    }
  }, [accounts, personalInfo, retirementGoals, drawdownConfig, assumptions])

  if (!insights) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Insights</CardTitle>
          <CardDescription>Add accounts to see personalized insights</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const contributionDiff =
    insights.optimal.optimalMonthlyContribution - insights.currentContribution
  const isOnTrack = contributionDiff <= 0

  return (
    <div className="space-y-4">
      {/* Optimal Contribution */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Optimal Contribution</CardTitle>
            <InfoTooltip
              content="Calculates the minimum monthly contribution needed to reach your target retirement nest egg. The target is based on your desired monthly income and withdrawal rate. Contributing more than this amount builds a safety buffer and improves your success rate."
              side="right"
            />
          </div>
          <CardDescription>
            The <strong>minimum</strong> monthly contribution needed to reach your target nest egg.
            Contributing more builds a larger safety margin and retirement surplus.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Target nest egg:</span>
              <span className="font-semibold">
                {formatCurrency(insights.optimal.targetNestEgg, displayMode, insights.yearsToRetirement, insights.inflationRate)}
              </span>
            </div>
            <div className="text-xs text-muted-foreground italic -mt-1 mb-2">
              Based on {formatCurrency(retirementGoals.desiredMonthlyIncome, displayMode, 0, insights.inflationRate)}/month
              desired income @ {drawdownConfig.initialWithdrawalRate}% withdrawal rate
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Recommended monthly:</span>
              <span className="font-semibold">
                {formatCurrency(insights.optimal.optimalMonthlyContribution, displayMode, 0, insights.inflationRate)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Current monthly:</span>
              <span className="font-semibold">
                {formatCurrency(insights.currentContribution, displayMode, 0, insights.inflationRate)}
              </span>
            </div>

            {isOnTrack ? (
              <div className="mt-2 flex items-center gap-2 rounded-md bg-green-50 p-2 text-green-700 dark:bg-green-950 dark:text-green-300">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm">
                  You&apos;re on track! Current contributions exceed the minimum needed.
                </span>
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-2 rounded-md bg-amber-50 p-2 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">
                  Consider increasing contributions by{" "}
                  {formatCurrency(contributionDiff, displayMode, 0, insights.inflationRate)}/month
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cost of Delay */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Cost of Delay</CardTitle>
            <InfoTooltip
              content="Shows how much retirement savings you lose by delaying your start. Due to compound growth, starting early has a massive impact - every year you delay costs you years of compound returns. The earlier you start, the less you need to contribute per month."
              side="right"
            />
          </div>
          <CardDescription>
            Impact of delaying retirement savings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">1 year delay:</span>
              <div className="text-right">
                <span className="font-semibold text-red-600 dark:text-red-400">
                  -{formatCurrency(insights.costOfDelay.costOfOneYearDelay, displayMode, insights.yearsToRetirement, insights.inflationRate)}
                </span>
                <span className="ml-2 text-sm text-muted-foreground">
                  ({insights.costOfDelay.percentageLostOneYear.toFixed(1)}%)
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">2 year delay:</span>
              <div className="text-right">
                <span className="font-semibold text-red-600 dark:text-red-400">
                  -{formatCurrency(insights.costOfDelay.costOfTwoYearDelay, displayMode, insights.yearsToRetirement, insights.inflationRate)}
                </span>
                <span className="ml-2 text-sm text-muted-foreground">
                  ({insights.costOfDelay.percentageLostTwoYear.toFixed(1)}%)
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">5 year delay:</span>
              <div className="text-right">
                <span className="font-semibold text-red-600 dark:text-red-400">
                  -{formatCurrency(insights.costOfDelay.costOfFiveYearDelay, displayMode, insights.yearsToRetirement, insights.inflationRate)}
                </span>
                <span className="ml-2 text-sm text-muted-foreground">
                  ({insights.costOfDelay.percentageLostFiveYear.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scenario Comparison */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Investment Scenarios</CardTitle>
            <InfoTooltip
              content="Compares how different investment strategies (Conservative, Balanced, Aggressive) affect your retirement outcomes. Each scenario runs a full Monte Carlo simulation (1,000 iterations) including both the accumulation phase (while saving) and drawdown phase (during retirement). Higher returns come with higher volatility."
              side="right"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(["conservative", "balanced", "aggressive"] as ScenarioType[]).map(
              (key) => {
                const scenario = insights.scenarios[key]
                const isRecommended = key === insights.scenarios.recommendedScenario
                return (
                  <div
                    key={key}
                    className={`rounded-lg border p-3 ${
                      isRecommended
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{scenario.scenario}</span>
                        {isRecommended && (
                          <Badge variant="default" className="text-xs">
                            Recommended
                          </Badge>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {scenario.nominalReturn.toFixed(1)}% return
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Nest egg: </span>
                        <span>{formatCurrency(scenario.projectedNestEgg, displayMode, insights.yearsToRetirement, insights.inflationRate)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Success: </span>
                        <span
                          className={
                            scenario.successProbability >= 75
                              ? "text-green-600 dark:text-green-400"
                              : scenario.successProbability >= 50
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-red-600 dark:text-red-400"
                          }
                        >
                          {scenario.successProbability.toFixed(0)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Lasts: </span>
                        <span>{scenario.yearsLasts} years</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Volatility: </span>
                        <span>{scenario.volatility.toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                )
              }
            )}
            <p className="text-sm text-muted-foreground">
              {insights.scenarios.recommendation}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Medical Costs */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Medical Cost Projection</CardTitle>
            <InfoTooltip
              content="Projects medical aid costs in retirement. SA medical inflation averages ~9% p.a. (higher than general inflation at 5.5%). These costs typically increase with age and can be a significant retirement expense. Plan to allocate 10-15% of retirement income for medical costs."
              side="right"
            />
          </div>
          <CardDescription>
            SA medical inflation: ~9% p.a. (vs 5.5% general)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">At retirement:</span>
              <span className="font-semibold">
                {formatCurrency(insights.medical.medicalCostAtRetirement, displayMode, insights.yearsToRetirement, insights.inflationRate)}/month
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">At age 75:</span>
              <span className="font-semibold">
                {formatCurrency(insights.medical.medicalCostAt75, displayMode, 75 - personalInfo.currentAge, insights.inflationRate)}/month
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">At age 85:</span>
              <span className="font-semibold">
                {formatCurrency(insights.medical.medicalCostAt85, displayMode, 85 - personalInfo.currentAge, insights.inflationRate)}/month
              </span>
            </div>
            <div className="mt-3 border-t pt-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Total medical in retirement:
                </span>
                <span className="font-semibold text-lg">
                  {formatCurrency(insights.medical.totalMedicalCostInRetirement, displayMode, insights.yearsToRetirement, insights.inflationRate)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
