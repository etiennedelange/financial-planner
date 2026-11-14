import { describe, expect, it } from "vite-plus/test"
import { calculateProjection } from "@/lib/calculations/projection-engine"
import { SA_TAX_LIMITS } from "@/lib/constants/limits"
import { INCOME_TAX_BRACKETS_CONFIG, TAX_YEAR } from "@/lib/constants/tax-year.config"
import { formatCurrency } from "@/lib/utils/currency"
import { SA_DEFAULTS_DISPLAY } from "@/lib/constants/defaults"
import type {
  Account,
  DrawdownConfig,
  MarketAssumptions,
  PersonalInfo,
  ProjectionResult,
  RetirementGoals,
  SimulationResult,
} from "@/types"
import {
  MIN_RETIREMENT_ACCESS_AGE,
  buildDebugModel,
  checkToText,
  describeDepletion,
  filterChecks,
  filterSections,
  summarizeChecks,
  tfsaLimitsBind,
  toDebugText,
  type ReconciliationCheck,
  type DebugInput,
  type DebugModel,
} from "./debug-model"

const ra: Account = {
  id: "1",
  name: "RA",
  type: "retirement_annuity",
  provider: "P",
  currentBalance: 900000,
  monthlyContribution: 6000,
  expectedReturn: 11,
  annualFees: 1.2,
  contributionEscalation: 6,
}
const discretionary: Account = {
  id: "3",
  name: "Discretionary",
  type: "discretionary",
  provider: "P",
  currentBalance: 400000,
  monthlyContribution: 2000,
  expectedReturn: 9,
  annualFees: 1,
  contributionEscalation: 5,
}
const smallTfsa: Account = {
  id: "2",
  name: "TFSA",
  type: "tfsa",
  provider: "P",
  currentBalance: 50000,
  monthlyContribution: 1000,
  expectedReturn: 10,
  annualFees: 0.8,
  contributionEscalation: 0,
}

const personalInfo: PersonalInfo = {
  currentAge: 40,
  retirementAge: 65,
  lifeExpectancy: 90,
  annualIncome: 750000,
}
const retirementGoals: RetirementGoals = {
  desiredMonthlyIncome: 35000,
  inflationRate: 5.5,
  legacyAmount: 0,
}
const drawdownConfig: DrawdownConfig = {
  strategy: "fixed_percentage",
  initialWithdrawalRate: 4,
  minimumWithdrawal: 10000,
  maximumWithdrawal: 200000,
  lumpSumPercentage: 0,
}
const baseAssumptions: MarketAssumptions = {
  equityReturn: 10,
  bondReturn: 8,
  cashReturn: 6.5,
  equityVolatility: 16.5,
  bondVolatility: 6,
  inflationRate: 5.5,
  compoundingMethod: "nominal",
} as MarketAssumptions

function input(over: Partial<DebugInput> = {}): DebugInput {
  const accounts = over.accounts ?? [ra, discretionary]
  const assumptions = over.assumptions ?? baseAssumptions
  const dc = over.drawdownConfig ?? drawdownConfig
  const pi = over.personalInfo ?? personalInfo
  const goals = over.retirementGoals ?? retirementGoals
  return {
    accounts,
    personalInfo: pi,
    retirementGoals: goals,
    assumptions,
    drawdownConfig: dc,
    displayMode: "nominal",
    projection:
      "projection" in over
        ? (over.projection ?? null)
        : calculateProjection(accounts, pi, goals, dc, assumptions),
    simulationResult: null,
    generatedAt: new Date("2026-11-14T10:00:00Z"),
    ...over,
  }
}

const find = (m: DebugModel, section: string, rowId: string) =>
  m.sections.find((s) => s.id === section)?.rows.find((r) => r.id === rowId)

