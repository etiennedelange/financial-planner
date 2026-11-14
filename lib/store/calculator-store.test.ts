import { describe, it, expect, beforeEach, vi } from "vite-plus/test"
import {
  CALCULATOR_STORAGE_KEY,
  sanitizePlan,
  useCalculatorStore,
  type CalculatorState,
} from "./calculator-store"
import { SA_DEFAULTS, SA_DEFAULTS_DISPLAY } from "@/lib/constants/defaults"
import type { Account } from "@/types"
import { installFailingSetItem } from "@/lib/test-utils/failing-storage"

// Must satisfy the real `Account` type (typed explicitly so fixture drift fails the
// build, not silently — an earlier fixture used a shape that cannot occur in production).
const mockAccount: Account = {
  id: "acc-1",
  name: "My TFSA",
  provider: "Test Provider",
  type: "tfsa",
  currentBalance: 100000,
  monthlyContribution: 500,
  expectedReturn: 10,
  annualFees: 0.75,
  contributionEscalation: 0,
}

const mockScenarioData = {
  personalInfo: { currentAge: 45, retirementAge: 65, lifeExpectancy: 90, annualIncome: 600000 },
  retirementGoals: { desiredMonthlyIncome: 30000, inflationRate: 5.5, legacyAmount: 0 },
  assumptions: {
    equityReturn: 10.5,
    bondReturn: 8,
    cashReturn: 3,
    equityVolatility: 16,
    bondVolatility: 8,
    inflationRate: 5.5,
    compoundingMethod: "nominal" as const,
  },
  drawdownConfig: {
    strategy: "fixed_percentage" as const,
    initialWithdrawalRate: 4,
    minimumWithdrawal: 15000,
    maximumWithdrawal: 60000,
    lumpSumPercentage: 0,
  },
  displayMode: "nominal" as const,
}

