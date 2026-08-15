"use client"

import { calculateProjection } from "@/lib/calculations/projection-engine"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { useAuth } from "@/components/supabase-provider"
import { formatCurrency } from "@/lib/utils/currency"
import type { ProjectionResult } from "@/types"
import { useEffect, useMemo } from "react"
import { useShallow } from "zustand/react/shallow"

function pct(n: number) {
  return `${n.toFixed(1)}%`
}

export function PrintClient() {
  const { isLoaded: authLoaded, phase, error } = useAuth()

  // /print is a standalone route outside the /calculator layout. The root
  // SupabaseProvider is the single bootstrap owner: it hydrates the stores
  // (guest scope, then user scope once identity resolves) and syncs server
  // data before `isLoaded` flips true — no store rehydrate() is called here.
  const storeState = useCalculatorStore(
    useShallow((s) => ({
      accounts: s.accounts,
      personalInfo: s.personalInfo,
      retirementGoals: s.retirementGoals,
      assumptions: s.assumptions,
      drawdownConfig: s.drawdownConfig,
      displayMode: s.displayMode,
    }))
  )

  const plan = storeState

  const projection: ProjectionResult | null = useMemo(
    () =>
      plan.accounts.length === 0
        ? null
        : calculateProjection(
            plan.accounts,
            plan.personalInfo,
            plan.retirementGoals,
            plan.drawdownConfig,
            plan.assumptions
          ),
    [plan]
  )

  // Give the DOM a moment to paint before triggering the print dialog.
  useEffect(() => {
    if (!projection) return
    const t = setTimeout(() => window.print(), 600)
    return () => clearTimeout(t)
  }, [projection])

  if (!authLoaded) {
    // Distinct failure states so a broken bootstrap cannot silently hang the
    // print route behind an infinite spinner.
    if (phase === "error") {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-muted-foreground">
          <p>Bootstrap failed and your plan could not be loaded.</p>
          <p className="text-sm">{error?.message ?? "Unknown error"}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Reload
          </button>
        </div>
      )
    }
    if (phase === "mfa-required") {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-muted-foreground">
          <p>Two-factor verification is required before this plan can be printed.</p>
          <button
            onClick={() => { window.location.href = "/auth/mfa" }}
            className="mt-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Verify now
          </button>
        </div>
      )
    }
    return (
      // data-bootstrap-phase mirrors the app-shell signal so e2e journeys can
      // wait for the /print bootstrap without a blind sleep.
      <div data-bootstrap-phase="loading" className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading your plan…
      </div>
    )
  }

  if (!projection) {
    return (
      <div data-bootstrap-phase="ready" className="flex min-h-screen items-center justify-center text-muted-foreground">
        No projection data. Add accounts before printing.
      </div>
    )
  }

  const { personalInfo, retirementGoals, assumptions, accounts, displayMode } = plan
  // assumptions.inflationRate is stored as a percentage (e.g. 5.5); formatCurrency expects a decimal
  const inflationRate = assumptions.inflationRate / 100
  const yearsToRetirement = personalInfo.retirementAge - personalInfo.currentAge
  const retirementRows = projection.yearlyProjections.filter((r) => r.age >= personalInfo.retirementAge)
  const accumulationRows = projection.yearlyProjections.filter((r) => r.age < personalInfo.retirementAge)
  const today = new Date().toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" })

  // Currency formatter that respects displayMode and age-based deflation
  function f(value: number, age: number) {
    const yearsFromNow = age - personalInfo.currentAge
    return formatCurrency(value, displayMode, yearsFromNow, inflationRate)
  }

  // For summary metrics at retirement
  function fRetirement(value: number) {
    return formatCurrency(value, displayMode, yearsToRetirement, inflationRate)
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 15mm 12mm; size: A4; }
        }
        body { font-family: system-ui, sans-serif; font-size: 12px; color: #111; }
        table { border-collapse: collapse; width: 100%; font-size: 10px; }
        th { background: #f3f4f6; font-weight: 600; text-align: left; padding: 4px 6px; border: 1px solid #e5e7eb; }
        td { padding: 3px 6px; border: 1px solid #e5e7eb; }
        tr:nth-child(even) td { background: #f9fafb; }
        .metric-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0; }
        .metric { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; }
        .metric-label { font-size: 10px; color: #6b7280; margin-bottom: 2px; }
        .metric-value { font-size: 16px; font-weight: 700; }
        .section { margin-top: 20px; }
        .section-title { font-size: 13px; font-weight: 700; border-bottom: 2px solid #111; padding-bottom: 4px; margin-bottom: 10px; }
        h1 { font-size: 20px; font-weight: 800; margin: 0; }
        .subtitle { color: #6b7280; font-size: 11px; margin-top: 2px; }
        .badge { display: inline-block; font-size: 9px; font-weight: 600; padding: 1px 6px; border-radius: 99px; background: #dbeafe; color: #1e40af; }
        .tag-ok { background: #dcfce7; color: #166534; }
        .tag-warn { background: #fef9c3; color: #854d0e; }
        .tag-bad { background: #fee2e2; color: #991b1b; }
      `}</style>

      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => window.print()}
          style={{ padding: "8px 16px", background: "#111", color: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 13 }}
        >
          Print / Save PDF
        </button>
        <button
          onClick={() => window.close()}
          style={{ padding: "8px 16px", background: "#f3f4f6", borderRadius: 6, cursor: "pointer", fontSize: 13 }}
        >
          Close
        </button>
      </div>

      <div data-bootstrap-phase="ready" style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h1>SA Retirement Plan Report</h1>
            <div className="subtitle">Generated {today}</div>
            <div className="subtitle" style={{ marginTop: 2 }}>
              All values in {displayMode === "real" ? "today's money (real, inflation-adjusted)" : "future Rands (nominal)"}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#6b7280" }}>
              Age {personalInfo.currentAge} → {personalInfo.retirementAge} → {personalInfo.lifeExpectancy}
            </div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>{yearsToRetirement} years to retirement</div>
            <div
              className={`badge ${
                projection.portfolioDepletionAge
                  ? projection.portfolioDepletionAge < personalInfo.lifeExpectancy
                    ? "tag-bad"
                    : "tag-ok"
                  : "tag-ok"
              }`}
              style={{ marginTop: 4 }}
            >
              {projection.portfolioDepletionAge
                ? projection.portfolioDepletionAge >= personalInfo.lifeExpectancy
                  ? "On Track"
                  : `Shortfall at age ${projection.portfolioDepletionAge}`
                : "Surplus at life expectancy"}
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="metric-grid">
          <div className="metric">
            <div className="metric-label">Portfolio at Retirement</div>
            <div className="metric-value">{fRetirement(projection.portfolioAtRetirement)}</div>
          </div>
          <div className="metric">
            <div className="metric-label">Monthly Net Income</div>
            <div className="metric-value">{fRetirement(projection.monthlyNetIncomeAtRetirement)}</div>
          </div>
          <div className="metric">
            <div className="metric-label">Depletion Age</div>
            <div className="metric-value">
              {projection.portfolioDepletionAge ? `Age ${projection.portfolioDepletionAge}` : "Never"}
            </div>
          </div>
          <div className="metric">
            <div className="metric-label">Total Income Tax (retirement)</div>
            <div className="metric-value">{fRetirement(projection.totalLifetimeIncomeTax)}</div>
          </div>
          <div className="metric">
            <div className="metric-label">Lump Sum Tax</div>
            <div className="metric-value">{fRetirement(projection.totalLumpSumTax)}</div>
          </div>
          <div className="metric">
            <div className="metric-label">Effective Tax Rate</div>
            <div className="metric-value">{pct(projection.averageEffectiveTaxRate)}</div>
          </div>
        </div>

        {/* Accounts */}
        <div className="section">
          <div className="section-title">Accounts ({accounts.length})</div>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Balance (today)</th>
                <th>Monthly Contrib</th>
                <th>Expected Return</th>
                <th>Annual Fees</th>
                <th>Escalation</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => (
                <tr key={acc.id}>
                  <td>{acc.name}</td>
                  <td style={{ textTransform: "capitalize" }}>{acc.type.replace(/_/g, " ")}</td>
                  <td>{formatCurrency(acc.currentBalance)}</td>
                  <td>{formatCurrency(acc.monthlyContribution)}</td>
                  <td>{acc.expectedReturn.toFixed(1)}%</td>
                  <td>{acc.annualFees.toFixed(2)}%</td>
                  <td>{acc.contributionEscalation.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Assumptions */}
        <div className="section">
          <div className="section-title">Planning Assumptions</div>
          <table>
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Value</th>
                <th>Parameter</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Annual Income</td>
                <td>{formatCurrency(personalInfo.annualIncome)}</td>
                <td>Desired Monthly Income</td>
                <td>{formatCurrency(retirementGoals.desiredMonthlyIncome)}</td>
              </tr>
              <tr>
                <td>Equity Return</td>
                <td>{assumptions.equityReturn.toFixed(1)}%</td>
                <td>Bond Return</td>
                <td>{assumptions.bondReturn.toFixed(1)}%</td>
              </tr>
              <tr>
                <td>Cash Return</td>
                <td>{assumptions.cashReturn.toFixed(1)}%</td>
                <td>Inflation Rate</td>
                <td>{assumptions.inflationRate.toFixed(1)}%</td>
              </tr>
              <tr>
                <td>Legacy Amount</td>
                <td>{formatCurrency(retirementGoals.legacyAmount)}</td>
                <td>Compounding</td>
                <td style={{ textTransform: "capitalize" }}>{assumptions.compoundingMethod}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Accumulation phase — summary rows every 5 years */}
        <div className="section">
          <div className="section-title">
            Accumulation Phase (age {personalInfo.currentAge} – {personalInfo.retirementAge - 1})
          </div>
          <table>
            <thead>
              <tr>
                <th>Year</th>
                <th>Age</th>
                <th>Starting Balance</th>
                <th>Contributions</th>
                <th>Growth</th>
                <th>Fees</th>
                <th>Ending Balance</th>
              </tr>
            </thead>
            <tbody>
              {accumulationRows
                .filter((r, i) => i === 0 || i === accumulationRows.length - 1 || (r.age - personalInfo.currentAge) % 5 === 0)
                .map((r) => (
                  <tr key={r.year}>
                    <td>{r.year}</td>
                    <td>{r.age}</td>
                    <td>{f(r.startingBalance, r.age)}</td>
                    <td>{f(r.contributions, r.age)}</td>
                    <td>{f(r.growth, r.age)}</td>
                    <td>{f(r.fees, r.age)}</td>
                    <td style={{ fontWeight: 600 }}>{f(r.endingBalance, r.age)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Drawdown phase — all rows */}
        <div className="section">
          <div className="section-title">
            Drawdown Phase (age {personalInfo.retirementAge} – {personalInfo.lifeExpectancy})
          </div>
          <table>
            <thead>
              <tr>
                <th>Year</th>
                <th>Age</th>
                <th>Starting Balance</th>
                <th>Withdrawals</th>
                <th>Income Tax</th>
                <th>Net Income</th>
                <th>Growth</th>
                <th>Ending Balance</th>
              </tr>
            </thead>
            <tbody>
              {retirementRows.map((r) => (
                <tr key={r.year}>
                  <td>{r.year}</td>
                  <td>{r.age}</td>
                  <td>{f(r.startingBalance, r.age)}</td>
                  <td>{f(r.withdrawals, r.age)}</td>
                  <td>{f(r.incomeTax, r.age)}</td>
                  <td style={{ fontWeight: 600 }}>{f(r.netIncome, r.age)}</td>
                  <td>{f(r.growth, r.age)}</td>
                  <td style={{ fontWeight: 600, color: r.endingBalance <= 0 ? "#dc2626" : undefined }}>
                    {r.endingBalance <= 0 ? "Depleted" : f(r.endingBalance, r.age)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 24, fontSize: 9, color: "#9ca3af", borderTop: "1px solid #e5e7eb", paddingTop: 8 }}>
          SA Retirement Calculator — projections are illustrative and based on the assumptions above. Past returns do not
          guarantee future results. Consult a qualified financial adviser before making retirement decisions.
        </div>
      </div>
    </>
  )
}