describe("buildDebugModel", () => {
  describe("Critical SA scenarios: reconciliation against the real engine", () => {
    it.each(["nominal", "compound"] as const)("every check matches under %s compounding", (m) => {
      const model = buildDebugModel(
        input({ assumptions: { ...baseAssumptions, compoundingMethod: m } }),
      )
      expect(model.checks.map((c) => [c.id, c.status])).toEqual([
        ["portfolio-at-retirement", "match"],
        ["initial-income", "match"],
        ["net-income", "match"],
        ["lump-sum-split", "match"],
      ])
    })

    it("matches with a 30% lump sum (balance after commutation is the drawdown balance)", () => {
      const model = buildDebugModel(
        input({ drawdownConfig: { ...drawdownConfig, lumpSumPercentage: 30 } }),
      )
      expect(model.checks.every((c) => c.status === "match")).toBe(true)
    })

    it("flags a mismatch when the engine figure is tampered with", () => {
      const real = calculateProjection(
        [ra, discretionary],
        personalInfo,
        retirementGoals,
        drawdownConfig,
        baseAssumptions,
      )
      const tampered: ProjectionResult = {
        ...real,
        portfolioAtRetirement: real.portfolioAtRetirement + 1000,
      }
      const check = buildDebugModel(input({ projection: tampered })).checks[0]
      expect(check.status).toBe("mismatch")
      expect(check.delta).not.toBe(check.engine)
    })

    it("skips the accumulation check when the TFSA annual limit binds", () => {
      const rich = { ...smallTfsa, monthlyContribution: 20000 }
      const check = buildDebugModel(input({ accounts: [ra, rich] })).checks[0]
      expect(check.status).toBe("skipped")
    })
  })

  describe("Wrong-number states", () => {
    it("shows — (not Never, not a fallback) for every engine row before a projection exists", () => {
      const model = buildDebugModel(input({ projection: null }))
      expect(find(model, "withdrawal", "depletion")?.value).toBe("—")
      expect(find(model, "withdrawal", "portfolio-at-retirement")?.value).toBe("—")
      expect(find(model, "withdrawal", "initial-annual")?.value).toBe("—")
      expect(find(model, "withdrawal", "replacement-ratio")?.value).toBe("—")
      expect(find(model, "tax", "lifetime-tax")?.value).toBe("—")
      expect(find(model, "tax", "y1-net-monthly")?.value).toBe("—")
      expect(model.checks.every((c) => c.status === "pending")).toBe(true)
    })

    it("describeDepletion distinguishes loading, survives, and depleted", () => {
      const p = calculateProjection(
        [ra],
        personalInfo,
        retirementGoals,
        drawdownConfig,
        baseAssumptions,
      )
      expect(describeDepletion(null, 90)).toBe("—")
      expect(describeDepletion({ ...p, portfolioDepletionAge: null }, 90)).toBe("Lasts to age 90")
      expect(describeDepletion({ ...p, portfolioDepletionAge: 83 }, 90)).toBe("Age 83")
    })

    it("renders configured zeros for optional drawdown fields instead of dropping them", () => {
      const model = buildDebugModel(
        input({
          drawdownConfig: {
            ...drawdownConfig,
            strategy: "guardrails",
            upperGuardrail: 0,
            lowerGuardrail: 0,
            monthlyMedicalAid: 0,
            medicalAidDependants: 0,
          },
        }),
      )
      expect(find(model, "drawdown", "upper-guardrail")?.value).toBe("0%")
      expect(find(model, "drawdown", "lower-guardrail")?.value).toBe("0%")
      expect(find(model, "drawdown", "medical-aid")?.value).toMatch(/0,00$/)
      expect(find(model, "drawdown", "medical-dependants")?.value).toBe("0")
    })

    it("omits optional drawdown fields that are genuinely unset", () => {
      const model = buildDebugModel(input())
      expect(find(model, "drawdown", "upper-guardrail")).toBeUndefined()
      expect(find(model, "drawdown", "medical-aid")).toBeUndefined()
    })

    it("keeps a genuine zero lifetime tax as zero rather than falling back", () => {
      const p = calculateProjection(
        [ra],
        personalInfo,
        retirementGoals,
        drawdownConfig,
        baseAssumptions,
      )
      const model = buildDebugModel(
        input({ projection: { ...p, totalLifetimeIncomeTax: 0, averageEffectiveTaxRate: 0 } }),
      )
      expect(find(model, "tax", "lifetime-tax")?.value).toMatch(/0,00$/)
      expect(find(model, "tax", "avg-rate")?.value).toBe("0.00%")
    })

    it("flags a recalculating projection", () => {
      expect(buildDebugModel(input({ isDeferred: true })).recalculating).toBe(true)
      expect(buildDebugModel(input()).recalculating).toBe(false)
    })
  })

  describe("No hardcoded tax figures", () => {
    it("derives deduction limits, marginal rate, tax year and access age from constants", () => {
      const model = buildDebugModel(input())
      const section = model.sections.find((s) => s.id === "contribution-tax")!
      const top = INCOME_TAX_BRACKETS_CONFIG[INCOME_TAX_BRACKETS_CONFIG.length - 1].rate
      expect(section.title).toContain(TAX_YEAR)
      expect(section.rows.find((r) => r.id === "tax-savings")?.basis).toContain(
        `${(top * 100).toFixed(2)}%`,
      )
      expect(section.rows.find((r) => r.id === "max-deduction")?.basis).toContain(
        `${(SA_TAX_LIMITS.pensionRaDeductionRate * 100).toFixed(2)}%`,
      )
      expect(section.rows.find((r) => r.id === "can-access-ra")?.basis).toContain(
        String(MIN_RETIREMENT_ACCESS_AGE),
      )
    })

    it("computes the tax saving as deduction × the top bracket rate", () => {
      const model = buildDebugModel(input())
      const top = INCOME_TAX_BRACKETS_CONFIG[INCOME_TAX_BRACKETS_CONFIG.length - 1].rate
      const deduction = Math.min(
        (ra.monthlyContribution + discretionary.monthlyContribution) * 12,
        personalInfo.annualIncome * SA_TAX_LIMITS.pensionRaDeductionRate,
        SA_TAX_LIMITS.pensionRaMaxDeduction,
      )
      const expected = formatCurrency(deduction * top, { decimals: 2 })
      expect(find(model, "contribution-tax", "tax-savings")?.value).toBe(expected)
    })

    it("caps the deduction at the configured maximum for a high earner", () => {
      const big: Account = { ...ra, monthlyContribution: 100000 }
      const model = buildDebugModel(
        input({
          accounts: [big],
          personalInfo: { ...personalInfo, annualIncome: 10_000_000 },
        }),
      )
      const cap = find(model, "contribution-tax", "max-deduction")!.value
      expect(cap.replace(/\s| /g, "")).toContain(
        String(SA_TAX_LIMITS.pensionRaMaxDeduction).slice(0, 3),
      )
    })

    it("reference defaults come from SA_DEFAULTS_DISPLAY", () => {
      const model = buildDebugModel(input())
      expect(find(model, "defaults", "def-inflation")?.value).toBe(
        `${SA_DEFAULTS_DISPLAY.inflation}%`,
      )
    })
  })

  describe("Compounding methods", () => {
    it("reports the active method's formula and monthly rate", () => {
      const nominal = buildDebugModel(input())
      const compound = buildDebugModel(
        input({ assumptions: { ...baseAssumptions, compoundingMethod: "compound" } }),
      )
      expect(nominal.compounding.formula).not.toBe(compound.compounding.formula)
      expect(find(nominal, "aggregates", "monthly-return")?.basis).toContain("nominal")
      expect(find(compound, "aggregates", "monthly-return")?.basis).toContain("compound")
      // nominal monthly = annual / 12 and compound is strictly lower for a positive return
      const rate = (m: DebugModel) => parseFloat(find(m, "aggregates", "monthly-return")!.value)
      expect(rate(compound)).toBeLessThan(rate(nominal))
    })
  })

  describe("Edge cases", () => {
    it("handles zero accounts without throwing and explains the empty state", () => {
      const model = buildDebugModel(input({ accounts: [], projection: null }))
      expect(model.hasProjection).toBe(false)
      expect(model.sections.find((s) => s.id === "accounts-empty")?.footnote).toMatch(/Add one/)
      expect(find(model, "aggregates", "total-balance")?.value).toMatch(/0,00$/)
    })

    it("uses contribution weights when the balance is R0, and says so", () => {
      const zero: Account = { ...ra, currentBalance: 0 }
      const model = buildDebugModel(input({ accounts: [zero] }))
      expect(find(model, "aggregates", "weighting")?.value).toMatch(/^Contribution weights/)
      expect(find(model, "aggregates", "weighted-return")?.value).toBe("11.00%")
    })

    it("handles R0 contributions with 0% escalation", () => {
      const flat: Account = { ...ra, monthlyContribution: 0, contributionEscalation: 0 }
      const model = buildDebugModel(input({ accounts: [flat] }))
      expect(model.checks[0].status).toBe("match")
    })

    it("warns when retirement age is below current age", () => {
      const model = buildDebugModel(
        input({ personalInfo: { ...personalInfo, currentAge: 70, retirementAge: 65 } }),
      )
      expect(model.sections.find((s) => s.id === "personal")?.footnote).toMatch(/below current/)
    })

    it("tfsaLimitsBind is false without TFSAs and for zero years", () => {
      expect(tfsaLimitsBind([ra], 25)).toBe(false)
      expect(tfsaLimitsBind([smallTfsa], 0)).toBe(false)
      expect(tfsaLimitsBind([smallTfsa], 25)).toBe(false)
    })

    it("tfsaLimitsBind is true once the lifetime cap would be crossed", () => {
      const nearCap = { ...smallTfsa, currentBalance: SA_TAX_LIMITS.tfsaLifetimeLimit - 1000 }
      expect(tfsaLimitsBind([nearCap], 5)).toBe(true)
    })
  })

  describe("Monte Carlo section", () => {
    it("points to the Risk page when there is no result", () => {
      const mc = buildDebugModel(input()).sections.find((s) => s.id === "monte-carlo")!
      expect(mc.rows).toHaveLength(0)
      expect(mc.footnote).toMatch(/Risk page/)
    })

    it("reads run count and depletion from the result, never a literal", () => {
      const series = [1, 2, 3]
      const result = {
        successRate: 82.5,
        runs: Array.from({ length: 250 }, () => null),
        medianDepletionAge: null,
        averageFinalBalance: 1_000_000,
        percentiles: { p10: series, p25: series, p50: series, p75: series, p90: [] },
      } as unknown as SimulationResult
      const model = buildDebugModel(input({ simulationResult: result }))
      expect(find(model, "monte-carlo", "mc-runs")?.value).toMatch(/250/)
      expect(find(model, "monte-carlo", "mc-median-depletion")?.value).toBe(
        "Most runs do not deplete",
      )
      expect(find(model, "monte-carlo", "mc-p90")?.value).toBe("—")
      expect(find(model, "monte-carlo", "mc-p10")?.value).not.toBe("—")
    })
  })
})