describe("useCalculatorStore", () => {
  beforeEach(() => {
    useCalculatorStore.getState().resetToDefaults()
  })

  describe("Initialization", () => {
    it("starts from the SA defaults with no accounts", () => {
      const state = useCalculatorStore.getState()
      expect(state.accounts).toEqual([])
      expect(state.displayMode).toBe("nominal")
      expect(state.personalInfo.annualIncome).toBe(600000)
      expect(state.personalInfo.currentAge).toBe(SA_DEFAULTS.defaultCurrentAge)
    })

    it("has no account, identity or scenario machinery left", () => {
      const state = useCalculatorStore.getState() as unknown as Record<string, unknown>
      for (const gone of [
        "identity",
        "setIdentity",
        "syncFromDb",
        "scenarioList",
        "activeScenarioId",
      ]) {
        expect(state[gone]).toBeUndefined()
      }
    })
  })

  describe("Account operations", () => {
    it("adds an account", () => {
      useCalculatorStore.getState().addAccount(mockAccount)
      expect(useCalculatorStore.getState().accounts).toEqual([mockAccount])
    })

    it("updates only the matching account", () => {
      useCalculatorStore.setState({ accounts: [mockAccount, { ...mockAccount, id: "acc-2" }] })
      useCalculatorStore.getState().updateAccount("acc-1", { currentBalance: 150000 })
      const [a, b] = useCalculatorStore.getState().accounts
      expect(a.currentBalance).toBe(150000)
      expect(b.currentBalance).toBe(100000)
    })

    it("ignores an update for an unknown id", () => {
      useCalculatorStore.setState({ accounts: [mockAccount] })
      useCalculatorStore.getState().updateAccount("nope", { currentBalance: 1 })
      expect(useCalculatorStore.getState().accounts).toEqual([mockAccount])
    })

    it("removes an account", () => {
      useCalculatorStore.setState({ accounts: [mockAccount] })
      useCalculatorStore.getState().removeAccount("acc-1")
      expect(useCalculatorStore.getState().accounts).toHaveLength(0)
    })

    it("seeds accounts with fresh ids, replacing existing ones", () => {
      useCalculatorStore.setState({ accounts: [mockAccount] })
      const { id: _id, ...withoutId } = mockAccount
      useCalculatorStore.getState().seedAccounts([withoutId, withoutId])
      const accounts = useCalculatorStore.getState().accounts
      expect(accounts).toHaveLength(2)
      expect(accounts[0].id).toBeDefined()
      expect(accounts[0].id).not.toBe(accounts[1].id)
      expect(accounts[0].id).not.toBe("acc-1")
    })
  })

  describe("Plan settings", () => {
    it("merges personal info", () => {
      useCalculatorStore.getState().setPersonalInfo({ currentAge: 50 })
      const { personalInfo } = useCalculatorStore.getState()
      expect(personalInfo.currentAge).toBe(50)
      expect(personalInfo.annualIncome).toBe(600000)
    })

    it("merges retirement goals", () => {
      useCalculatorStore.getState().setRetirementGoals({ desiredMonthlyIncome: 40000 })
      expect(useCalculatorStore.getState().retirementGoals.desiredMonthlyIncome).toBe(40000)
    })

    it("merges assumptions, keeping the compounding method", () => {
      useCalculatorStore.getState().setAssumptions({ equityReturn: 12 })
      const { assumptions } = useCalculatorStore.getState()
      expect(assumptions.equityReturn).toBe(12)
      expect(assumptions.compoundingMethod).toBe("nominal")
    })

    it("merges drawdown config", () => {
      useCalculatorStore.getState().setDrawdownConfig({ initialWithdrawalRate: 3.5 })
      expect(useCalculatorStore.getState().drawdownConfig.initialWithdrawalRate).toBe(3.5)
    })

    it("sets the display mode", () => {
      useCalculatorStore.getState().setDisplayMode("real")
      expect(useCalculatorStore.getState().displayMode).toBe("real")
    })
  })

  describe("loadPlan", () => {
    it("loads a complete plan", () => {
      useCalculatorStore.getState().loadPlan({ ...mockScenarioData, accounts: [mockAccount] })
      const state = useCalculatorStore.getState()
      expect(state.personalInfo.currentAge).toBe(45)
      expect(state.assumptions.equityReturn).toBe(10.5)
      expect(state.accounts).toHaveLength(1)
    })
  })

  describe("resetToDefaults", () => {
    it("resets every part of the plan", () => {
      useCalculatorStore.setState({
        personalInfo: { ...useCalculatorStore.getState().personalInfo, currentAge: 55 },
        accounts: [mockAccount],
        displayMode: "real",
      })
      useCalculatorStore.getState().resetToDefaults()
      const state = useCalculatorStore.getState()
      expect(state.personalInfo.currentAge).toBe(SA_DEFAULTS.defaultCurrentAge)
      expect(state.accounts).toHaveLength(0)
      expect(state.displayMode).toBe("nominal")
    })
  })
})

describe("sanitizePlan (shared by migrate and backup import)", () => {
  it("is idempotent", () => {
    const once = sanitizePlan({ ...mockScenarioData, accounts: [mockAccount] })
    expect(sanitizePlan(once)).toEqual(once)
  })

  it("defaults an unknown display mode to nominal", () => {
    expect(sanitizePlan({ displayMode: "weird" as never }).displayMode).toBe("nominal")
    expect(sanitizePlan({ displayMode: "real" }).displayMode).toBe("real")
  })
})

