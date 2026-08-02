# What-If Sensitivity Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "What If" panel to `/calculator/projections` where four sliders (retirement age, contribution, return, target income) preview outcomes via the real deterministic and Monte Carlo engines, without touching the saved plan until the user clicks "Apply to plan."

**Architecture:** A pure transform function (`applySensitivityDeltas`) maps the real store's accounts/personalInfo/retirementGoals plus a local `SensitivityDeltas` state into scaled copies, which get fed unmodified into the existing `calculateProjection` and `useMonteCarloWorker`. No calculation logic is duplicated; the panel is a new self-contained client component that reads the store directly, matching the existing `insights-panel.tsx` pattern.

**Tech Stack:** Next.js App Router, TypeScript, Zustand (`useCalculatorStore`), shadcn `Slider`/`Button`/`Card`, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-01-sensitivity-slider-design.md`

## Global Constraints

- Reuse `calculateProjection` (`lib/calculations/projection-engine.ts`) and `useMonteCarloWorker` (`lib/monte-carlo/use-monte-carlo-worker.ts`) unmodified — never duplicate calculation logic (CLAUDE.md "Never copy calculation logic").
- All calculation-code changes require unit tests (CLAUDE.md rule 1). This codebase has no component-level test setup (no React Testing Library installed) — UI components are verified manually via the dev server, not with automated tests. `applySensitivityDeltas` is calculation-adjacent and gets full unit tests; the `WhatIfPanel` component does not.
- Sandbox state (`deltas`) is local `useState` inside `WhatIfPanel` — never written to `calculator-store.ts` or Supabase until "Apply to plan" is clicked.
- Contribution scaling applies the same percentage to every account with `monthlyContribution > 0`; accounts already at R0 stay untouched (a percentage can't move a base of zero).
- `expectedReturn` and `monthlyContribution` are floored at 0 after scaling — never negative.
- `retirementAge` is clamped to `currentAge + 1 ≤ retirementAge ≤ lifeExpectancy` after applying the offset.
- Slider ranges: retirement age offset -10..+15 years, contribution scale -100%..+200%, return delta -5..+5 percentage points, target income ±50% of the real `retirementGoals.desiredMonthlyIncome` (rand-denominated, not a percentage).
- Every new card section uses `PageCard`/`SectionLabel` (`components/ui/page-card.tsx`) — never raw `Card + CardHeader + CardTitle`. Cards get `shadow-none` (PageCard applies this automatically).
- Currency formatting goes through `formatCurrency`/`formatCurrencyCompact` from `lib/utils/currency` — never a local formatter.
- Colors use semantic tokens only (e.g. `text-chart-2`, `text-destructive`, `text-warning`) — never hardcoded Tailwind colors like `text-green-600`.
- `npm run typecheck` must pass before committing (`next build` does not typecheck test files — see CLAUDE.md).

---

### Task 1: `applySensitivityDeltas` pure transform + tests

**Files:**
- Create: `lib/calculations/utils/apply-sensitivity-deltas.ts`
- Test: `lib/calculations/utils/apply-sensitivity-deltas.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface SensitivityDeltas {
    retirementAgeOffset: number
    contributionScalePct: number
    returnDeltaPts: number
    targetMonthlyIncomeOverride: number | null
  }

  export const DEFAULT_SENSITIVITY_DELTAS: SensitivityDeltas

  export function applySensitivityDeltas(
    accounts: Account[],
    personalInfo: PersonalInfo,
    retirementGoals: RetirementGoals,
    deltas: SensitivityDeltas
  ): {
    accounts: Account[]
    personalInfo: PersonalInfo
    retirementGoals: RetirementGoals
  }
  ```
  Task 2 imports `applySensitivityDeltas`, `SensitivityDeltas`, and `DEFAULT_SENSITIVITY_DELTAS` from this file — the names and shapes above are final.

- [ ] **Step 1: Write the failing tests**

Create `lib/calculations/utils/apply-sensitivity-deltas.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import type { Account, PersonalInfo, RetirementGoals } from "@/types"
import {
  applySensitivityDeltas,
  DEFAULT_SENSITIVITY_DELTAS,
  type SensitivityDeltas,
} from "./apply-sensitivity-deltas"