describe("filterSections", () => {
  const model = buildDebugModel(input())

  it("returns everything for an empty or whitespace query", () => {
    expect(filterSections(model.sections, "  ")).toBe(model.sections)
  })

  it("matches row labels case-insensitively and keeps only matching rows", () => {
    const out = filterSections(model.sections, "S11F")
    expect(out.length).toBeGreaterThan(0)
    expect(out.flatMap((s) => s.rows).every((r) => /s11f/i.test(r.label + r.value))).toBe(true)
  })

  it("keeps a whole section when its title matches", () => {
    const out = filterSections(model.sections, "drawdown configuration")
    expect(out).toHaveLength(1)
    expect(out[0].rows.length).toBe(model.sections.find((s) => s.id === "drawdown")!.rows.length)
  })

  it("returns nothing when nothing matches", () => {
    expect(filterSections(model.sections, "zzzz-nope")).toEqual([])
  })
})

describe("filterChecks", () => {
  const checks = buildDebugModel(input()).checks
  const withStatus = (status: ReconciliationCheck["status"]): ReconciliationCheck => ({
    ...checks[0],
    id: `x-${status}`,
    label: `Row ${status}`,
    note: "n",
    engine: "R1.00",
    independent: "R1.00",
    status,
  })

  it("returns the same array for an empty or whitespace query", () => {
    expect(filterChecks(checks, "  ")).toBe(checks)
  })

  it("matches the label case-insensitively", () => {
    const out = filterChecks(checks, "PORTFOLIO")
    expect(out.length).toBeGreaterThan(0)
    expect(out.every((c) => /portfolio/i.test(c.label + c.note + c.engine + c.independent))).toBe(
      true,
    )
  })

  it("finds failing rows by the word the page shows for them", () => {
    const all = [withStatus("match"), withStatus("mismatch"), withStatus("skipped")]
    expect(filterChecks(all, "mismatch").map((c) => c.id)).toEqual(["x-mismatch"])
    expect(filterChecks(all, "not comparable").map((c) => c.id)).toEqual(["x-skipped"])
  })

  it("returns nothing when nothing matches", () => {
    expect(filterChecks(checks, "zzzz-nope")).toEqual([])
  })
})