describe("persist migration v1 → v2 (monetary cap)", () => {
  const absurd = 8.798456465498799e39

  const migrate = useCalculatorStore.persist.getOptions().migrate

  it("clamps stale absurd monetary values on rehydrate", () => {
    const migrated = migrate!(
      {
        personalInfo: {
          currentAge: 35,
          retirementAge: 65,
          lifeExpectancy: 90,
          annualIncome: absurd,
        },
        retirementGoals: { desiredMonthlyIncome: absurd, inflationRate: 5.5, legacyAmount: absurd },
        drawdownConfig: {
          strategy: "fixed_percentage",
          initialWithdrawalRate: 4,
          minimumWithdrawal: absurd,
          maximumWithdrawal: absurd,
          lumpSumPercentage: 0,
        },
        accounts: [{ ...mockAccount, currentBalance: absurd, monthlyContribution: absurd }],
      } as unknown,
      1,
    ) as CalculatorState

    expect(migrated.personalInfo.annualIncome).toBe(1_000_000_000_000)
    expect(migrated.retirementGoals.desiredMonthlyIncome).toBe(1_000_000_000_000)
    expect(migrated.retirementGoals.legacyAmount).toBe(1_000_000_000_000)
    expect(migrated.drawdownConfig.minimumWithdrawal).toBe(1_000_000_000_000)
    expect(migrated.drawdownConfig.maximumWithdrawal).toBe(1_000_000_000_000)
    expect(migrated.accounts[0].currentBalance).toBe(1_000_000_000_000)
    expect(migrated.accounts[0].monthlyContribution).toBe(1_000_000_000_000)
  })

  it("preserves finite values and optional undefined fields untouched", () => {
    const migrated = migrate!(
      {
        personalInfo: {
          currentAge: 35,
          retirementAge: 65,
          lifeExpectancy: 90,
          annualIncome: 600000,
        },
        retirementGoals: { desiredMonthlyIncome: 30000, inflationRate: 5.5, legacyAmount: 0 },
        drawdownConfig: {
          strategy: "fixed_percentage",
          initialWithdrawalRate: 4,
          minimumWithdrawal: 15000,
          maximumWithdrawal: 60000,
          lumpSumPercentage: 0,
        },
        accounts: [{ ...mockAccount, tfsaContributionsToDate: undefined }],
      } as unknown,
      1,
    ) as CalculatorState

    expect(migrated.personalInfo.annualIncome).toBe(600000)
    expect(migrated.retirementGoals.desiredMonthlyIncome).toBe(30000)
    expect(migrated.drawdownConfig.minimumWithdrawal).toBe(15000)
    expect(migrated.accounts[0].tfsaContributionsToDate).toBeUndefined()
  })

  it("handles incomplete persisted state with safe fallbacks", () => {
    const migrated = migrate!(
      {
        personalInfo: {},
        retirementGoals: {},
        drawdownConfig: {},
      } as unknown,
      1,
    ) as CalculatorState

    expect(migrated.personalInfo.annualIncome).toBe(0)
    expect(migrated.retirementGoals.desiredMonthlyIncome).toBe(0)
    expect(migrated.retirementGoals.legacyAmount).toBe(0)
    expect(migrated.drawdownConfig.minimumWithdrawal).toBe(0)
    expect(migrated.drawdownConfig.maximumWithdrawal).toBe(0)
    expect(migrated.drawdownConfig.monthlyMedicalAid).toBeUndefined()
    expect(migrated.accounts).toEqual([])
  })

  it("clamps present optional monetary fields", () => {
    const migrated = migrate!(
      {
        drawdownConfig: { monthlyMedicalAid: absurd },
        accounts: [{ ...mockAccount, tfsaContributionsToDate: absurd }],
      } as unknown,
      1,
    ) as CalculatorState

    expect(migrated.drawdownConfig.monthlyMedicalAid).toBe(1_000_000_000_000)
    expect(migrated.accounts[0].tfsaContributionsToDate).toBe(1_000_000_000_000)
  })
})

