"use client";

import { useState } from "react";
import { Bug, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useCalculatorStore } from "@/lib/store/calculator-store";
import { useShallow } from "zustand/react/shallow";
import { SA_DEFAULTS } from "@/lib/constants/defaults";
import {
  calculateMonthlyReturn,
  formatMonthlyReturnFormula,
} from "@/lib/calculations/utils/projection";
import {
  calculateRetirementTax,
  calculateReplacementRatio,
} from "@/lib/calculations/retirement-tax";
import { SA_TAX_LIMITS } from "@/lib/constants/limits";
import {
  COMPOUNDING_METHOD_LABELS,
  COMPOUNDING_METHOD_DESCRIPTIONS,
} from "@/types";
import type { Account, ProjectionResult, SimulationResult } from "@/types";

interface DebugWindowProps {
  className?: string;
  projection?: ProjectionResult | null;
  simulationResult?: SimulationResult | null;
}

export function DebugWindow({
  className,
  projection,
  simulationResult,
}: DebugWindowProps) {
  const {
    accounts,
    personalInfo,
    retirementGoals,
    assumptions,
    drawdownConfig,
    displayMode,
  } = useCalculatorStore(
    useShallow((state) => ({
      accounts: state.accounts,
      personalInfo: state.personalInfo,
      retirementGoals: state.retirementGoals,
      assumptions: state.assumptions,
      drawdownConfig: state.drawdownConfig,
      displayMode: state.displayMode,
    })),
  );

  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Calculate derived parameters (matching the calculation engine)
  const totalBalance = accounts.reduce(
    (sum, acc) => sum + acc.currentBalance,
    0,
  );
  const totalMonthlyContribution = accounts.reduce(
    (sum, acc) => sum + acc.monthlyContribution,
    0,
  );

  // Match the calculation engine logic exactly (projection-engine.ts:37-81)
  // When balance is 0, weight by contributions instead of balance
  const weightedReturn =
    totalBalance === 0
      ? totalMonthlyContribution === 0
        ? SA_DEFAULTS.equityReturn
        : accounts.reduce(
            (sum, acc) =>
              sum +
              (acc.expectedReturn / 100) *
                (acc.monthlyContribution / totalMonthlyContribution),
            0,
          )
      : accounts.reduce(
          (sum, acc) =>
            sum +
            (acc.expectedReturn / 100) * (acc.currentBalance / totalBalance),
          0,
        );

  const weightedFees =
    totalBalance === 0
      ? totalMonthlyContribution === 0
        ? 0.01
        : accounts.reduce(
            (sum, acc) =>
              sum +
              (acc.annualFees / 100) *
                (acc.monthlyContribution / totalMonthlyContribution),
            0,
          )
      : accounts.reduce(
          (sum, acc) =>
            sum + (acc.annualFees / 100) * (acc.currentBalance / totalBalance),
          0,
        );

  const avgEscalation =
    accounts.length > 0
      ? accounts.reduce(
          (sum, acc) => sum + acc.contributionEscalation / 100,
          0,
        ) / accounts.length
      : SA_DEFAULTS.contributionEscalation;

  const yearsToRetirement =
    personalInfo.retirementAge - personalInfo.currentAge;
  const yearsInRetirement =
    personalInfo.lifeExpectancy - personalInfo.retirementAge;
  const inflationRate = retirementGoals.inflationRate / 100;
  const netReturn = weightedReturn - weightedFees;

  // Calculate monthly return using the proper compounding method
  const compoundingMethod = assumptions?.compoundingMethod || "nominal";
  const monthlyReturn = calculateMonthlyReturn(netReturn, compoundingMethod);
  const monthlyReturnFormula = formatMonthlyReturnFormula(
    netReturn,
    compoundingMethod,
  );
  const monthlyFeeRate = Math.pow(1 + weightedFees, 1 / 12) - 1;

  // Volatility from assumptions or defaults
  const volatility =
    assumptions?.equityVolatility || SA_DEFAULTS.equityVolatility * 100;

  // Display mode labels
  const displayModeLabel =
    displayMode === "real" ? "Today's Value (Real)" : "Future Value (Nominal)";

  // ===== PRIORITY 1 CALCULATIONS =====

  // 1. Weighting method indicator
  const weightingMethod =
    totalBalance === 0
      ? "CONTRIBUTION weights (balance = R0)"
      : "BALANCE weights";

  // 2. Initial withdrawal calculation (at retirement)
  // Calculate initial withdrawal based on strategy
  const calculateInitialWithdrawal = (
    portfolioValue: number,
    desiredMonthlyIncomeToday: number,
    yearsToRetirement: number,
    inflationRate: number,
  ): number => {
    const desiredMonthlyAtRetirement =
      desiredMonthlyIncomeToday *
      Math.pow(1 + inflationRate, yearsToRetirement);

    switch (drawdownConfig.strategy) {
      case "fixed_percentage":
        return portfolioValue * (drawdownConfig.initialWithdrawalRate / 100);
      case "fixed_amount_inflation_adjusted":
        return desiredMonthlyAtRetirement * 12;
      case "variable_percentage":
      case "guardrails":
        const minAtRetirement =
          drawdownConfig.minimumWithdrawal *
          Math.pow(1 + inflationRate, yearsToRetirement);
        const maxAtRetirement =
          drawdownConfig.maximumWithdrawal *
          Math.pow(1 + inflationRate, yearsToRetirement);
        return Math.min(
          Math.max(desiredMonthlyAtRetirement * 12, minAtRetirement * 12),
          maxAtRetirement * 12,
        );
      default:
        return portfolioValue * SA_DEFAULTS.safeWithdrawalRate;
    }
  };

  // Use projection result if available, otherwise estimate
  const portfolioAtRetirementEstimate =
    projection?.portfolioAtRetirement ||
    totalBalance * Math.pow(1 + netReturn, yearsToRetirement);
  const initialWithdrawalAnnual = calculateInitialWithdrawal(
    portfolioAtRetirementEstimate,
    retirementGoals.desiredMonthlyIncome,
    yearsToRetirement,
    inflationRate,
  );
  const initialWithdrawalMonthly = initialWithdrawalAnnual / 12;

  // Desired monthly income inflated to retirement
  const desiredMonthlyAtRetirement =
    retirementGoals.desiredMonthlyIncome *
    Math.pow(1 + inflationRate, yearsToRetirement);

  // 3. Tax calculations at retirement (first year)
  const retirementAge = personalInfo.retirementAge;
  const taxAtRetirement = calculateRetirementTax(initialWithdrawalAnnual, {
    age: retirementAge,
    monthlyMedicalAid: 0, // Could be made configurable
    preRetirementIncome: personalInfo.annualIncome,
  });

  // Replacement ratio
  const replacementRatio = calculateReplacementRatio(
    taxAtRetirement.netIncome,
    personalInfo.annualIncome,
  );

  // Tax threshold for retirement age
  let taxThreshold: number = SA_TAX_LIMITS.taxThresholdUnder65;
  if (retirementAge >= 75) {
    taxThreshold = SA_TAX_LIMITS.taxThreshold75Plus;
  } else if (retirementAge >= 65) {
    taxThreshold = SA_TAX_LIMITS.taxThreshold65To74;
  }
  const isBelowThreshold = initialWithdrawalAnnual <= taxThreshold;

  // Use projection tax data if available
  const effectiveTaxRate =
    projection?.averageEffectiveTaxRate || taxAtRetirement.effectiveTaxRate;
  const lifetimeIncomeTax = projection?.totalLifetimeIncomeTax || 0;

  const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;
  const formatCurrency = (value: number) =>
    `R ${value.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Calculate retirement eligibility and tax deductions
  const taxableIncome = personalInfo.annualIncome;
  const annualContribution = totalMonthlyContribution * 12;
  const maxRADeduction = Math.min(
    annualContribution,
    taxableIncome * SA_TAX_LIMITS.pensionRaDeductionRate,
    SA_TAX_LIMITS.pensionRaMaxDeduction,
  );
  const taxSavings = maxRADeduction * 0.45; // Assume max marginal rate of 45%
  const retirementEligible = personalInfo.currentAge >= 55 && totalBalance > 0;
  const canAccessRA = personalInfo.currentAge >= 55;
  const canAccessPreservation = totalBalance > 0; // Can access 1/3 lump sum before retirement

  const copyDebugInfo = async () => {
    const debugText = `
SA RETIREMENT CALCULATOR - DEBUG INFORMATION
Generated: ${new Date().toLocaleString("en-ZA")}

=====================================================
CALCULATION METHOD ⚙️
=====================================================
Compounding Method: ${COMPOUNDING_METHOD_LABELS[compoundingMethod]}
Description: ${COMPOUNDING_METHOD_DESCRIPTIONS[compoundingMethod]}
Monthly Return Formula: ${monthlyReturnFormula}
Calculated Monthly Return: ${formatPercent(monthlyReturn)}

Display Mode: ${displayModeLabel}
${displayMode === "real" ? "All currency values are inflation-adjusted to show purchasing power in today's terms." : "All currency values are shown in future nominal terms (not adjusted for inflation)."}

CALCULATION CHECKSUMS:
- Total Accounts: ${accounts.length}
- Total Balance: ${formatCurrency(totalBalance)}
- Total Monthly Contributions: ${formatCurrency(totalMonthlyContribution)}
- Weighted Return: ${formatPercent(weightedReturn)}
- Weighted Fees: ${formatPercent(weightedFees)}
- Net Return: ${formatPercent(netReturn)}
- Calculated At: ${new Date().toISOString()}

=====================================================
PERSONAL INFORMATION
=====================================================
Current Age: ${personalInfo.currentAge}
Retirement Age: ${personalInfo.retirementAge}
Life Expectancy: ${personalInfo.lifeExpectancy}
Annual Income: ${formatCurrency(personalInfo.annualIncome)}
Years to Retirement: ${yearsToRetirement}
Years in Retirement: ${yearsInRetirement}

=====================================================
RETIREMENT ELIGIBILITY (SA TAX RULES)
=====================================================
Can Access RA: ${canAccessRA ? "YES (Age 55+)" : "NO (Must be 55+)"}
Can Access Preservation Fund: ${canAccessPreservation ? "YES (1/3 lump sum available)" : "NO"}
Retirement Eligible: ${retirementEligible ? "YES" : "NO"}

TAX DEDUCTIONS (2026/2027):
Annual Contribution: ${formatCurrency(annualContribution)}
Max RA Deduction: ${formatCurrency(maxRADeduction)} (27.5% of income, max R430k)
Estimated Tax Savings: ${formatCurrency(taxSavings)} (assuming 45% marginal rate)
Effective Cost After Tax: ${formatCurrency(annualContribution - taxSavings)}

=====================================================
RETIREMENT GOALS
=====================================================
Desired Monthly Income (Today): ${formatCurrency(retirementGoals.desiredMonthlyIncome)}
Inflation Rate: ${retirementGoals.inflationRate}%
Inflation Rate (Decimal): ${inflationRate.toFixed(4)}
Legacy Amount: ${formatCurrency(retirementGoals.legacyAmount)}

=====================================================
ACCOUNTS (${accounts.length} total)
=====================================================
${
  accounts.length === 0
    ? "No accounts configured"
    : accounts
        .map(
          (acc, idx) => `
${idx + 1}. ${acc.name} (${acc.type})
   Provider: ${acc.provider}
   Balance: ${formatCurrency(acc.currentBalance)}
   Monthly Contribution: ${formatCurrency(acc.monthlyContribution)}
   Expected Return: ${acc.expectedReturn}%
   Annual Fees: ${acc.annualFees}%
   Contribution Escalation: ${acc.contributionEscalation}%
`,
        )
        .join("")
}

=====================================================
PORTFOLIO AGGREGATES (CALCULATED)
=====================================================
Weighting Method: ${weightingMethod}
Total Balance: ${formatCurrency(totalBalance)}
Total Monthly Contribution: ${formatCurrency(totalMonthlyContribution)}
Total Annual Contribution: ${formatCurrency(totalMonthlyContribution * 12)}
Weighted Return: ${formatPercent(weightedReturn)}
Weighted Fees: ${formatPercent(weightedFees)}
Average Escalation: ${formatPercent(avgEscalation)}
Net Return (Return - Fees): ${formatPercent(netReturn)}
Monthly Return Rate: ${formatPercent(monthlyReturn)}
Monthly Fee Rate: ${formatPercent(monthlyFeeRate)}

=====================================================
WITHDRAWAL DETAILS (AT RETIREMENT)
=====================================================
Desired Monthly Income (Today): ${formatCurrency(retirementGoals.desiredMonthlyIncome)}
Inflated to Retirement: ${formatCurrency(desiredMonthlyAtRetirement)}
Initial Withdrawal (Annual): ${formatCurrency(initialWithdrawalAnnual)}
Initial Withdrawal (Monthly): ${formatCurrency(initialWithdrawalMonthly)}
Withdrawal Strategy: ${drawdownConfig.strategy}
Replacement Ratio: ${replacementRatio.toFixed(1)}% of pre-retirement income

=====================================================
TAX CALCULATIONS (RETIREMENT PHASE)
=====================================================
Annual Income Tax (Year 1): ${formatCurrency(taxAtRetirement.incomeTax)}
Effective Tax Rate (Year 1): ${taxAtRetirement.effectiveTaxRate.toFixed(2)}%
Average Effective Rate (Lifetime): ${effectiveTaxRate.toFixed(2)}%
Lifetime Income Tax: ${formatCurrency(lifetimeIncomeTax)}
Age-Based Rebate (at retirement): ${formatCurrency(taxAtRetirement.applicableRebate)}
Tax-Free Threshold (at retirement): ${formatCurrency(taxThreshold)}
Below Tax Threshold: ${isBelowThreshold ? "YES" : "NO"}
Net Monthly Income (Year 1): ${formatCurrency(taxAtRetirement.netIncome / 12)}

=====================================================
DRAWDOWN CONFIGURATION
=====================================================
Strategy: ${drawdownConfig.strategy}
Initial Withdrawal Rate: ${drawdownConfig.initialWithdrawalRate}%
Minimum Withdrawal (Monthly): ${formatCurrency(drawdownConfig.minimumWithdrawal)}
Maximum Withdrawal (Monthly): ${formatCurrency(drawdownConfig.maximumWithdrawal)}
Lump Sum at Retirement: ${drawdownConfig.lumpSumPercentage}%
${drawdownConfig.upperGuardrail ? `Upper Guardrail: ${drawdownConfig.upperGuardrail}%` : ""}
${drawdownConfig.lowerGuardrail ? `Lower Guardrail: ${drawdownConfig.lowerGuardrail}%` : ""}
${drawdownConfig.monthlyMedicalAid ? `Monthly Medical Aid: ${formatCurrency(drawdownConfig.monthlyMedicalAid)}` : ""}
${drawdownConfig.medicalAidDependants !== undefined ? `Medical Aid Dependants: ${drawdownConfig.medicalAidDependants}` : ""}

${
  assumptions
    ? `=====================================================
MARKET ASSUMPTIONS
=====================================================
Equity Return: ${assumptions.equityReturn}%
Bond Return: ${assumptions.bondReturn}%
Cash Return: ${assumptions.cashReturn}%
Equity Volatility: ${assumptions.equityVolatility}%
Bond Volatility: ${assumptions.bondVolatility}%
Inflation Rate: ${assumptions.inflationRate}%
`
    : ""
}
=====================================================
MONTE CARLO SIMULATION
=====================================================
Number of Runs: 1,000
Volatility Used: ${volatility}%
Volatility (Decimal): ${(volatility / 100).toFixed(4)}

=====================================================
SPENDING PHASE MULTIPLIERS
=====================================================
Go-Go Phase (Years 0-15): 100%
Slow-Go Phase (Years 15-25): 80%
No-Go Phase (Years 25+): 70% + Medical (cap 120%)
  Medical premium: +15% per 10 years after year 25

=====================================================
SA DEFAULT CONSTANTS
=====================================================
Default Inflation: ${SA_DEFAULTS.inflation * 100}%
Medical Inflation: ${SA_DEFAULTS.medicalInflation * 100}%
Default Equity Return: ${SA_DEFAULTS.equityReturn * 100}%
Default Bond Return: ${SA_DEFAULTS.bondReturn * 100}%
Default Cash Return: ${SA_DEFAULTS.cashReturn * 100}%
Default Equity Volatility: ${SA_DEFAULTS.equityVolatility * 100}%
Safe Withdrawal Rate: ${SA_DEFAULTS.safeWithdrawalRate * 100}%
Base Medical Cost (Monthly): ${formatCurrency(SA_DEFAULTS.baseMedicalCostMonthly)}

${
  projection
    ? `=====================================================
PROJECTION RESULTS (DETERMINISTIC)
=====================================================
Portfolio at Retirement: ${formatCurrency(projection.portfolioAtRetirement)}
Monthly Income at Retirement: ${formatCurrency(projection.monthlyIncomeAtRetirement)}
Portfolio Depletion Age: ${projection.portfolioDepletionAge || "Never (survives to life expectancy)"}
Surplus at Life Expectancy: ${formatCurrency(projection.surplusAmount)}
Shortfall Amount: ${formatCurrency(projection.shortfallAmount)}
Total Projection Years: ${projection.yearlyProjections.length}
`
    : ""
}
${
  simulationResult
    ? `=====================================================
MONTE CARLO SIMULATION RESULTS
=====================================================
Success Rate: ${simulationResult.successRate.toFixed(2)}%
Number of Runs: ${simulationResult.runs.length}
Median Depletion Age: ${simulationResult.medianDepletionAge || "N/A (most runs succeed)"}
Average Final Balance: ${formatCurrency(simulationResult.averageFinalBalance)}

PERCENTILE ANALYSIS (Final Year):
P10 (10th percentile): ${formatCurrency(simulationResult.percentiles.p10[simulationResult.percentiles.p10.length - 1] || 0)}
P25 (25th percentile): ${formatCurrency(simulationResult.percentiles.p25[simulationResult.percentiles.p25.length - 1] || 0)}
P50 (Median): ${formatCurrency(simulationResult.percentiles.p50[simulationResult.percentiles.p50.length - 1] || 0)}
P75 (75th percentile): ${formatCurrency(simulationResult.percentiles.p75[simulationResult.percentiles.p75.length - 1] || 0)}
P90 (90th percentile): ${formatCurrency(simulationResult.percentiles.p90[simulationResult.percentiles.p90.length - 1] || 0)}
`
    : ""
}
=====================================================
ACCURACY NOTES
=====================================================
This data can be used to verify calculations independently.

Compounding Method: ${compoundingMethod.toUpperCase()}
- ${COMPOUNDING_METHOD_DESCRIPTIONS[compoundingMethod]}
- Formula used: ${monthlyReturnFormula}

Key calculation details:
- Weighted metrics use contribution weights when balance = 0
- Monte Carlo uses log-normal distribution with volatility adjustment
- Spending phases: Go-Go (100%), Slow-Go (80%), No-Go (70%+medical)
- Display mode: ${displayModeLabel}

Single Source of Truth:
- All projections use lib/calculations/utils/projection.ts::projectFinalSavings
- Ensures consistency across all tabs (Projection, Insights, Scenarios)
`.trim();

    try {
      await navigator.clipboard.writeText(debugText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={className}
          title="Debug: View Calculation Parameters"
        >
          <Bug className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle>Debug: Calculation Parameters</DialogTitle>
              <DialogDescription>
                Verify all calculation inputs, assumptions, and results
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={copyDebugInfo}
              className="shrink-0"
              title={copied ? "Copied!" : "Copy all debug parameters"}
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 pb-6">
            {/* CRITICAL METRICS */}
            <CategorySection title="Critical Metrics" category="critical">
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">
                    Compounding Method:
                  </div>
                  <div className="font-semibold text-primary text-base">
                    {COMPOUNDING_METHOD_LABELS[compoundingMethod]}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 italic">
                    {COMPOUNDING_METHOD_DESCRIPTIONS[compoundingMethod]}
                  </div>
                </div>

                <div className="pt-2 border-t border-primary/20">
                  <div className="text-xs text-muted-foreground mb-1">
                    Monthly Return Formula:
                  </div>
                  <div className="font-mono text-xs bg-muted/50 p-2 rounded">
                    {monthlyReturnFormula}
                  </div>
                </div>

                <div className="pt-2 border-t border-primary/20">
                  <div className="text-xs text-muted-foreground mb-1">
                    Display Mode:
                  </div>
                  <div className="font-semibold text-sm">
                    {displayModeLabel}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {displayMode === "real"
                      ? "Currency values show purchasing power in today's terms (inflation-adjusted)"
                      : "Currency values show future nominal amounts (not inflation-adjusted)"}
                  </div>
                </div>

                <div className="pt-2 border-t border-primary/20">
                  <div className="text-xs font-semibold mb-2 text-muted-foreground">
                    CALCULATION CHECKSUMS:
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <Param
                      label="Total Accounts"
                      value={accounts.length}
                      small
                    />
                    <Param
                      label="Total Balance"
                      value={formatCurrency(totalBalance)}
                      small
                    />
                    <Param
                      label="Monthly Contrib"
                      value={formatCurrency(totalMonthlyContribution)}
                      small
                    />
                    <Param
                      label="Weighted Return"
                      value={formatPercent(weightedReturn)}
                      small
                    />
                    <Param
                      label="Weighted Fees"
                      value={formatPercent(weightedFees)}
                      small
                    />
                    <Param
                      label="Net Return"
                      value={formatPercent(netReturn)}
                      small
                    />
                  </div>
                </div>

                <Separator className="my-2" />

                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">
                      Portfolio at Retirement:
                    </div>
                    <div className="font-semibold text-primary">
                      {projection
                        ? formatCurrency(projection.portfolioAtRetirement)
                        : "Calculating..."}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">
                      Success Rate:
                    </div>
                    <div className="font-semibold text-primary">
                      {simulationResult
                        ? `${simulationResult.successRate.toFixed(2)}%`
                        : "Simulating..."}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">
                      Years to Depletion:
                    </div>
                    <div className="font-semibold text-primary">
                      {projection?.portfolioDepletionAge
                        ? `Age ${projection.portfolioDepletionAge}`
                        : "Never"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">
                      Replacement Ratio:
                    </div>
                    <div className="font-semibold text-primary">
                      {replacementRatio.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            </CategorySection>

            {/* CALCULATION INPUTS */}
            <CategorySection title="Calculation Inputs" category="inputs">
              <Section title="Personal Information">
                <Param label="Current Age" value={personalInfo.currentAge} />
                <Param
                  label="Retirement Age"
                  value={personalInfo.retirementAge}
                />
                <Param
                  label="Life Expectancy"
                  value={personalInfo.lifeExpectancy}
                />
                <Param
                  label="Annual Income"
                  value={formatCurrency(personalInfo.annualIncome)}
                />
                <Param
                  label="Years to Retirement"
                  value={yearsToRetirement}
                  highlight
                />
                <Param
                  label="Years in Retirement"
                  value={yearsInRetirement}
                  highlight
                />
              </Section>

              <Section title="Retirement Goals">
                <Param
                  label="Desired Monthly Income (Today)"
                  value={formatCurrency(retirementGoals.desiredMonthlyIncome)}
                />
                <Param
                  label="Inflation Rate"
                  value={`${retirementGoals.inflationRate}%`}
                />
                <Param
                  label="Inflation Rate (Decimal)"
                  value={inflationRate.toFixed(4)}
                  highlight
                />
                <Param
                  label="Legacy Amount"
                  value={formatCurrency(retirementGoals.legacyAmount)}
                />
              </Section>

              <Section title="Retirement Eligibility (SA Tax Rules)">
                <Param
                  label="Can Access RA"
                  value={canAccessRA ? "YES (Age 55+)" : "NO (Must be 55+)"}
                  highlight={canAccessRA}
                />
                <Param
                  label="Can Access Preservation Fund"
                  value={canAccessPreservation ? "YES (1/3 lump sum)" : "NO"}
                />
                <Param
                  label="Retirement Eligible"
                  value={retirementEligible ? "YES" : "NO"}
                  highlight={retirementEligible}
                />
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs font-semibold mb-2">
                    TAX DEDUCTIONS (2026/2027):
                  </p>
                  <Param
                    label="Annual Contribution"
                    value={formatCurrency(annualContribution)}
                  />
                  <Param
                    label="Max RA Deduction"
                    value={`${formatCurrency(maxRADeduction)} (27.5% of income, max R430k)`}
                    highlight
                  />
                  <Param
                    label="Estimated Tax Savings"
                    value={`${formatCurrency(taxSavings)} (45% marginal rate)`}
                    highlight
                  />
                  <Param
                    label="Effective Cost After Tax"
                    value={formatCurrency(annualContribution - taxSavings)}
                  />
                </div>
              </Section>

              <Section title={`Accounts (${accounts.length})`}>
                {accounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    No accounts configured
                  </p>
                ) : (
                  accounts.map((account, index) => (
                    <div
                      key={account.id}
                      className="mb-4 p-3 bg-muted/50 rounded-md"
                    >
                      <h4 className="font-semibold text-sm mb-2">
                        {index + 1}. {account.name} ({account.type})
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <Param
                          label="Provider"
                          value={account.provider}
                          small
                        />
                        <Param
                          label="Balance"
                          value={formatCurrency(account.currentBalance)}
                          small
                        />
                        <Param
                          label="Monthly Contribution"
                          value={formatCurrency(account.monthlyContribution)}
                          small
                        />
                        <Param
                          label="Expected Return"
                          value={`${account.expectedReturn}%`}
                          small
                        />
                        <Param
                          label="Annual Fees"
                          value={`${account.annualFees}%`}
                          small
                        />
                        <Param
                          label="Escalation"
                          value={`${account.contributionEscalation}%`}
                          small
                        />
                      </div>
                    </div>
                  ))
                )}
              </Section>

              <Section title="Drawdown Configuration">
                <Param label="Strategy" value={drawdownConfig.strategy} />
                <Param
                  label="Initial Withdrawal Rate"
                  value={`${drawdownConfig.initialWithdrawalRate}%`}
                />
                <Param
                  label="Minimum Withdrawal (Monthly)"
                  value={formatCurrency(drawdownConfig.minimumWithdrawal)}
                />
                <Param
                  label="Maximum Withdrawal (Monthly)"
                  value={formatCurrency(drawdownConfig.maximumWithdrawal)}
                />
                <Param
                  label="Lump Sum at Retirement"
                  value={`${drawdownConfig.lumpSumPercentage}%`}
                />
                {drawdownConfig.upperGuardrail && (
                  <Param
                    label="Upper Guardrail"
                    value={`${drawdownConfig.upperGuardrail}%`}
                  />
                )}
                {drawdownConfig.lowerGuardrail && (
                  <Param
                    label="Lower Guardrail"
                    value={`${drawdownConfig.lowerGuardrail}%`}
                  />
                )}
                {drawdownConfig.monthlyMedicalAid && (
                  <Param
                    label="Monthly Medical Aid"
                    value={formatCurrency(drawdownConfig.monthlyMedicalAid)}
                  />
                )}
                {drawdownConfig.medicalAidDependants !== undefined && (
                  <Param
                    label="Medical Aid Dependants"
                    value={drawdownConfig.medicalAidDependants}
                  />
                )}
              </Section>

              {assumptions && (
                <Section title="Market Assumptions">
                  <Param
                    label="Equity Return"
                    value={`${assumptions.equityReturn}%`}
                  />
                  <Param
                    label="Bond Return"
                    value={`${assumptions.bondReturn}%`}
                  />
                  <Param
                    label="Cash Return"
                    value={`${assumptions.cashReturn}%`}
                  />
                  <Param
                    label="Equity Volatility"
                    value={`${assumptions.equityVolatility}%`}
                  />
                  <Param
                    label="Bond Volatility"
                    value={`${assumptions.bondVolatility}%`}
                  />
                  <Param
                    label="Inflation Rate"
                    value={`${assumptions.inflationRate}%`}
                  />
                </Section>
              )}
            </CategorySection>

            {/* CALCULATED RESULTS */}
            <CategorySection title="Calculated Results" category="results">
              <Section title="Portfolio Aggregates (Calculated)">
                <Param
                  label="Weighting Method"
                  value={weightingMethod}
                  highlight
                />
                <Param
                  label="Total Balance"
                  value={formatCurrency(totalBalance)}
                  highlight
                />
                <Param
                  label="Total Monthly Contribution"
                  value={formatCurrency(totalMonthlyContribution)}
                  highlight
                />
                <Param
                  label="Total Annual Contribution"
                  value={formatCurrency(totalMonthlyContribution * 12)}
                  highlight
                />
                <Param
                  label="Weighted Return"
                  value={formatPercent(weightedReturn)}
                  highlight
                />
                <Param
                  label="Weighted Fees"
                  value={formatPercent(weightedFees)}
                  highlight
                />
                <Param
                  label="Average Escalation"
                  value={formatPercent(avgEscalation)}
                  highlight
                />
                <Param
                  label="Net Return (Return - Fees)"
                  value={formatPercent(netReturn)}
                  highlight
                />
                <Param
                  label="Monthly Return Rate"
                  value={formatPercent(monthlyReturn)}
                  highlight
                />
                <Param
                  label="Monthly Fee Rate"
                  value={formatPercent(monthlyFeeRate)}
                  highlight
                />
              </Section>

              <Section title="Withdrawal Details (At Retirement)">
                <Param
                  label="Desired Monthly Income (Today)"
                  value={formatCurrency(retirementGoals.desiredMonthlyIncome)}
                />
                <Param
                  label="Inflated to Retirement"
                  value={formatCurrency(desiredMonthlyAtRetirement)}
                  highlight
                />
                <Param
                  label="Initial Withdrawal (Annual)"
                  value={formatCurrency(initialWithdrawalAnnual)}
                  highlight
                />
                <Param
                  label="Initial Withdrawal (Monthly)"
                  value={formatCurrency(initialWithdrawalMonthly)}
                  highlight
                />
                <Param
                  label="Withdrawal Strategy"
                  value={drawdownConfig.strategy}
                />
                <Param
                  label="Replacement Ratio"
                  value={`${replacementRatio.toFixed(1)}%`}
                  highlight
                />
              </Section>

              <Section title="Tax Calculations (Retirement Phase)">
                <Param
                  label="Annual Income Tax (Year 1)"
                  value={formatCurrency(taxAtRetirement.incomeTax)}
                  highlight
                />
                <Param
                  label="Effective Tax Rate (Year 1)"
                  value={`${taxAtRetirement.effectiveTaxRate.toFixed(2)}%`}
                  highlight
                />
                <Param
                  label="Average Effective Rate (Lifetime)"
                  value={`${effectiveTaxRate.toFixed(2)}%`}
                  highlight
                />
                <Param
                  label="Lifetime Income Tax"
                  value={formatCurrency(lifetimeIncomeTax)}
                />
                <Param
                  label="Age-Based Rebate"
                  value={formatCurrency(taxAtRetirement.applicableRebate)}
                />
                <Param
                  label="Tax-Free Threshold"
                  value={formatCurrency(taxThreshold)}
                />
                <Param
                  label="Below Tax Threshold?"
                  value={isBelowThreshold ? "YES" : "NO"}
                  highlight={isBelowThreshold}
                />
                <Param
                  label="Net Monthly Income (Year 1)"
                  value={formatCurrency(taxAtRetirement.netIncome / 12)}
                  highlight
                />
              </Section>

              {projection && (
                <Section title="Projection Results (Deterministic)">
                  <Param
                    label="Portfolio at Retirement"
                    value={formatCurrency(projection.portfolioAtRetirement)}
                    highlight
                  />
                  <Param
                    label="Monthly Income at Retirement"
                    value={formatCurrency(projection.monthlyIncomeAtRetirement)}
                    highlight
                  />
                  <Param
                    label="Portfolio Depletion Age"
                    value={
                      projection.portfolioDepletionAge ||
                      "Never (survives to life expectancy)"
                    }
                    highlight={!projection.portfolioDepletionAge}
                  />
                  <Param
                    label="Surplus at Life Expectancy"
                    value={formatCurrency(projection.surplusAmount)}
                  />
                  <Param
                    label="Shortfall Amount"
                    value={formatCurrency(projection.shortfallAmount)}
                  />
                  <Param
                    label="Total Projection Years"
                    value={projection.yearlyProjections.length}
                  />
                </Section>
              )}

              {simulationResult && (
                <Section title="Monte Carlo Simulation Results">
                  <Param
                    label="Success Rate"
                    value={`${simulationResult.successRate.toFixed(2)}%`}
                    highlight
                  />
                  <Param
                    label="Number of Runs"
                    value={simulationResult.runs.length.toLocaleString()}
                  />
                  <Param
                    label="Median Depletion Age"
                    value={
                      simulationResult.medianDepletionAge ||
                      "N/A (most runs succeed)"
                    }
                  />
                  <Param
                    label="Average Final Balance"
                    value={formatCurrency(simulationResult.averageFinalBalance)}
                  />
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs font-semibold mb-2">
                      PERCENTILE ANALYSIS (Final Year):
                    </p>
                    <Param
                      label="P10 (10th percentile)"
                      value={formatCurrency(
                        simulationResult.percentiles.p10[
                          simulationResult.percentiles.p10.length - 1
                        ] || 0,
                      )}
                      small
                    />
                    <Param
                      label="P25 (25th percentile)"
                      value={formatCurrency(
                        simulationResult.percentiles.p25[
                          simulationResult.percentiles.p25.length - 1
                        ] || 0,
                      )}
                      small
                    />
                    <Param
                      label="P50 (Median)"
                      value={formatCurrency(
                        simulationResult.percentiles.p50[
                          simulationResult.percentiles.p50.length - 1
                        ] || 0,
                      )}
                      small
                    />
                    <Param
                      label="P75 (75th percentile)"
                      value={formatCurrency(
                        simulationResult.percentiles.p75[
                          simulationResult.percentiles.p75.length - 1
                        ] || 0,
                      )}
                      small
                    />
                    <Param
                      label="P90 (90th percentile)"
                      value={formatCurrency(
                        simulationResult.percentiles.p90[
                          simulationResult.percentiles.p90.length - 1
                        ] || 0,
                      )}
                      small
                    />
                  </div>
                </Section>
              )}
            </CategorySection>

            {/* REFERENCE DATA */}
            <CategorySection title="Reference Data" category="reference">
              <Section title="Monte Carlo Simulation">
                <Param label="Number of Runs" value="1,000" />
                <Param
                  label="Volatility Used"
                  value={`${volatility}%`}
                  highlight
                />
                <Param
                  label="Volatility (Decimal)"
                  value={(volatility / 100).toFixed(4)}
                  highlight
                />
              </Section>

              <Section title="Spending Phase Multipliers">
                <Param label="Go-Go Phase (Years 0-15)" value="100%" />
                <Param label="Slow-Go Phase (Years 15-25)" value="80%" />
                <Param
                  label="No-Go Phase (Years 25+)"
                  value="70% + Medical (cap 120%)"
                />
                <div className="text-xs text-muted-foreground mt-2 italic">
                  Medical premium: +15% per 10 years after year 25
                </div>
              </Section>

              <Section title="SA Default Constants">
                <Param
                  label="Default Inflation"
                  value={`${SA_DEFAULTS.inflation * 100}%`}
                />
                <Param
                  label="Medical Inflation"
                  value={`${SA_DEFAULTS.medicalInflation * 100}%`}
                />
                <Param
                  label="Default Equity Return"
                  value={`${SA_DEFAULTS.equityReturn * 100}%`}
                />
                <Param
                  label="Default Bond Return"
                  value={`${SA_DEFAULTS.bondReturn * 100}%`}
                />
                <Param
                  label="Default Cash Return"
                  value={`${SA_DEFAULTS.cashReturn * 100}%`}
                />
                <Param
                  label="Default Equity Volatility"
                  value={`${SA_DEFAULTS.equityVolatility * 100}%`}
                />
                <Param
                  label="Safe Withdrawal Rate"
                  value={`${SA_DEFAULTS.safeWithdrawalRate * 100}%`}
                />
                <Param
                  label="Base Medical Cost (Monthly)"
                  value={formatCurrency(SA_DEFAULTS.baseMedicalCostMonthly)}
                />
              </Section>

              {/* Accuracy Notes */}
              <Section title="Accuracy Notes">
                <div className="text-xs text-muted-foreground space-y-2">
                  <p>
                    This data can be used to verify calculations independently.
                  </p>
                  <p className="font-semibold">
                    Compounding Method: {compoundingMethod.toUpperCase()}
                  </p>
                  <p>- {COMPOUNDING_METHOD_DESCRIPTIONS[compoundingMethod]}</p>
                  <p>- Formula used: {monthlyReturnFormula}</p>
                  <p className="font-semibold mt-2">Key calculation details:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>
                      Weighted metrics use contribution weights when balance = 0
                    </li>
                    <li>
                      Monte Carlo uses log-normal distribution with volatility
                      adjustment
                    </li>
                    <li>
                      Spending phases: Go-Go (100%), Slow-Go (80%), No-Go
                      (70%+medical)
                    </li>
                    <li>Display mode: {displayModeLabel}</li>
                  </ul>
                  <p className="font-semibold mt-2">Single Source of Truth:</p>
                  <p>
                    - All projections use
                    lib/calculations/utils/projection.ts::projectFinalSavings
                  </p>
                  <p>
                    - Ensures consistency across all tabs (Projection, Insights,
                    Scenarios)
                  </p>
                </div>
              </Section>
            </CategorySection>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <div>
      <h3 className="font-semibold text-sm mb-3 text-primary">{title}</h3>
      <div className="space-y-2">{children}</div>
      <Separator className="mt-4" />
    </div>
  );
}

interface ParamProps {
  label: string;
  value: string | number;
  highlight?: boolean;
  small?: boolean;
}

function Param({ label, value, highlight, small }: ParamProps) {
  return (
    <div
      className={`flex justify-between items-center ${small ? "text-xs" : "text-sm"} ${highlight ? "font-semibold text-primary" : ""}`}
    >
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

interface CategorySectionProps {
  title: string;
  category: "critical" | "inputs" | "results" | "reference";
  children: React.ReactNode;
}

function CategorySection({ title, category, children }: CategorySectionProps) {
  const bgColor = {
    critical: "bg-primary/15",
    inputs: "bg-primary/5",
    results: "bg-primary/10",
    reference: "bg-muted/30",
  }[category];

  const borderColor = {
    critical: "border-primary",
    inputs: "border-primary/40",
    results: "border-primary",
    reference: "border-muted-foreground/40",
  }[category];

  return (
    <div className={`rounded-lg border-l-4 ${borderColor} ${bgColor} p-4`}>
      <h3 className="font-semibold text-sm mb-3 text-primary">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