describe("toDebugText", () => {
  it("renders every section row and every check from the same model", () => {
    const model = buildDebugModel(input())
    const text = toDebugText(model)
    for (const section of model.sections) {
      expect(text).toContain(section.title.toUpperCase())
      for (const r of section.rows) expect(text).toContain(`${r.label}: ${r.value}`)
    }
    for (const c of model.checks) expect(text).toContain(c.label)
    expect(text).toContain("[OK] Portfolio at retirement")
  })

  it("is deterministic for a fixed timestamp and notes a recalculating projection", () => {
    const a = toDebugText(buildDebugModel(input({ isDeferred: true })))
    expect(a).toBe(toDebugText(buildDebugModel(input({ isDeferred: true }))))
    expect(a).toContain("2026-11-14T10:00:00.000Z")
    expect(a).toMatch(/recalculating/)
  })

  it("reports skipped and pending checks with their reason, not figures", () => {
    const text = toDebugText(buildDebugModel(input({ projection: null })))
    expect(text).toMatch(/\[PENDING\] Portfolio at retirement: Needs a projection/)
  })
})

const fakeCheck = (status: ReconciliationCheck["status"]): ReconciliationCheck => ({
  id: status,
  label: `Check ${status}`,
  engine: "R10.00",
  independent: "R12.00",
  delta: "-R2.00",
  status,
  tolerance: "R0.01",
  note: "why",
})