describe("persist migration v2 → v3 (invalid Market Assumptions rates, issue #34)", () => {
  const migrate = useCalculatorStore.persist.getOptions().migrate

  it("resets cleared (null) and out-of-range rates to the defaults", () => {
    const migrated = migrate!(
      {
        assumptions: {
          equityReturn: 150000,
          bondReturn: 3000,
          cashReturn: null,
          equityVolatility: 16.5,
          bondVolatility: 6,
          inflationRate: null,
          compoundingMethod: "compound",
          taxThresholdRelief: "none",
        },
        retirementGoals: { desiredMonthlyIncome: 30000, inflationRate: null, legacyAmount: 0 },
      } as unknown,
      2,
    ) as CalculatorState

    expect(migrated.assumptions).toEqual({
      equityReturn: SA_DEFAULTS_DISPLAY.equityReturn,
      bondReturn: SA_DEFAULTS_DISPLAY.bondReturn,
      cashReturn: SA_DEFAULTS_DISPLAY.cashReturn,
      equityVolatility: 16.5,
      bondVolatility: 6,
      inflationRate: SA_DEFAULTS_DISPLAY.inflation,
      // Non-rate settings are left exactly as the user chose them
      compoundingMethod: "compound",
      taxThresholdRelief: "none",
    })
    expect(migrated.retirementGoals.inflationRate).toBe(SA_DEFAULTS_DISPLAY.inflation)
  })

  it("keeps valid rates, including the 0% and maximum boundaries", () => {
    const migrated = migrate!(
      {
        assumptions: {
          equityReturn: 30,
          bondReturn: 0,
          cashReturn: 15,
          equityVolatility: 16.5,
          bondVolatility: 6,
          inflationRate: 0,
          compoundingMethod: "nominal",
        },
        retirementGoals: { desiredMonthlyIncome: 30000, inflationRate: 0, legacyAmount: 0 },
      } as unknown,
      2,
    ) as CalculatorState

    expect(migrated.assumptions.equityReturn).toBe(30)
    expect(migrated.assumptions.bondReturn).toBe(0)
    expect(migrated.assumptions.cashReturn).toBe(15)
    expect(migrated.assumptions.inflationRate).toBe(0)
    expect(migrated.retirementGoals.inflationRate).toBe(0)
  })

  it("restores default assumptions when none were persisted", () => {
    const migrated = migrate!({} as unknown, 2) as CalculatorState
    expect(migrated.assumptions.equityReturn).toBe(SA_DEFAULTS_DISPLAY.equityReturn)
    expect(migrated.assumptions.inflationRate).toBe(SA_DEFAULTS_DISPLAY.inflation)
    expect(migrated.assumptions.compoundingMethod).toBe("nominal")
    expect(migrated.retirementGoals.inflationRate).toBe(SA_DEFAULTS_DISPLAY.inflation)
  })

  it("a v1 payload gets both the monetary clamp and the rate reset", () => {
    const migrated = migrate!(
      {
        personalInfo: { annualIncome: 8.8e39 },
        assumptions: { equityReturn: 999 },
      } as unknown,
      1,
    ) as CalculatorState
    expect(migrated.personalInfo.annualIncome).toBe(1_000_000_000_000)
    expect(migrated.assumptions.equityReturn).toBe(SA_DEFAULTS_DISPLAY.equityReturn)
  })
})

describe("persist migration v3 → v4 (scenarios removed)", () => {
  const migrate = useCalculatorStore.persist.getOptions().migrate

  it("drops the legacy activeScenarioId so it cannot resurrect as a stray key", () => {
    const migrated = migrate!(
      { ...mockScenarioData, accounts: [mockAccount], activeScenarioId: "old-scenario" } as unknown,
      3,
    ) as unknown as Record<string, unknown>
    expect(migrated.activeScenarioId).toBeUndefined()
    expect((migrated.accounts as Account[])[0].name).toBe("My TFSA")
  })

  it("persists at version 4 under the plain (un-scoped) storage key", () => {
    expect(useCalculatorStore.persist.getOptions().version).toBe(4)
    expect(useCalculatorStore.persist.getOptions().name).toBe(CALCULATOR_STORAGE_KEY)
    expect(CALCULATOR_STORAGE_KEY).toBe("financial-planner-storage")
  })
})

