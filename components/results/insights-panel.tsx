"use client"

import Link from "next/link"
import { PageCard } from "@/components/ui/page-card"
import { Button } from "@/components/ui/button"
import { TrendingUp, Clock, Heart, AlertTriangle, CheckCircle2, Target } from "lucide-react"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { useShallow } from "zustand/react/shallow"
import { calculateOptimalContribution } from "@/lib/calculations/optimal-contribution"
import { calculateCostOfDelay } from "@/lib/calculations/cost-of-delay"
import { projectMedicalCosts } from "@/lib/calculations/medical-costs"
import { computePortfolioTotals } from "@/lib/calculations/utils/portfolio-totals"
import { formatCurrency } from "@/lib/utils/currency"
import { InfoTooltip } from "@/components/ui/info-tooltip"

export function InsightsPanel() {
  const { accounts, personalInfo, retirementGoals, drawdownConfig, assumptions, displayMode } =
    useCalculatorStore(
      useShallow((state) => ({
        accounts: state.accounts,
        personalInfo: state.personalInfo,
        retirementGoals: state.retirementGoals,
        drawdownConfig: state.drawdownConfig,
        assumptions: state.assumptions,
        displayMode: state.displayMode,
      })),
    )

  const insights = (() => {
    if (accounts.length === 0) return null

    const { totalBalance, totalContribution, weightedReturn, weightedFees, avgEscalation } =
      computePortfolioTotals(accounts)

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

    // Medical costs
    const medicalResult = projectMedicalCosts({
      currentAge: personalInfo.currentAge,
      retirementAge: personalInfo.retirementAge,
      lifeExpectancy: personalInfo.lifeExpectancy,
    })

    return {
      optimal: optimalResult,
      costOfDelay: costOfDelayResult,
      medical: medicalResult,
      currentContribution: totalContribution,
      yearsToRetirement,
      inflationRate,
    }
  })()

  if (!insights) {
    return (
      <PageCard
        label="Insights"
        contentClassName="flex flex-col items-center gap-3 py-2 text-center"
      >
        <p className="text-sm text-muted-foreground">Add accounts to see personalised insights.</p>
        <Button asChild size="sm" variant="outline">
          <Link href="/calculator/accounts">Go to Accounts</Link>
        </Button>
      </PageCard>
    )
  }

  const contributionDiff =
    insights.optimal.optimalMonthlyContribution - insights.currentContribution
  const isAchievable = insights.optimal.isAchievable
  const isOnTrack = isAchievable && contributionDiff <= 0

  return (
    <div className="space-y-4">
      {/* Optimal Contribution — primary insight */}
      <PageCard
        label="Optimal Contribution"
        description={
          <>
            The <strong>minimum</strong> monthly contribution needed to reach your target nest egg.
            Contributing more builds a larger safety margin and retirement surplus.
          </>
        }
        leading={<Target className="h-4 w-4 text-primary flex-none" />}
        trailing={
          <InfoTooltip
            content="Calculates the minimum monthly contribution needed to reach your target retirement nest egg. The target is based on your desired monthly income and withdrawal rate. Contributing more than this amount builds a safety buffer and improves your success rate."
            side="right"
          />
        }
        contentClassName="space-y-3"
      >
        <div className="space-y-3">
          {/* Status first — the key takeaway */}
          {!isAchievable ? (
            <div className="flex items-center gap-2 rounded-md bg-warning/10 p-2 text-warning">
              <AlertTriangle className="h-4 w-4 flex-none" />
              <span className="text-sm">
                Contributions alone can&apos;t reach this target before your retirement date.
                Consider a later retirement age or a lower income goal.
              </span>
            </div>
          ) : isOnTrack ? (
            <div className="flex items-center gap-2 rounded-md bg-primary/10 p-2 text-primary">
              <CheckCircle2 className="h-4 w-4 flex-none" />
              <span className="text-sm">
                You&apos;re on track! Current contributions exceed the minimum needed.
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md bg-warning/10 p-2 text-warning">
              <AlertTriangle className="h-4 w-4 flex-none" />
              <span className="text-sm">
                Consider increasing contributions by{" "}
                {formatCurrency(contributionDiff, displayMode, 0, insights.inflationRate)}/month
              </span>
            </div>
          )}

          {/* Details */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Recommended monthly:</span>
            <span className="font-semibold">
              {isAchievable
                ? formatCurrency(
                    insights.optimal.optimalMonthlyContribution,
                    displayMode,
                    0,
                    insights.inflationRate,
                  )
                : "Not reachable"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Current monthly:</span>
            <span className="font-semibold">
              {formatCurrency(insights.currentContribution, displayMode, 0, insights.inflationRate)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Target nest egg:</span>
            <span className="font-semibold">
              {formatCurrency(
                insights.optimal.targetNestEgg,
                displayMode,
                insights.yearsToRetirement,
                insights.inflationRate,
              )}
            </span>
          </div>
          <div className="text-xs text-muted-foreground italic">
            Based on{" "}
            {formatCurrency(
              retirementGoals.desiredMonthlyIncome,
              displayMode,
              0,
              insights.inflationRate,
            )}
            /month desired income @ {parseFloat(drawdownConfig.initialWithdrawalRate.toFixed(2))}%
            withdrawal rate
          </div>
        </div>
      </PageCard>

      {/* Cost of Delay */}
      <PageCard
        label="Cost of Delay"
        description="Impact of delaying retirement savings"
        leading={<Clock className="h-4 w-4 text-muted-foreground flex-none" />}
        trailing={
          <InfoTooltip
            content="Shows how much retirement savings you lose by delaying your start. Due to compound growth, starting early has a massive impact - every year you delay costs you years of compound returns. The earlier you start, the less you need to contribute per month."
            side="right"
          />
        }
        contentClassName="space-y-3"
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">1 year delay:</span>
            <div className="text-right">
              <span className="font-semibold text-destructive">
                -
                {formatCurrency(
                  insights.costOfDelay.costOfOneYearDelay,
                  displayMode,
                  insights.yearsToRetirement,
                  insights.inflationRate,
                )}
              </span>
              <span className="ml-2 text-sm text-muted-foreground">
                ({insights.costOfDelay.percentageLostOneYear.toFixed(1)}%)
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">2 year delay:</span>
            <div className="text-right">
              <span className="font-semibold text-destructive">
                -
                {formatCurrency(
                  insights.costOfDelay.costOfTwoYearDelay,
                  displayMode,
                  insights.yearsToRetirement,
                  insights.inflationRate,
                )}
              </span>
              <span className="ml-2 text-sm text-muted-foreground">
                ({insights.costOfDelay.percentageLostTwoYear.toFixed(1)}%)
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">5 year delay:</span>
            <div className="text-right">
              <span className="font-semibold text-destructive">
                -
                {formatCurrency(
                  insights.costOfDelay.costOfFiveYearDelay,
                  displayMode,
                  insights.yearsToRetirement,
                  insights.inflationRate,
                )}
              </span>
              <span className="ml-2 text-sm text-muted-foreground">
                ({insights.costOfDelay.percentageLostFiveYear.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      </PageCard>

      {/* Medical Costs */}
      <PageCard
        label="Medical Cost Projection"
        description="SA medical inflation: ~9% p.a. (vs 5.5% general)"
        leading={<Heart className="h-4 w-4 text-muted-foreground flex-none" />}
        trailing={
          <InfoTooltip
            content="Projects medical aid costs in retirement. SA medical inflation averages ~9% p.a. (higher than general inflation at 5.5%). These costs typically increase with age and can be a significant retirement expense. Plan to allocate 10-15% of retirement income for medical costs."
            side="right"
          />
        }
        contentClassName="space-y-3"
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">At retirement:</span>
            <span className="font-semibold">
              {formatCurrency(
                insights.medical.medicalCostAtRetirement,
                displayMode,
                insights.yearsToRetirement,
                insights.inflationRate,
              )}
              /month
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">At age 75:</span>
            <span className="font-semibold">
              {formatCurrency(
                insights.medical.medicalCostAt75,
                displayMode,
                75 - personalInfo.currentAge,
                insights.inflationRate,
              )}
              /month
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">At age 85:</span>
            <span className="font-semibold">
              {formatCurrency(
                insights.medical.medicalCostAt85,
                displayMode,
                85 - personalInfo.currentAge,
                insights.inflationRate,
              )}
              /month
            </span>
          </div>
          <div className="mt-3 border-t pt-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total medical in retirement:</span>
              <span className="font-semibold text-lg">
                {formatCurrency(
                  insights.medical.totalMedicalCostInRetirement,
                  displayMode,
                  insights.yearsToRetirement,
                  insights.inflationRate,
                )}
              </span>
            </div>
          </div>
        </div>
      </PageCard>
    </div>
  )
}