describe("summarizeChecks", () => {
  it("reports All N when every check was compared and matched", () => {
    const v = summarizeChecks([fakeCheck("match"), fakeCheck("match")])
    expect(v).toEqual({ tone: "match", headline: "All 2 checks match" })
  })

  it("never folds skipped checks into a green", () => {
    const v = summarizeChecks([fakeCheck("match"), fakeCheck("skipped"), fakeCheck("pending")])
    expect(v.tone).toBe("partial")
    expect(v.headline).toBe("1 of 3 checks match")
    expect(v.detail).toBe("2 not compared")
  })

  it("a single mismatch wins over any number of matches", () => {
    const v = summarizeChecks([fakeCheck("match"), fakeCheck("mismatch"), fakeCheck("match")])
    expect(v.tone).toBe("mismatch")
    expect(v.headline).toBe("1 of 3 checks disagree")
  })

  it("is pending when nothing was compared, including an empty list", () => {
    expect(summarizeChecks([fakeCheck("pending"), fakeCheck("skipped")]).tone).toBe("pending")
    expect(summarizeChecks([]).tone).toBe("pending")
  })

  it("agrees with a real model: no projection is pending, a real plan matches", () => {
    expect(summarizeChecks(buildDebugModel(input({ projection: null })).checks).tone).toBe(
      "pending",
    )
    const real = summarizeChecks(buildDebugModel(input()).checks)
    expect(["match", "partial"]).toContain(real.tone)
  })
})

describe("check tolerance and per-check text", () => {
  it("records the tolerance on compared checks only", () => {
    const withProjection = buildDebugModel(input()).checks
    for (const c of withProjection) {
      if (c.status === "match" || c.status === "mismatch") expect(c.tolerance).toBeTruthy()
      else expect(c.tolerance).toBeUndefined()
    }
  })

  it("includes the tolerance on a mismatch line but not on a match line", () => {
    expect(checkToText(fakeCheck("mismatch"))).toBe(
      "[MISMATCH] Check mismatch: engine R10.00 | independent R12.00 | delta -R2.00 | tolerance R0.01",
    )
    expect(checkToText(fakeCheck("match"))).not.toContain("tolerance")
    expect(checkToText(fakeCheck("skipped"))).toBe("[SKIPPED] Check skipped: why")
  })

  it("toDebugText uses the same per-check line", () => {
    const model = buildDebugModel(input())
    const text = toDebugText(model)
    for (const c of model.checks) expect(text).toContain(checkToText(c))
  })
})