describe("persist write-gate (write-before-rehydrate clobber regression)", () => {
  // A fresh module gives a fresh store whose gate is still closed — mirroring the
  // first page load, where a set() can land before <LocalDataProvider> has read storage.
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  const persistedSnapshot = {
    personalInfo: { currentAge: 45, retirementAge: 65, lifeExpectancy: 90, annualIncome: 600000 },
    retirementGoals: { desiredMonthlyIncome: 30000, inflationRate: 5.5, legacyAmount: 0 },
    assumptions: mockScenarioData.assumptions,
    drawdownConfig: { ...mockScenarioData.drawdownConfig, upperGuardrail: 20, lowerGuardrail: 20 },
    displayMode: "nominal",
    accounts: [
      {
        id: "persisted-1",
        name: "Persisted RA",
        provider: "Allan Gray",
        type: "retirement_annuity" as const,
        currentBalance: 250000,
        monthlyContribution: 4000,
        contributionEscalation: 6,
        expectedReturn: 11,
        annualFees: 0.75,
      },
    ],
  }

  it("a set() fired before the first rehydrate cannot overwrite the saved plan", async () => {
    localStorage.setItem(
      CALCULATOR_STORAGE_KEY,
      JSON.stringify({ state: persistedSnapshot, version: 4 }),
    )
    const { useCalculatorStore: freshStore } = await import("./calculator-store")

    // Pre-hydration write while the store still holds its defaults.
    freshStore.getState().setDisplayMode("nominal")
    await freshStore.persist.rehydrate()

    expect(freshStore.getState().personalInfo.currentAge).toBe(45)
    expect(freshStore.getState().accounts[0].name).toBe("Persisted RA")
    const stored = JSON.parse(localStorage.getItem(CALCULATOR_STORAGE_KEY)!)
    expect(stored.state.personalInfo.currentAge).toBe(45)
    expect(stored.state.accounts).toHaveLength(1)
  })

  it("persists subsequent writes once rehydrate has settled", async () => {
    localStorage.setItem(
      CALCULATOR_STORAGE_KEY,
      JSON.stringify({ state: { ...persistedSnapshot, accounts: [] }, version: 4 }),
    )
    const { useCalculatorStore: freshStore } = await import("./calculator-store")
    await freshStore.persist.rehydrate()
    freshStore.getState().setPersonalInfo({ currentAge: 52 })
    const stored = JSON.parse(localStorage.getItem(CALCULATOR_STORAGE_KEY)!)
    expect(stored.state.personalInfo.currentAge).toBe(52)
  })

  it("persists only plan data — no identity, scenario or key material", async () => {
    const { useCalculatorStore: freshStore } = await import("./calculator-store")
    await freshStore.persist.rehydrate()
    freshStore.getState().addAccount(mockAccount)
    const stored = JSON.parse(localStorage.getItem(CALCULATOR_STORAGE_KEY)!)
    expect(Object.keys(stored.state).sort()).toEqual([
      "accounts",
      "assumptions",
      "displayMode",
      "drawdownConfig",
      "personalInfo",
      "retirementGoals",
    ])
  })

  it("reports a quota failure instead of swallowing it", async () => {
    const restore = installFailingSetItem(new DOMException("full", "QuotaExceededError"))
    try {
      const health = await import("@/lib/store/storage-health")
      health.resetStorageHealth()
      // Imported AFTER the stub so zustand's storage captures it.
      const { useCalculatorStore: freshStore } = await import("./calculator-store")
      await freshStore.persist.rehydrate()
      freshStore.getState().setPersonalInfo({ currentAge: 41 })
      expect(health.getStorageHealth()).toBe("quota")
      // The in-memory edit is not lost just because persisting failed.
      expect(freshStore.getState().personalInfo.currentAge).toBe(41)
    } finally {
      restore()
    }
  })
})
