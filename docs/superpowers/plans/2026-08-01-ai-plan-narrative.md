# AI Plan Narrative Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Explain my plan" button on `/calculator/overview` that streams a plain-English narrative of the user's projection and success probability, framed as general education (never personalized directives), via a new API route backed by the Vercel AI Gateway.

**Architecture:** A pure payload/prompt-building module (`lib/ai/plan-narrative-prompt.ts`) turns the store's real inputs plus the already-computed projection/simulation into a system+user prompt. A thin Node.js Route Handler calls `streamText` through the AI Gateway and returns a plain-text stream. A client hook reads the stream, caches the last result, and applies a cooldown — no chat-oriented hooks, since this is a single-shot generation, not a conversation.

**Tech Stack:** Next.js 16 App Router (Node.js Route Handler, Fluid Compute default), `ai` package via Vercel AI Gateway, Zustand (`useCalculatorStore`), Vitest, pnpm.

**Spec:** `docs/superpowers/specs/2026-08-01-ai-plan-narrative-design.md`

## Global Constraints

- On-demand generation only — no automatic/background generation on page load or input change.
- The system prompt must always instruct general-education framing ("plans like this are typically most sensitive to X") and explicitly forbid second-person directives ("you should…") — this is a FAIS-liability requirement, not a style preference.
- Data sent to the model is the full scenario context (every account's type/balance/contribution/return/fees, personalInfo, retirementGoals, drawdownConfig) plus already-computed summary numbers (`portfolioAtRetirement`, `monthlyNetIncomeAtRetirement`, `portfolioDepletionAge`, `successRate`, `medianDepletionAge`) — **not** the full `yearlyProjections` array (irrelevant to the narrative and needlessly large).
- Streaming is token-by-token via `streamText(...).toTextStreamResponse()`. No `useChat`/`useCompletion`/`@ai-sdk/react` — this is a single-shot generation, not a chat.
- Caching: a single last-result cache keyed by the serialized payload (not a multi-entry cache). An unchanged payload replays the cached text for free. A successful (not failed) generation starts an 8-second cooldown on the button.
- This codebase has no React component/hook testing setup (no `@testing-library/react`, no `renderHook`). Payload-shaping and prompt-building logic is extracted into plain, framework-free functions and unit tested with Vitest; the Route Handler and the `usePlanNarrative` hook itself stay thin and untested, same treatment CLAUDE.md already gives to UI wiring.
- Package manager is `pnpm` (see `pnpm-lock.yaml` / `package.json` `"packageManager"` field) — install new dependencies with `pnpm add`, not `npm install`.
- Currency formatting goes through `formatCurrency` from `lib/utils/currency` — note its actual output has a space after "R" (`formatCurrency(0)` → `"R 0"`, not `"R0"`) — never a local formatter.
- Every new card section uses `PageCard` (`components/ui/page-card.tsx`), never raw `Card + CardHeader + CardTitle`.
- `npm run typecheck` must pass before committing (`next build` does not typecheck test files).
- Model selection: this plan was written on 2026-08-01, having queried `curl -s https://ai-gateway.vercel.sh/v1/models | jq -r '[.data[] | select(.id | startswith("anthropic/")) | .id] | reverse | .[]'`, which returned `anthropic/claude-sonnet-5` as the newest model. Task 2 uses that ID directly. If this plan is executed significantly later, re-run that query first and swap the ID if a newer one exists — do not assume it's still current.

---

### Task 1: Payload + prompt builder

**Files:**
- Create: `lib/ai/plan-narrative-prompt.ts`
- Test: `lib/ai/plan-narrative-prompt.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface PlanNarrativeAccount {
    type: AccountType
    currentBalance: number
    monthlyContribution: number
    expectedReturn: number
    annualFees: number
  }

  export interface PlanNarrativePayload {
    accounts: PlanNarrativeAccount[]
    personalInfo: PersonalInfo
    retirementGoals: RetirementGoals
    drawdownConfig: DrawdownConfig
    projection: {
      portfolioAtRetirement: number
      monthlyIncomeAtRetirement: number
      monthlyNetIncomeAtRetirement: number
      portfolioDepletionAge: number | null
    }
    simulation: {
      successRate: number
      medianDepletionAge: number | null
    } | null
  }

  export function buildPlanNarrativePayload(input: {
    accounts: Account[]
    personalInfo: PersonalInfo
    retirementGoals: RetirementGoals
    drawdownConfig: DrawdownConfig
    projection: ProjectionResult | null
    simulationResult: SimulationResult | null
  }): PlanNarrativePayload | null // null when there's no projection yet

  export function buildPlanNarrativePrompt(payload: PlanNarrativePayload): {
    system: string
    prompt: string
  }
  ```
  Task 2 (Route Handler) imports `buildPlanNarrativePrompt` and `PlanNarrativePayload`. Task 3 (hook) imports `buildPlanNarrativePayload` and `PlanNarrativePayload`. These names and shapes are final.

- [ ] **Step 1: Write the failing tests**

Create `lib/ai/plan-narrative-prompt.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import type { Account, PersonalInfo, RetirementGoals, DrawdownConfig, ProjectionResult, SimulationResult } from "@/types"
import { buildPlanNarrativePayload, buildPlanNarrativePrompt } from "./plan-narrative-prompt"

const personalInfo: PersonalInfo = {
  currentAge: 45,
  retirementAge: 65,
  lifeExpectancy: 90,
  annualIncome: 600000,
}

const retirementGoals: RetirementGoals = {
  desiredMonthlyIncome: 30000,
  inflationRate: 5.5,
  legacyAmount: 0,
}

const drawdownConfig: DrawdownConfig = {
  strategy: "fixed_percentage",
  initialWithdrawalRate: 4,
  minimumWithdrawal: 15000,
  maximumWithdrawal: 60000,
  lumpSumPercentage: 0,
}

const ra: Account = {
  id: "ra-1",
  name: "My RA",
  provider: "Test",
  type: "retirement_annuity",
  currentBalance: 800000,
  monthlyContribution: 5000,
  expectedReturn: 10,
  annualFees: 1,
  contributionEscalation: 5,
}

const tfsa: Account = {
  ...ra,
  id: "tfsa-1",
  name: "TFSA",
  type: "tfsa",
  monthlyContribution: 3000,
}

const zeroContributionDiscretionary: Account = {
  ...ra,
  id: "d-1",
  name: "Discretionary",
  type: "discretionary",
  monthlyContribution: 0,
}

function baseProjection(overrides: Partial<ProjectionResult> = {}): ProjectionResult {
  return {
    yearlyProjections: [],
    portfolioAtRetirement: 4200000,
    monthlyIncomeAtRetirement: 28000,
    monthlyNetIncomeAtRetirement: 25000,
    portfolioDepletionAge: null,
    shortfallAmount: 0,
    surplusAmount: 0,
    totalLifetimeIncomeTax: 0,
    totalLumpSumTax: 0,
    totalMedicalAidContributions: 0,
    averageEffectiveTaxRate: 0,
    lumpSumCommutation: {
      lumpSumPercentage: 0,
      lumpSumAmount: 0,
      taxableLumpSum: 0,
      lumpSumTax: 0,
      netLumpSum: 0,
      remainingPortfolio: 0,
      accumulatedExcessCredit: 0,
      creditAppliedToLumpSum: 0,
      creditCarriedIntoDrawdown: 0,
    },
    accumulatedExcessCredit: 0,
    accountBalancesAtRetirement: {},
    ...overrides,
  }
}

function baseSimulation(overrides: Partial<SimulationResult> = {}): SimulationResult {
  return {
    runs: [],
    successRate: 78,
    percentiles: { p10: [], p25: [], p50: [], p75: [], p90: [] },
    medianDepletionAge: null,
    averageFinalBalance: 4200000,
    ...overrides,
  }
}

describe("buildPlanNarrativePayload", () => {
  it("returns null when there is no projection yet", () => {
    const result = buildPlanNarrativePayload({
      accounts: [ra],
      personalInfo,
      retirementGoals,
      drawdownConfig,
      projection: null,
      simulationResult: null,
    })
    expect(result).toBeNull()
  })

  it("carries simulation as null when Monte Carlo hasn't run", () => {
    const result = buildPlanNarrativePayload({
      accounts: [ra],
      personalInfo,
      retirementGoals,
      drawdownConfig,
      projection: baseProjection(),
      simulationResult: null,
    })
    expect(result?.simulation).toBeNull()
  })
})

describe("buildPlanNarrativePrompt", () => {
  it("always includes the general-education, no-directives constraint", () => {
    const payload = buildPlanNarrativePayload({
      accounts: [ra],
      personalInfo,
      retirementGoals,
      drawdownConfig,
      projection: baseProjection(),
      simulationResult: baseSimulation(),
    })!
    const { system } = buildPlanNarrativePrompt(payload)
    expect(system).toContain("NEVER use second-person directives")
  })

  it("lists every account for a multi-account plan", () => {
    const payload = buildPlanNarrativePayload({
      accounts: [ra, tfsa],
      personalInfo,
      retirementGoals,
      drawdownConfig,
      projection: baseProjection(),
      simulationResult: baseSimulation(),
    })!
    const { prompt } = buildPlanNarrativePrompt(payload)
    expect(prompt).toContain("Retirement Annuity (RA)")
    expect(prompt).toContain("Tax-Free Savings Account (TFSA)")
  })

  it("describes a single-account plan without error", () => {
    const payload = buildPlanNarrativePayload({
      accounts: [ra],
      personalInfo,
      retirementGoals,
      drawdownConfig,
      projection: baseProjection(),
      simulationResult: baseSimulation(),
    })!
    const { prompt } = buildPlanNarrativePrompt(payload)
    expect(prompt).toContain("Retirement Annuity (RA)")
  })

  it("reports a 0% success probability plainly rather than omitting it", () => {
    const payload = buildPlanNarrativePayload({
      accounts: [ra],
      personalInfo,
      retirementGoals,
      drawdownConfig,
      projection: baseProjection({ portfolioDepletionAge: 78 }),
      simulationResult: baseSimulation({ successRate: 0 }),
    })!
    const { prompt } = buildPlanNarrativePrompt(payload)
    expect(prompt).toContain("0%")
    expect(prompt).toContain("funds running out at age 78")
  })

  it("still describes a plan where every account has R0 contribution", () => {
    const payload = buildPlanNarrativePayload({
      accounts: [zeroContributionDiscretionary],
      personalInfo,
      retirementGoals,
      drawdownConfig,
      projection: baseProjection(),
      simulationResult: baseSimulation(),
    })!
    const { prompt } = buildPlanNarrativePrompt(payload)
    expect(prompt).toContain("R 0/month contribution")
  })

  it("notes when Monte Carlo has not been run yet", () => {
    const payload = buildPlanNarrativePayload({
      accounts: [ra],
      personalInfo,
      retirementGoals,
      drawdownConfig,
      projection: baseProjection(),
      simulationResult: null,
    })!
    const { prompt } = buildPlanNarrativePrompt(payload)
    expect(prompt).toContain("has not been run")
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- plan-narrative-prompt`
Expected: FAIL — `plan-narrative-prompt.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `lib/ai/plan-narrative-prompt.ts`:

```ts
import type {
  Account,
  AccountType,
  PersonalInfo,
  RetirementGoals,
  DrawdownConfig,
  ProjectionResult,
  SimulationResult,
} from "@/types"
import { ACCOUNT_TYPE_LABELS, DRAWDOWN_STRATEGY_LABELS } from "@/types"
import { formatCurrency } from "@/lib/utils/currency"

export interface PlanNarrativeAccount {
  type: AccountType
  currentBalance: number
  monthlyContribution: number
  expectedReturn: number
  annualFees: number
}

export interface PlanNarrativePayload {
  accounts: PlanNarrativeAccount[]
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
  drawdownConfig: DrawdownConfig
  projection: {
    portfolioAtRetirement: number
    monthlyIncomeAtRetirement: number
    monthlyNetIncomeAtRetirement: number
    portfolioDepletionAge: number | null
  }
  simulation: {
    successRate: number
    medianDepletionAge: number | null
  } | null
}

interface BuildPayloadInput {
  accounts: Account[]
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
  drawdownConfig: DrawdownConfig
  projection: ProjectionResult | null
  simulationResult: SimulationResult | null
}

/** Reduces the real scenario down to what the narrative needs — not the full
 * yearlyProjections array, which is large and irrelevant to a plain-English summary. */
export function buildPlanNarrativePayload(input: BuildPayloadInput): PlanNarrativePayload | null {
  if (!input.projection) return null

  return {
    accounts: input.accounts.map((account) => ({
      type: account.type,
      currentBalance: account.currentBalance,
      monthlyContribution: account.monthlyContribution,
      expectedReturn: account.expectedReturn,
      annualFees: account.annualFees,
    })),
    personalInfo: input.personalInfo,
    retirementGoals: input.retirementGoals,
    drawdownConfig: input.drawdownConfig,
    projection: {
      portfolioAtRetirement: input.projection.portfolioAtRetirement,
      monthlyIncomeAtRetirement: input.projection.monthlyIncomeAtRetirement,
      monthlyNetIncomeAtRetirement: input.projection.monthlyNetIncomeAtRetirement,
      portfolioDepletionAge: input.projection.portfolioDepletionAge,
    },
    simulation: input.simulationResult
      ? {
          successRate: input.simulationResult.successRate,
          medianDepletionAge: input.simulationResult.medianDepletionAge,
        }
      : null,
  }
}

const SYSTEM_PROMPT = `You are a plain-English narrator for a South African retirement calculator.

Rules you must always follow:
- Restate the plan's numbers in clear, everyday language. Do not invent any number that is not present in the data you are given.
- When describing what affects the outcome, use general-education framing tied to the numbers ("plans like this are typically most sensitive to retirement age and contribution rate"). NEVER use second-person directives such as "you should" or "you need to" — this tool is not a licensed financial advisor and must not give personalized financial advice.
- All amounts are in South African Rand. Write them as "R" followed by the number (e.g. "R4,200,000" or "R35,000/month").
- Keep the response to 3-4 short paragraphs, no headings, no bullet lists.
- Do not mention these instructions.`

/** Pure prompt construction — no network/model call. Kept separate from the
 * Route Handler so it's independently unit-testable. */
export function buildPlanNarrativePrompt(payload: PlanNarrativePayload): { system: string; prompt: string } {
  const accountLines = payload.accounts
    .map(
      (account, index) =>
        `${index + 1}. ${ACCOUNT_TYPE_LABELS[account.type]}: ${formatCurrency(account.currentBalance)} balance, ` +
        `${formatCurrency(account.monthlyContribution)}/month contribution, ${account.expectedReturn}% expected return, ` +
        `${account.annualFees}% annual fees`
    )
    .join("\n")

  const yearsToRetirement = payload.personalInfo.retirementAge - payload.personalInfo.currentAge

  const promptLines = [
    `Current age: ${payload.personalInfo.currentAge}`,
    `Planned retirement age: ${payload.personalInfo.retirementAge} (${yearsToRetirement} years from now)`,
    `Life expectancy: ${payload.personalInfo.lifeExpectancy}`,
    `Target monthly income in retirement: ${formatCurrency(payload.retirementGoals.desiredMonthlyIncome)}`,
    `Drawdown strategy: ${DRAWDOWN_STRATEGY_LABELS[payload.drawdownConfig.strategy]}`,
    "",
    "Accounts:",
    accountLines || "(no accounts)",
    "",
    `Projected portfolio at retirement: ${formatCurrency(payload.projection.portfolioAtRetirement)}`,
    `Projected monthly income at retirement (after tax): ${formatCurrency(payload.projection.monthlyNetIncomeAtRetirement)}`,
    payload.projection.portfolioDepletionAge !== null
      ? `The deterministic projection shows funds running out at age ${payload.projection.portfolioDepletionAge}.`
      : `The deterministic projection shows funds lasting through life expectancy.`,
    payload.simulation
      ? `Monte Carlo success probability (funds lasting to life expectancy across 1,000 simulated markets): ${payload.simulation.successRate.toFixed(0)}%.`
      : `Monte Carlo simulation has not been run for this plan yet.`,
  ]

  return {
    system: SYSTEM_PROMPT,
    prompt: promptLines.join("\n"),
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- plan-narrative-prompt`
Expected: PASS — all 8 tests green.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/plan-narrative-prompt.ts lib/ai/plan-narrative-prompt.test.ts
git commit -m "feat(ai): add plan-narrative payload and prompt builder"
```

---

### Task 2: Route Handler via Vercel AI Gateway

**Files:**
- Create: `app/api/plan-narrative/route.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `buildPlanNarrativePrompt`, `PlanNarrativePayload` from Task 1.
- Produces: `POST /api/plan-narrative` — accepts a `PlanNarrativePayload` JSON body, returns a `text/plain` streamed response (the AI SDK's `toTextStreamResponse()` default). Task 3's hook reads this stream directly with `response.body.getReader()`.

**Before this task:** the Vercel AI Gateway's zero-data-retention setting should be confirmed/enabled in the Vercel dashboard for this project, given this feature sends more personal financial data (income, balances) to a third party than any existing feature. This is an account/dashboard-level setting, not something this task's code changes can enforce — flagging it here so it isn't skipped.

- [ ] **Step 1: Install the `ai` package**

Run: `pnpm add ai`
Expected: `ai` added to `package.json` dependencies, `pnpm-lock.yaml` updated.

- [ ] **Step 2: Add the Gateway API key to `.env.example`**

In `.env.example`, append:

```bash
# ── Vercel AI Gateway (AI plan narrative feature) ────────────────────────────
# Get a key from https://vercel.com/<team>/~/ai-gateway/api-keys — only needed
# for local development; Vercel deployments authenticate via OIDC instead.
AI_GATEWAY_API_KEY=
```

Then copy `.env.example` to `.env.local` (if not already done) and fill in a real key for local testing.

- [ ] **Step 3: Write the Route Handler**

Create `app/api/plan-narrative/route.ts`:

```ts
import { streamText } from "ai"
import { buildPlanNarrativePrompt, type PlanNarrativePayload } from "@/lib/ai/plan-narrative-prompt"

export async function POST(request: Request) {
  const payload = (await request.json()) as PlanNarrativePayload
  const { system, prompt } = buildPlanNarrativePrompt(payload)

  const result = streamText({
    model: "anthropic/claude-sonnet-5",
    system,
    prompt,
  })

  return result.toTextStreamResponse()
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Manual verification with curl**

Run: `npm run dev`, then in a second terminal:

```bash
curl -N -X POST http://localhost:3000/api/plan-narrative \
  -H "Content-Type: application/json" \
  -d '{
    "accounts": [{"type":"retirement_annuity","currentBalance":800000,"monthlyContribution":5000,"expectedReturn":10,"annualFees":1}],
    "personalInfo": {"currentAge":45,"retirementAge":65,"lifeExpectancy":90,"annualIncome":600000},
    "retirementGoals": {"desiredMonthlyIncome":30000,"inflationRate":5.5,"legacyAmount":0},
    "drawdownConfig": {"strategy":"fixed_percentage","initialWithdrawalRate":4,"minimumWithdrawal":15000,"maximumWithdrawal":60000,"lumpSumPercentage":0},
    "projection": {"portfolioAtRetirement":4200000,"monthlyIncomeAtRetirement":28000,"monthlyNetIncomeAtRetirement":25000,"portfolioDepletionAge":null},
    "simulation": {"successRate":78,"medianDepletionAge":null}
  }'
```

Expected: text streams to the terminal progressively (visible chunk-by-chunk with `-N`), reads as a plain-English 3-4 paragraph summary, contains no second-person directives ("you should…"), and mentions no numbers beyond what was in the request body.

- [ ] **Step 6: Commit**

```bash
git add app/api/plan-narrative/route.ts .env.example package.json pnpm-lock.yaml
git commit -m "feat(ai): add /api/plan-narrative Route Handler via Vercel AI Gateway"
```

---

### Task 3: Client hook + overview page card

**Files:**
- Create: `lib/hooks/use-plan-narrative.ts`
- Create: `components/dashboard/plan-narrative-card.tsx`
- Modify: `components/pages/overview-page.tsx`

**Interfaces:**
- Consumes: `buildPlanNarrativePayload`, `PlanNarrativePayload` from Task 1; `POST /api/plan-narrative` from Task 2; `useCalculatorStore` from `lib/store/calculator-store.ts`; `useCalculator` from `lib/context/calculator-context.tsx`; `PageCard`, `Button` from `components/ui/`.
- Produces: `usePlanNarrative(input)` → `{ text: string, isStreaming: boolean, error: string | null, cooldownRemaining: number, generate: () => void }`. `PlanNarrativeCard` — a no-props React component.

**Note on why `useCalculator()` is safe to use here (unlike the What-If panel):** `lib/context/calculator-context.tsx` only enables its internal `useMonteCarloWorker` call when `pathname === "/calculator/overview"`. `PlanNarrativeCard` only ever renders while mounted inside `overview-page.tsx`, which itself is only rendered when the pathname is exactly `/calculator/overview` — so `simulationResult` from context is guaranteed fresh at the moment this card is visible. No independent worker call is needed here.

- [ ] **Step 1: Write the hook**

Create `lib/hooks/use-plan-narrative.ts`:

```ts
"use client"

import { useCallback, useRef, useState } from "react"
import type { Account, PersonalInfo, RetirementGoals, DrawdownConfig, ProjectionResult, SimulationResult } from "@/types"
import { buildPlanNarrativePayload } from "@/lib/ai/plan-narrative-prompt"

interface UsePlanNarrativeInput {
  accounts: Account[]
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
  drawdownConfig: DrawdownConfig
  projection: ProjectionResult | null
  simulationResult: SimulationResult | null
}

const COOLDOWN_SECONDS = 8

export function usePlanNarrative(input: UsePlanNarrativeInput) {
  const [text, setText] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)

  const cacheRef = useRef<{ payloadJson: string; text: string } | null>(null)
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startCooldown = useCallback(() => {
    setCooldownRemaining(COOLDOWN_SECONDS)
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current)
    cooldownTimerRef.current = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const generate = useCallback(async () => {
    const payload = buildPlanNarrativePayload(input)
    if (!payload) return

    const payloadJson = JSON.stringify(payload)

    if (cacheRef.current && cacheRef.current.payloadJson === payloadJson) {
      setText(cacheRef.current.text)
      setError(null)
      return
    }

    setError(null)
    setIsStreaming(true)
    setText("")

    try {
      const response = await fetch("/api/plan-narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payloadJson,
      })

      if (!response.ok || !response.body) {
        throw new Error("Request failed")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullText += decoder.decode(value, { stream: true })
        setText(fullText)
      }

      cacheRef.current = { payloadJson, text: fullText }
      startCooldown()
    } catch {
      setError("Couldn't generate a summary right now. Please try again.")
    } finally {
      setIsStreaming(false)
    }
  }, [input, startCooldown])

  return { text, isStreaming, error, cooldownRemaining, generate }
}
```

- [ ] **Step 2: Write the card component**

Create `components/dashboard/plan-narrative-card.tsx`:

```tsx
"use client"

import { useShallow } from "zustand/react/shallow"
import { PageCard } from "@/components/ui/page-card"
import { Button } from "@/components/ui/button"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { useCalculator } from "@/lib/context/calculator-context"
import { usePlanNarrative } from "@/lib/hooks/use-plan-narrative"
import { Sparkles } from "lucide-react"

export function PlanNarrativeCard() {
  const { accounts, personalInfo, retirementGoals, drawdownConfig } = useCalculatorStore(
    useShallow((state) => ({
      accounts: state.accounts,
      personalInfo: state.personalInfo,
      retirementGoals: state.retirementGoals,
      drawdownConfig: state.drawdownConfig,
    }))
  )
  const { projection, simulationResult } = useCalculator()

  const { text, isStreaming, error, cooldownRemaining, generate } = usePlanNarrative({
    accounts,
    personalInfo,
    retirementGoals,
    drawdownConfig,
    projection,
    simulationResult,
  })

  if (accounts.length === 0 || !projection) return null

  const buttonLabel = isStreaming
    ? "Generating…"
    : cooldownRemaining > 0
      ? `Try again in ${cooldownRemaining}s`
      : text
        ? "Regenerate"
        : "Explain my plan"

  return (
    <PageCard
      label="Explain My Plan"
      leading={<Sparkles className="h-4 w-4 text-primary" />}
      contentClassName="space-y-3"
    >
      {text && <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        variant={text ? "outline" : "default"}
        size="sm"
        onClick={generate}
        disabled={isStreaming || cooldownRemaining > 0}
      >
        {buttonLabel}
      </Button>

      <p className="text-xs text-muted-foreground">
        Generating uses AI and sends your plan&apos;s numbers to our AI provider. This is an automated
        educational summary, not financial advice — consult a licensed financial advisor before making
        decisions.
      </p>
    </PageCard>
  )
}
```

- [ ] **Step 3: Wire it into the overview page**

In `components/pages/overview-page.tsx`, add the import and render `<PlanNarrativeCard />` as the last element in the page:

```tsx
"use client"

import { DashboardMetricsGrid } from "@/components/dashboard/dashboard-metrics-grid"
import { GettingStarted } from "@/components/dashboard/getting-started"
import { KeyInsightsSummary } from "@/components/dashboard/key-insights-summary"
import { PlanNarrativeCard } from "@/components/dashboard/plan-narrative-card"
import { MonteCarloChart } from "@/components/charts/monte-carlo-chart"
import { PortfolioGrowthChart } from "@/components/charts/portfolio-growth-chart"
import type { ProjectionResult, SimulationResult } from "@/types"

interface OverviewPageProps {
  projection: ProjectionResult | null
  simulationResult: SimulationResult | null
  isSimulating: boolean
  retirementAge: number
  currentAge: number
  lifeExpectancy: number
  inflationRate: number
  totalCurrentBalance: number
  totalMonthlyContributions: number
  desiredMonthlyIncome: number
  annualIncome: number
}

export function OverviewPage({
  projection,
  simulationResult,
  isSimulating,
  retirementAge,
  currentAge,
  lifeExpectancy,
  inflationRate,
  totalCurrentBalance,
  totalMonthlyContributions,
  desiredMonthlyIncome,
  annualIncome,
}: OverviewPageProps) {
  return (
    <div className="space-y-6">
      <DashboardMetricsGrid
        projection={projection}
        simulationResult={simulationResult}
        isSimulating={isSimulating}
        retirementAge={retirementAge}
        currentAge={currentAge}
        lifeExpectancy={lifeExpectancy}
        inflationRate={inflationRate}
        totalCurrentBalance={totalCurrentBalance}
        totalMonthlyContributions={totalMonthlyContributions}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <PortfolioGrowthChart
          projections={projection?.yearlyProjections || []}
          retirementAge={retirementAge}
        />
        <MonteCarloChart
          simulationResult={simulationResult}
          currentAge={currentAge}
          retirementAge={retirementAge}
          isRunning={isSimulating}
        />
      </div>

      {projection ? (
        <KeyInsightsSummary
          projection={projection}
          currentAge={currentAge}
          retirementAge={retirementAge}
          lifeExpectancy={lifeExpectancy}
          currentMonthlyIncome={annualIncome / 12}
          desiredMonthlyIncome={desiredMonthlyIncome}
          inflationRate={inflationRate}
          monteCarloSuccessRate={simulationResult?.successRate}
        />
      ) : (
        <GettingStarted />
      )}

      <PlanNarrativeCard />
    </div>
  )
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Manual verification in the browser**

Ensure `AI_GATEWAY_API_KEY` is set in `.env.local` (see Task 2, Step 2), then:

Run: `npm run dev`

In the browser, navigate to `/calculator/overview` with at least one account set up:

1. Confirm the "Explain My Plan" card renders at the bottom of the page, with an "Explain my plan" button and the disclaimer text visible underneath (before generating, not just after).
2. Click the button — confirm text streams in progressively rather than appearing all at once.
3. Confirm the response contains no second-person directives ("you should…") and no numbers that don't trace back to the plan.
4. Click "Regenerate" immediately after a successful generation — confirm the button is disabled and shows "Try again in Ns" counting down, then becomes clickable again after ~8 seconds.
5. Click "Regenerate" without changing any inputs — confirm the cached text reappears instantly with no new network request (check the Network tab).
6. Change an input (e.g. an account's contribution on `/calculator/accounts`), return to the overview page, click "Regenerate" — confirm it makes a fresh request (cache miss) and the new narrative reflects the changed numbers.
7. Temporarily stop the local Supabase/dev server mid-request or block the `/api/plan-narrative` request in DevTools — confirm the error state ("Couldn't generate a summary right now…") renders instead of a silent failure, and that a failed attempt does not start the cooldown.
8. Remove all accounts — confirm the card disappears entirely.

- [ ] **Step 6: Run the full test suite and build**

Run: `npm run test && npm run typecheck && npm run build`
Expected: all pass, no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/hooks/use-plan-narrative.ts components/dashboard/plan-narrative-card.tsx components/pages/overview-page.tsx
git commit -m "feat(overview): add AI plan narrative card"
```