const personalInfo: PersonalInfo = {
  currentAge: 40,
  retirementAge: 60,
  lifeExpectancy: 90,
  annualIncome: 600000,
}

const retirementGoals: RetirementGoals = {
  desiredMonthlyIncome: 30000,
  inflationRate: 5.5,
  legacyAmount: 0,
}

const ra: Account = {
  id: "ra-1",
  name: "My RA",
  provider: "Test",
  type: "retirement_annuity",
  currentBalance: 500000,
  monthlyContribution: 4000,
  expectedReturn: 10,
  annualFees: 1,
  contributionEscalation: 5,
}

const tfsa: Account = {
  ...ra,
  id: "tfsa-1",
  name: "TFSA",
  type: "tfsa",
  monthlyContribution: 2000,
}

const zeroContributionDiscretionary: Account = {
  ...ra,
  id: "d-1",
  name: "Discretionary",
  type: "discretionary",
  monthlyContribution: 0,
}

function deltas(overrides: Partial<SensitivityDeltas>): SensitivityDeltas {
  return { ...DEFAULT_SENSITIVITY_DELTAS, ...overrides }
}

describe("applySensitivityDeltas", () => {
  describe("Critical SA scenarios", () => {
    it("is a no-op when all deltas are at default", () => {
      const result = applySensitivityDeltas(
        [ra, tfsa],
        personalInfo,
        retirementGoals,
        DEFAULT_SENSITIVITY_DELTAS
      )
      expect(result.personalInfo).toEqual(personalInfo)
      expect(result.retirementGoals).toEqual(retirementGoals)
      expect(result.accounts).toEqual([ra, tfsa])
    })

    it("scales every nonzero-contribution account by the same percentage, preserving relative share", () => {
      const result = applySensitivityDeltas(
        [ra, tfsa],
        personalInfo,
        retirementGoals,
        deltas({ contributionScalePct: 20 })
      )
      expect(result.accounts[0].monthlyContribution).toBeCloseTo(4800, 2) // 4000 * 1.2
      expect(result.accounts[1].monthlyContribution).toBeCloseTo(2400, 2) // 2000 * 1.2
    })

    it("leaves R0-contribution accounts untouched while a sibling nonzero account absorbs the scale", () => {
      const result = applySensitivityDeltas(
        [ra, zeroContributionDiscretionary],
        personalInfo,
        retirementGoals,
        deltas({ contributionScalePct: 50 })
      )
      expect(result.accounts[0].monthlyContribution).toBeCloseTo(6000, 2) // 4000 * 1.5
      expect(result.accounts[1].monthlyContribution).toBe(0)
    })

    it("scales a single account 1:1", () => {
      const result = applySensitivityDeltas(
        [ra],
        personalInfo,
        retirementGoals,
        deltas({ contributionScalePct: 10 })
      )
      expect(result.accounts[0].monthlyContribution).toBeCloseTo(4400, 2)
    })

    it("overrides target monthly income directly when set", () => {
      const result = applySensitivityDeltas(
        [ra],
        personalInfo,
        retirementGoals,
        deltas({ targetMonthlyIncomeOverride: 25000 })
      )
      expect(result.retirementGoals.desiredMonthlyIncome).toBe(25000)
    })

    it("adds the return delta on top of the account's existing expected return", () => {
      const result = applySensitivityDeltas([ra], personalInfo, retirementGoals, deltas({ returnDeltaPts: 2 }))
      expect(result.accounts[0].expectedReturn).toBe(12)
    })
  })

  describe("Edge cases", () => {
    it("floors contribution at R0 instead of going negative", () => {
      const result = applySensitivityDeltas(
        [ra],
        personalInfo,
        retirementGoals,
        deltas({ contributionScalePct: -150 })
      )
      expect(result.accounts[0].monthlyContribution).toBe(0)
    })

    it("floors expectedReturn at 0% instead of going negative", () => {
      const result = applySensitivityDeltas([ra], personalInfo, retirementGoals, deltas({ returnDeltaPts: -20 }))
      expect(result.accounts[0].expectedReturn).toBe(0)
    })

    it("clamps retirement age offset so it never drops to or below current age", () => {
      const result = applySensitivityDeltas(
        [ra],
        personalInfo,
        retirementGoals,
        deltas({ retirementAgeOffset: -30 })
      )
      expect(result.personalInfo.retirementAge).toBe(personalInfo.currentAge + 1)
    })

    it("clamps retirement age offset so it never exceeds life expectancy", () => {
      const result = applySensitivityDeltas(
        [ra],
        personalInfo,
        retirementGoals,
        deltas({ retirementAgeOffset: 100 })
      )
      expect(result.personalInfo.retirementAge).toBe(personalInfo.lifeExpectancy)
    })

    it("handles an empty accounts array", () => {
      const result = applySensitivityDeltas(
        [],
        personalInfo,
        retirementGoals,
        deltas({ contributionScalePct: 20, returnDeltaPts: 2 })
      )
      expect(result.accounts).toEqual([])
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- apply-sensitivity-deltas`
Expected: FAIL — `apply-sensitivity-deltas.ts` does not exist yet (module not found).

- [ ] **Step 3: Write the implementation**

Create `lib/calculations/utils/apply-sensitivity-deltas.ts`:

```ts
import type { Account, PersonalInfo, RetirementGoals } from "@/types"

export interface SensitivityDeltas {
  retirementAgeOffset: number // years, default 0
  contributionScalePct: number // %, default 0 = no change
  returnDeltaPts: number // percentage points, default 0
  targetMonthlyIncomeOverride: number | null // null = use real value
}

export const DEFAULT_SENSITIVITY_DELTAS: SensitivityDeltas = {
  retirementAgeOffset: 0,
  contributionScalePct: 0,
  returnDeltaPts: 0,
  targetMonthlyIncomeOverride: null,
}

interface AppliedSensitivity {
  accounts: Account[]
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Pure transform: applies sandbox deltas to the real plan's inputs, producing
 * scaled copies to feed into the existing calculateProjection /
 * runMonteCarloSimulation engines unmodified. No calculation logic lives here.
 */
export function applySensitivityDeltas(
  accounts: Account[],
  personalInfo: PersonalInfo,
  retirementGoals: RetirementGoals,
  deltas: SensitivityDeltas
): AppliedSensitivity {
  const scaledPersonalInfo: PersonalInfo = {
    ...personalInfo,
    retirementAge: clamp(
      personalInfo.retirementAge + deltas.retirementAgeOffset,
      personalInfo.currentAge + 1,
      personalInfo.lifeExpectancy
    ),
  }

  const scaledRetirementGoals: RetirementGoals = {
    ...retirementGoals,
    desiredMonthlyIncome: deltas.targetMonthlyIncomeOverride ?? retirementGoals.desiredMonthlyIncome,
  }

  const scaledAccounts: Account[] = accounts.map((account) => {
    const scaledReturn = Math.max(0, account.expectedReturn + deltas.returnDeltaPts)

    if (account.monthlyContribution <= 0) {
      return { ...account, expectedReturn: scaledReturn }
    }

    const scaledContribution = Math.max(
      0,
      account.monthlyContribution * (1 + deltas.contributionScalePct / 100)
    )

    return {
      ...account,
      expectedReturn: scaledReturn,
      monthlyContribution: scaledContribution,
    }
  })

  return {
    accounts: scaledAccounts,
    personalInfo: scaledPersonalInfo,
    retirementGoals: scaledRetirementGoals,
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- apply-sensitivity-deltas`
Expected: PASS — all 11 tests green.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/calculations/utils/apply-sensitivity-deltas.ts lib/calculations/utils/apply-sensitivity-deltas.test.ts
git commit -m "feat(calculations): add applySensitivityDeltas transform for What-If panel"
```

---

### Task 2: `WhatIfPanel` component + wire into Projections page

**Files:**
- Create: `components/results/what-if-panel.tsx`
- Modify: `components/pages/projections-page.tsx`

**Interfaces:**
- Consumes: `applySensitivityDeltas`, `SensitivityDeltas`, `DEFAULT_SENSITIVITY_DELTAS` from Task 1 (`lib/calculations/utils/apply-sensitivity-deltas.ts`); `calculateProjection` from `lib/calculations/projection-engine.ts`; `useMonteCarloWorker` from `lib/monte-carlo/use-monte-carlo-worker.ts`; `useCalculatorStore` from `lib/store/calculator-store.ts`; `formatCurrency`/`formatCurrencyCompact` from `lib/utils/currency.ts`; `PageCard`, `Button`, `Slider` from `components/ui/`.
- Produces: `WhatIfPanel` — a no-props React component, exported from `components/results/what-if-panel.tsx`.

**Note on the "vs your current plan" baseline:** `lib/context/calculator-context.tsx` only enables its `useMonteCarloWorker` call when `pathname === "/calculator/overview"`, so the app-wide `simulationResult` context value can be stale/frozen on other pages. To avoid depending on that, `WhatIfPanel` computes its own baseline (unscaled) Monte Carlo result directly, alongside its own sandbox (scaled) result — two independent `useMonteCarloWorker` calls in this component, each managing its own worker.

- [ ] **Step 1: Write the component**

Create `components/results/what-if-panel.tsx`:

```tsx
"use client"

import { useDeferredValue, useMemo, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { PageCard } from "@/components/ui/page-card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { calculateProjection } from "@/lib/calculations/projection-engine"
import { useMonteCarloWorker } from "@/lib/monte-carlo/use-monte-carlo-worker"
import {
  applySensitivityDeltas,
  DEFAULT_SENSITIVITY_DELTAS,
  type SensitivityDeltas,
} from "@/lib/calculations/utils/apply-sensitivity-deltas"
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils/currency"
import { cn } from "@/lib/utils"

function isAtDefault(deltas: SensitivityDeltas): boolean {
  return (
    deltas.retirementAgeOffset === DEFAULT_SENSITIVITY_DELTAS.retirementAgeOffset &&
    deltas.contributionScalePct === DEFAULT_SENSITIVITY_DELTAS.contributionScalePct &&
    deltas.returnDeltaPts === DEFAULT_SENSITIVITY_DELTAS.returnDeltaPts &&
    deltas.targetMonthlyIncomeOverride === DEFAULT_SENSITIVITY_DELTAS.targetMonthlyIncomeOverride
  )
}

export function WhatIfPanel() {
  const {
    accounts,
    personalInfo,
    retirementGoals,
    assumptions,
    drawdownConfig,
    setPersonalInfo,
    setRetirementGoals,
    updateAccount,
  } = useCalculatorStore(
    useShallow((state) => ({
      accounts: state.accounts,
      personalInfo: state.personalInfo,
      retirementGoals: state.retirementGoals,
      assumptions: state.assumptions,
      drawdownConfig: state.drawdownConfig,
      setPersonalInfo: state.setPersonalInfo,
      setRetirementGoals: state.setRetirementGoals,
      updateAccount: state.updateAccount,
    }))
  )

  const [deltas, setDeltas] = useState<SensitivityDeltas>(DEFAULT_SENSITIVITY_DELTAS)

  // Instant (deterministic) side: recomputed synchronously on every drag tick.
  const {
    accounts: scaledAccounts,
    personalInfo: scaledPersonalInfo,
    retirementGoals: scaledRetirementGoals,
  } = useMemo(
    () => applySensitivityDeltas(accounts, personalInfo, retirementGoals, deltas),
    [accounts, personalInfo, retirementGoals, deltas]
  )

  const baselineProjection = useMemo(
    () =>
      accounts.length === 0
        ? null
        : calculateProjection(accounts, personalInfo, retirementGoals, drawdownConfig, assumptions),
    [accounts, personalInfo, retirementGoals, drawdownConfig, assumptions]
  )

  const sandboxProjection = useMemo(
    () =>
      accounts.length === 0
        ? null
        : calculateProjection(scaledAccounts, scaledPersonalInfo, scaledRetirementGoals, drawdownConfig, assumptions),
    [scaledAccounts, scaledPersonalInfo, scaledRetirementGoals, drawdownConfig, assumptions, accounts.length]
  )

  // Debounced (Monte Carlo) side: baseline uses the real plan directly; sandbox
  // uses deferred deltas so rapid dragging doesn't spam the worker.
  const { simulationResult: baselineSimulation } = useMonteCarloWorker(
    accounts,
    personalInfo,
    retirementGoals,
    drawdownConfig,
    1000,
    assumptions,
    accounts.length > 0
  )

  const deferredDeltas = useDeferredValue(deltas)
  const {
    accounts: mcAccounts,
    personalInfo: mcPersonalInfo,
    retirementGoals: mcRetirementGoals,
  } = useMemo(
    () => applySensitivityDeltas(accounts, personalInfo, retirementGoals, deferredDeltas),
    [accounts, personalInfo, retirementGoals, deferredDeltas]
  )
  const { simulationResult: sandboxSimulation, isRunning: isSandboxSimulating } = useMonteCarloWorker(
    mcAccounts,
    mcPersonalInfo,
    mcRetirementGoals,
    drawdownConfig,
    1000,
    assumptions,
    accounts.length > 0
  )

  const handleReset = () => setDeltas(DEFAULT_SENSITIVITY_DELTAS)

  const handleApply = () => {
    setPersonalInfo({ retirementAge: scaledPersonalInfo.retirementAge })
    setRetirementGoals({ desiredMonthlyIncome: scaledRetirementGoals.desiredMonthlyIncome })
    scaledAccounts.forEach((scaledAccount, index) => {
      const original = accounts[index]
      if (
        scaledAccount.monthlyContribution !== original.monthlyContribution ||
        scaledAccount.expectedReturn !== original.expectedReturn
      ) {
        updateAccount(scaledAccount.id, {
          monthlyContribution: scaledAccount.monthlyContribution,
          expectedReturn: scaledAccount.expectedReturn,
        })
      }
    })
    setDeltas(DEFAULT_SENSITIVITY_DELTAS)
  }

  if (accounts.length === 0) return null

  const atDefault = isAtDefault(deltas)

  const totalScaledContribution = scaledAccounts.reduce((sum, acc) => sum + acc.monthlyContribution, 0)
  const totalBalance = scaledAccounts.reduce((sum, acc) => sum + acc.currentBalance, 0)
  const weightedReturn =
    totalBalance === 0
      ? 0
      : scaledAccounts.reduce((sum, acc) => sum + acc.expectedReturn * acc.currentBalance, 0) / totalBalance

  const nestEggDelta =
    (sandboxProjection?.portfolioAtRetirement ?? 0) - (baselineProjection?.portfolioAtRetirement ?? 0)
  const successRateDelta =
    sandboxSimulation && baselineSimulation ? sandboxSimulation.successRate - baselineSimulation.successRate : null

  return (
    <PageCard
      label="What If"
      description="Drag the sliders to preview outcomes without changing your saved plan."
      contentClassName="space-y-6"
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">Retirement age: {scaledPersonalInfo.retirementAge}</label>
            <Slider
              value={[deltas.retirementAgeOffset]}
              min={-10}
              max={15}
              step={1}
              onValueChange={([value]) => setDeltas((d) => ({ ...d, retirementAgeOffset: value }))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Monthly contribution: {formatCurrency(totalScaledContribution)}
            </label>
            <Slider
              value={[deltas.contributionScalePct]}
              min={-100}
              max={200}
              step={5}
              onValueChange={([value]) => setDeltas((d) => ({ ...d, contributionScalePct: value }))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Expected return: {weightedReturn.toFixed(1)}%</label>
            <Slider
              value={[deltas.returnDeltaPts]}
              min={-5}
              max={5}
              step={0.5}
              onValueChange={([value]) => setDeltas((d) => ({ ...d, returnDeltaPts: value }))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Target monthly income: {formatCurrency(scaledRetirementGoals.desiredMonthlyIncome)}
            </label>
            <Slider
              value={[deltas.targetMonthlyIncomeOverride ?? retirementGoals.desiredMonthlyIncome]}
              min={retirementGoals.desiredMonthlyIncome * 0.5}
              max={retirementGoals.desiredMonthlyIncome * 1.5}
              step={500}
              onValueChange={([value]) => setDeltas((d) => ({ ...d, targetMonthlyIncomeOverride: value }))}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={handleReset} disabled={atDefault}>
              Reset
            </Button>
            <Button size="sm" onClick={handleApply} disabled={atDefault}>
              Apply to plan
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Projected nest egg at retirement</p>
            <p className="text-2xl font-bold font-mono">
              {formatCurrency(sandboxProjection?.portfolioAtRetirement ?? 0)}
            </p>
            {!atDefault && nestEggDelta !== 0 && (
              <p className={cn("text-xs", nestEggDelta > 0 ? "text-chart-2" : "text-destructive")}>
                {nestEggDelta > 0 ? "+" : "-"}
                {formatCurrencyCompact(Math.abs(nestEggDelta))} vs your current plan
              </p>
            )}
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Success probability</p>
            {isSandboxSimulating ? (
              <div className="h-7 w-16 rounded bg-muted animate-pulse" />
            ) : (
              <p className="text-2xl font-bold font-mono">
                {sandboxSimulation ? `${sandboxSimulation.successRate.toFixed(0)}%` : "—"}
              </p>
            )}
            {!atDefault && successRateDelta !== null && (
              <p className={cn("text-xs", successRateDelta >= 0 ? "text-chart-2" : "text-destructive")}>
                {successRateDelta >= 0 ? "+" : ""}
                {successRateDelta.toFixed(0)}pts vs your current plan
              </p>
            )}
          </div>
        </div>
      </div>
    </PageCard>
  )
}
```

- [ ] **Step 2: Wire it into the Projections page**

In `components/pages/projections-page.tsx`, add the import and render `<WhatIfPanel />` between `<ProjectionSummary ... />` and `<InsightsPanel />`:

```tsx
import { InsightsPanel } from "@/components/results/insights-panel"
import { CalculationsBreakdown } from "@/components/results/calculations-breakdown"
import { ProjectionSummary } from "@/components/results/projection-summary"
import { WhatIfPanel } from "@/components/results/what-if-panel"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import type { ProjectionResult, SimulationResult } from "@/types"

interface ProjectionsPageProps {
  projection: ProjectionResult | null
  simulationResult: SimulationResult | null
  isSimulating?: boolean
}

export function ProjectionsPage({ projection, simulationResult, isSimulating }: ProjectionsPageProps) {
  const { personalInfo, retirementGoals } = useCalculatorStore()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Projections</h1>
        <p className="text-sm text-muted-foreground">Your retirement outlook based on current inputs</p>
      </div>

      <ProjectionSummary
        projection={projection}
        retirementAge={personalInfo.retirementAge}
        currentAge={personalInfo.currentAge}
        lifeExpectancy={personalInfo.lifeExpectancy}
        inflationRate={retirementGoals.inflationRate}
        simulationResult={simulationResult}
        isSimulating={isSimulating}
      />

      <WhatIfPanel />

      <InsightsPanel />
      <CalculationsBreakdown projection={projection} />
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manual verification in the browser**

Run: `npm run dev`

In the browser, navigate to `/calculator/projections` with at least one account already set up (use the seeded defaults or `/calculator/accounts` to add one):

1. Confirm the "What If" card renders below the plan success summary, with four sliders and two live numbers on the right.
2. Drag the retirement age slider — confirm the age label and "Projected nest egg" number update instantly.
3. Wait ~1 second after dragging any slider — confirm "Success probability" updates (it may briefly pulse while the debounced Monte Carlo run is in flight).
4. Confirm the "vs your current plan" delta lines appear once any slider has moved, and disappear again after clicking Reset.
5. Drag a slider, click **Apply to plan** — confirm `/calculator/accounts` and `/calculator/plan` now reflect the changed values, and the What-If sliders reset to default (deltas cleared) since the sandbox now matches the real plan.
6. Set all accounts' contributions to R0 temporarily (or remove all accounts) — confirm the panel disappears entirely rather than rendering with broken/empty state.
7. Open the Debug Window (per CLAUDE.md) and confirm the real plan's numbers are unaffected by dragging What-If sliders without clicking Apply.

- [ ] **Step 5: Run the full test suite and build**

Run: `npm run test && npm run typecheck && npm run build`
Expected: all pass, no errors.

- [ ] **Step 6: Commit**

```bash
git add components/results/what-if-panel.tsx components/pages/projections-page.tsx
git commit -m "feat(projections): add What-If sensitivity panel"
```
