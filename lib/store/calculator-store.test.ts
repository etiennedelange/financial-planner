import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { useCalculatorStore, type CalculatorState } from "./calculator-store"
// Bare side-effect import: the expenses store registers its base name with the
// scope registry at module load, which evictUserScopedKeys iterates on sign-out.
// (A named import would be tree-shaken since the test never uses its bindings.)
import "@/lib/store/expenses-store"
import * as accountsApi from "@/lib/supabase/accounts"
import * as scenariosApi from "@/lib/supabase/scenarios"
import { SA_DEFAULTS } from "@/lib/constants/defaults"
import type { Account } from "@/types"

vi.mock("@/lib/supabase/accounts")
vi.mock("@/lib/supabase/scenarios")

// Must satisfy the real `Account` type. The previous fixture used `balance` (the field
// is `currentBalance`), `type: "TFSA"` (the union is lowercase `'tfsa'`), and omitted
// provider/expectedReturn/annualFees entirely — so these tests were exercising a shape
// that cannot occur in production. Notably any code branching on `acc.type === 'tfsa'`
// would have taken the wrong path. Typed explicitly so drift fails the build, not silently.
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

const mockScenarioMeta = {
  id: "scenario-1",
  name: "My Plan",
  updatedAt: new Date().toISOString(),
  claimComplete: true,
}

const mockScenarioData = {
  personalInfo: {
    currentAge: 45,
    retirementAge: 65,
    lifeExpectancy: 90,
    annualIncome: 600000,
  },
  retirementGoals: {
    desiredMonthlyIncome: 30000,
    inflationRate: 5.5,
    legacyAmount: 0,
  },
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
    useCalculatorStore.setState({
      accounts: [],
      personalInfo: { currentAge: SA_DEFAULTS.defaultCurrentAge, retirementAge: SA_DEFAULTS.defaultRetirementAge, lifeExpectancy: SA_DEFAULTS.lifeExpectancy, annualIncome: 600000 },
      retirementGoals: { desiredMonthlyIncome: 30000, inflationRate: 5.5, legacyAmount: 0 },
      assumptions: { equityReturn: 10.5, bondReturn: 8, cashReturn: 3, equityVolatility: 16, bondVolatility: 8, inflationRate: 5.5, compoundingMethod: "nominal" },
      drawdownConfig: { strategy: "fixed_percentage", initialWithdrawalRate: 4, minimumWithdrawal: 15000, maximumWithdrawal: 60000, lumpSumPercentage: 0 },
      identity: { kind: "guest" },
      activeScenarioId: null,
      scenarioList: [],
      displayMode: "nominal",
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("Initialization", () => {
    it("should initialize with default values", () => {
      const state = useCalculatorStore.getState()
      expect(state.identity).toEqual({ kind: "guest" })
      expect(state.activeScenarioId).toBe(null)
      expect(state.accounts).toEqual([])
      expect(state.scenarioList).toEqual([])
      expect(state.displayMode).toBe("nominal")
      expect(state.personalInfo.annualIncome).toBe(600000)
    })
  })

  describe("Session & ID management", () => {
    it("should set session ID", () => {
      useCalculatorStore.getState().setIdentity({ kind: "user", userId: "session-123" })
      expect(useCalculatorStore.getState().identity).toEqual({
        kind: "user",
        userId: "session-123",
      })
    })
  })

  describe("Account operations", () => {
    it("should add account to state and DB", () => {
      vi.spyOn(accountsApi, "upsertAccount").mockResolvedValue(undefined)
      useCalculatorStore.getState().setIdentity({ kind: "user", userId: "session-1" })
      useCalculatorStore.getState().addAccount(mockAccount)

      const state = useCalculatorStore.getState()
      expect(state.accounts).toHaveLength(1)
      expect(state.accounts[0]).toEqual(mockAccount)
    })

    it("should not call DB when no active scenario", () => {
      vi.spyOn(accountsApi, "upsertAccount").mockResolvedValue(undefined)
      useCalculatorStore.getState().addAccount(mockAccount)

      const state = useCalculatorStore.getState()
      expect(state.accounts).toHaveLength(1)
      expect(accountsApi.upsertAccount).not.toHaveBeenCalled()
    })

    it("should update account in state and DB", () => {
      vi.spyOn(accountsApi, "upsertAccount").mockResolvedValue(undefined)
      useCalculatorStore.getState().setIdentity({ kind: "user", userId: "session-1" })
      useCalculatorStore.setState({ activeScenarioId: "scenario-1" })
      useCalculatorStore.getState().addAccount(mockAccount)

      useCalculatorStore.getState().updateAccount("acc-1", { currentBalance: 150000 })

      const state = useCalculatorStore.getState()
      expect(state.accounts[0].currentBalance).toBe(150000)
    })

    it("should remove account from state and DB", () => {
      vi.spyOn(accountsApi, "deleteAccount").mockResolvedValue(undefined)
      useCalculatorStore.getState().setIdentity({ kind: "user", userId: "session-1" })
      useCalculatorStore.setState({ accounts: [mockAccount] })

      useCalculatorStore.getState().removeAccount("acc-1")

      const state = useCalculatorStore.getState()
      expect(state.accounts).toHaveLength(0)
      expect(accountsApi.deleteAccount).toHaveBeenCalledWith("acc-1")
    })

    it("should seed accounts with new IDs", () => {
      vi.spyOn(accountsApi, "upsertAccount").mockResolvedValue(undefined)
      vi.spyOn(accountsApi, "deleteAccount").mockResolvedValue(undefined)
      useCalculatorStore.getState().setIdentity({ kind: "user", userId: "session-1" })
      useCalculatorStore.setState({ activeScenarioId: "scenario-1", accounts: [] })

      const seedData = [
        { ...mockAccount, id: undefined as any },
      ]
      useCalculatorStore.getState().seedAccounts(seedData)

      const state = useCalculatorStore.getState()
      expect(state.accounts).toHaveLength(1)
      expect(state.accounts[0].id).toBeDefined()
      expect(state.accounts[0].name).toBe(mockAccount.name)
    })
  })

  describe("Personal settings updates", () => {
    it("should update personal info and schedule sync", () => {
      vi.useFakeTimers()
      useCalculatorStore.getState().setIdentity({ kind: "user", userId: "session-1" })
      useCalculatorStore.setState({ activeScenarioId: "scenario-1" })
      vi.spyOn(scenariosApi, "updateScenario").mockResolvedValue(undefined)

      useCalculatorStore.getState().setPersonalInfo({ currentAge: 50 })

      expect(useCalculatorStore.getState().personalInfo.currentAge).toBe(50)

      vi.advanceTimersByTime(800)
      expect(scenariosApi.updateScenario).toHaveBeenCalled()
    })

    it("should update retirement goals and schedule sync", () => {
      vi.useFakeTimers()
      useCalculatorStore.getState().setIdentity({ kind: "user", userId: "session-1" })
      useCalculatorStore.setState({ activeScenarioId: "scenario-1" })
      vi.spyOn(scenariosApi, "updateScenario").mockResolvedValue(undefined)

      useCalculatorStore.getState().setRetirementGoals({ desiredMonthlyIncome: 40000 })

      expect(useCalculatorStore.getState().retirementGoals.desiredMonthlyIncome).toBe(40000)

      vi.advanceTimersByTime(800)
      expect(scenariosApi.updateScenario).toHaveBeenCalled()
    })

    it("should update assumptions and schedule sync", () => {
      vi.useFakeTimers()
      useCalculatorStore.getState().setIdentity({ kind: "user", userId: "session-1" })
      useCalculatorStore.setState({ activeScenarioId: "scenario-1" })
      vi.spyOn(scenariosApi, "updateScenario").mockResolvedValue(undefined)

      useCalculatorStore.getState().setAssumptions({ equityReturn: 12 })

      expect(useCalculatorStore.getState().assumptions.equityReturn).toBe(12)

      vi.advanceTimersByTime(800)
      expect(scenariosApi.updateScenario).toHaveBeenCalled()
    })

    it("should update drawdown config and schedule sync", () => {
      vi.useFakeTimers()
      useCalculatorStore.getState().setIdentity({ kind: "user", userId: "session-1" })
      useCalculatorStore.setState({ activeScenarioId: "scenario-1" })
      vi.spyOn(scenariosApi, "updateScenario").mockResolvedValue(undefined)

      useCalculatorStore.getState().setDrawdownConfig({ initialWithdrawalRate: 3.5 })

      expect(useCalculatorStore.getState().drawdownConfig.initialWithdrawalRate).toBe(3.5)

      vi.advanceTimersByTime(800)
      expect(scenariosApi.updateScenario).toHaveBeenCalled()
    })

    it("should update display mode and schedule sync", () => {
      vi.useFakeTimers()
      useCalculatorStore.getState().setIdentity({ kind: "user", userId: "session-1" })
      useCalculatorStore.setState({ activeScenarioId: "scenario-1" })
      vi.spyOn(scenariosApi, "updateScenario").mockResolvedValue(undefined)

      useCalculatorStore.getState().setDisplayMode("real")

      expect(useCalculatorStore.getState().displayMode).toBe("real")

      vi.advanceTimersByTime(800)
      expect(scenariosApi.updateScenario).toHaveBeenCalled()
    })
  })

  describe("loadPlan", () => {
    it("should load complete plan into state", () => {
      useCalculatorStore.getState().loadPlan({
        ...mockScenarioData,
        accounts: [mockAccount],
      })

      const state = useCalculatorStore.getState()
      expect(state.personalInfo.currentAge).toBe(45)
      expect(state.retirementGoals.desiredMonthlyIncome).toBe(30000)
      expect(state.assumptions.equityReturn).toBe(10.5)
      expect(state.accounts).toHaveLength(1)
    })

    it("should persist accounts to DB when scenario is active", () => {
      vi.spyOn(accountsApi, "upsertAccount").mockResolvedValue(undefined)
      vi.spyOn(scenariosApi, "updateScenario").mockResolvedValue(undefined)
      useCalculatorStore.setState({ activeScenarioId: "scenario-1" })

      useCalculatorStore.getState().loadPlan({
        ...mockScenarioData,
        accounts: [mockAccount],
      })

      expect(accountsApi.upsertAccount).toHaveBeenCalledWith(mockAccount, "scenario-1")
      expect(scenariosApi.updateScenario).toHaveBeenCalled()
    })
  })

  describe("resetToDefaults", () => {
    it("should reset all state to initial defaults", () => {
      useCalculatorStore.setState({
        personalInfo: { ...useCalculatorStore.getState().personalInfo, currentAge: 55 },
        accounts: [mockAccount],
        identity: { kind: "user", userId: "session-123" },
      })

      useCalculatorStore.getState().resetToDefaults()

      const state = useCalculatorStore.getState()
      expect(state.personalInfo.currentAge).toBe(SA_DEFAULTS.defaultCurrentAge)
      expect(state.accounts).toHaveLength(0)
      expect(state.identity).toEqual({ kind: "guest" })
    })
  })

  describe("Scenario operations", () => {
    beforeEach(() => {
      useCalculatorStore.getState().setIdentity({ kind: "user", userId: "session-1" })
    })

    it("should switch to existing scenario", async () => {
      vi.spyOn(scenariosApi, "fetchScenario").mockResolvedValue(mockScenarioData)
      vi.spyOn(accountsApi, "fetchAccounts").mockResolvedValue([mockAccount])

      await useCalculatorStore.getState().switchScenario("scenario-1")

      const state = useCalculatorStore.getState()
      expect(state.activeScenarioId).toBe("scenario-1")
      expect(state.accounts).toEqual([mockAccount])
      expect(state.personalInfo.currentAge).toBe(45)
    })

    it("should create new scenario from current state", async () => {
      useCalculatorStore.setState({
        personalInfo: mockScenarioData.personalInfo,
        retirementGoals: mockScenarioData.retirementGoals,
        assumptions: mockScenarioData.assumptions,
        drawdownConfig: mockScenarioData.drawdownConfig,
        displayMode: mockScenarioData.displayMode,
        accounts: [mockAccount],
      })

      vi.spyOn(scenariosApi, "createScenario").mockResolvedValue("new-scenario-id")
      vi.spyOn(accountsApi, "cloneAccounts").mockResolvedValue([{ ...mockAccount, id: "cloned-acc-1" }])

      await useCalculatorStore.getState().createNewScenario("My Copy")

      const state = useCalculatorStore.getState()
      expect(state.activeScenarioId).toBe("new-scenario-id")
      expect(scenariosApi.createScenario).toHaveBeenCalledWith("session-1", "My Copy", expect.any(Object))
    })

    it("should rename scenario", async () => {
      useCalculatorStore.setState({
        scenarioList: [mockScenarioMeta],
      })

      vi.spyOn(scenariosApi, "renameScenario").mockResolvedValue(undefined)

      await useCalculatorStore.getState().renameScenario("scenario-1", "Updated Name")

      const state = useCalculatorStore.getState()
      expect(state.scenarioList[0].name).toBe("Updated Name")
    })

    it("should delete scenario and switch to next", async () => {
      const scenario2 = { id: "scenario-2", name: "Second Plan", updatedAt: new Date().toISOString(), claimComplete: true }
      useCalculatorStore.setState({
        scenarioList: [mockScenarioMeta, scenario2],
        activeScenarioId: "scenario-1",
      })

      vi.spyOn(scenariosApi, "deleteScenario").mockResolvedValue(undefined)
      vi.spyOn(scenariosApi, "fetchScenario").mockResolvedValue(mockScenarioData)
      vi.spyOn(accountsApi, "fetchAccounts").mockResolvedValue([])

      await useCalculatorStore.getState().deleteScenario("scenario-1")

      const state = useCalculatorStore.getState()
      expect(state.scenarioList).toHaveLength(1)
      expect(state.scenarioList[0].id).toBe("scenario-2")
      expect(state.activeScenarioId).toBe("scenario-2")
    })

    it("should not delete last scenario", async () => {
      useCalculatorStore.setState({
        scenarioList: [mockScenarioMeta],
      })

      vi.spyOn(scenariosApi, "deleteScenario").mockResolvedValue(undefined)

      await useCalculatorStore.getState().deleteScenario("scenario-1")

      const state = useCalculatorStore.getState()
      expect(state.scenarioList).toHaveLength(1)
      expect(scenariosApi.deleteScenario).not.toHaveBeenCalled()
    })
  })

  describe("syncFromDb", () => {
    beforeEach(() => {
      useCalculatorStore.getState().setIdentity({ kind: "user", userId: "session-1" })
    })

    it("should sync existing scenarios list", async () => {
      vi.spyOn(scenariosApi, "listScenarios").mockResolvedValue([mockScenarioMeta])
      vi.spyOn(scenariosApi, "fetchScenario").mockResolvedValue(mockScenarioData)
      vi.spyOn(accountsApi, "fetchAccounts").mockResolvedValue([mockAccount])

      await useCalculatorStore.getState().syncFromDb("session-1")

      const state = useCalculatorStore.getState()
      expect(state.scenarioList).toHaveLength(1)
      expect(state.activeScenarioId).toBe("scenario-1")
      expect(state.accounts).toHaveLength(1)
    })

    it("should clear scenario state without creating one when the account has zero scenarios", async () => {
      const createScenario = vi.spyOn(scenariosApi, "createScenario")
      vi.spyOn(scenariosApi, "listScenarios").mockResolvedValue([])

      await useCalculatorStore.getState().syncFromDb("session-1")

      const state = useCalculatorStore.getState()
      expect(state.activeScenarioId).toBeNull()
      expect(state.scenarioList).toHaveLength(0)
      expect(createScenario).not.toHaveBeenCalled()
    })

    it("should restore previously active scenario if available", async () => {
      const scenario2 = { id: "scenario-2", name: "Second", updatedAt: new Date().toISOString(), claimComplete: true }
      useCalculatorStore.setState({ activeScenarioId: "scenario-1" })

      vi.spyOn(scenariosApi, "listScenarios").mockResolvedValue([scenario2, mockScenarioMeta])
      vi.spyOn(scenariosApi, "fetchScenario").mockResolvedValue(mockScenarioData)
      vi.spyOn(accountsApi, "fetchAccounts").mockResolvedValue([])

      await useCalculatorStore.getState().syncFromDb("session-1")

      const state = useCalculatorStore.getState()
      expect(state.activeScenarioId).toBe("scenario-1")
    })

    it("should load most recent scenario if previous is gone", async () => {
      vi.spyOn(scenariosApi, "listScenarios").mockResolvedValue([mockScenarioMeta])
      vi.spyOn(scenariosApi, "fetchScenario").mockResolvedValue(mockScenarioData)
      vi.spyOn(accountsApi, "fetchAccounts").mockResolvedValue([])

      await useCalculatorStore.getState().syncFromDb("session-1")

      const state = useCalculatorStore.getState()
      expect(state.activeScenarioId).toBe("scenario-1")
    })

    it("should not sync if already in progress", async () => {
      vi.spyOn(scenariosApi, "listScenarios").mockImplementation(async () => {
        // Simulate slow operation
        await new Promise((resolve) => setTimeout(resolve, 100))
        return []
      })

      const promise1 = useCalculatorStore.getState().syncFromDb("session-1")
      const promise2 = useCalculatorStore.getState().syncFromDb("session-1")

      await Promise.all([promise1, promise2])

      expect(scenariosApi.listScenarios).toHaveBeenCalledTimes(1)
    })

    it("should not sync if identity does not match the requested user", async () => {
      useCalculatorStore.setState({ identity: { kind: "guest" } })
      vi.spyOn(scenariosApi, "listScenarios").mockResolvedValue([])

      await useCalculatorStore.getState().syncFromDb("session-1")

      expect(scenariosApi.listScenarios).not.toHaveBeenCalled()
    })
  })

  describe("Sync timing", () => {
    it("should debounce multiple updates", () => {
      vi.useFakeTimers()
      useCalculatorStore.getState().setIdentity({ kind: "user", userId: "session-1" })
      useCalculatorStore.setState({ activeScenarioId: "scenario-1" })
      vi.spyOn(scenariosApi, "updateScenario").mockResolvedValue(undefined)

      useCalculatorStore.getState().setPersonalInfo({ currentAge: 50 })
      useCalculatorStore.getState().setRetirementGoals({ desiredMonthlyIncome: 35000 })

      vi.advanceTimersByTime(400)
      expect(scenariosApi.updateScenario).not.toHaveBeenCalled()

      vi.advanceTimersByTime(400)
      expect(scenariosApi.updateScenario).toHaveBeenCalledTimes(1)
    })
  })
})

describe('local-only mode (no session)', () => {
  it('does not attempt a DB read when identity is guest', async () => {
    useCalculatorStore.setState({ identity: { kind: "guest" }, activeScenarioId: null })
    await useCalculatorStore.getState().syncFromDb("session-1")
    expect(useCalculatorStore.getState().activeScenarioId).toBeNull()
  })

  it('keeps account edits in memory when signed out', () => {
    useCalculatorStore.setState({ identity: { kind: "guest" }, accounts: [] })
    useCalculatorStore.getState().addAccount({
      id: 'acc-local-1',
      name: 'Local RA',
      provider: 'Test Provider',
      type: 'retirement_annuity',
      currentBalance: 100000,
      monthlyContribution: 5000,
      contributionEscalation: 6,
      expectedReturn: 11,
      annualFees: 0.75,
    })
    expect(useCalculatorStore.getState().accounts).toHaveLength(1)
  })
})

describe('persist migration v1 → v2 (monetary cap)', () => {
  const absurd = 8.798456465498799e39

  const migrate = useCalculatorStore.persist.getOptions().migrate

  it('clamps stale absurd monetary values on rehydrate', () => {
    const migrated = migrate!(
      {
        personalInfo: { currentAge: 35, retirementAge: 65, lifeExpectancy: 90, annualIncome: absurd },
        retirementGoals: { desiredMonthlyIncome: absurd, inflationRate: 5.5, legacyAmount: absurd },
        drawdownConfig: { strategy: 'fixed_percentage', initialWithdrawalRate: 4, minimumWithdrawal: absurd, maximumWithdrawal: absurd, lumpSumPercentage: 0 },
        accounts: [{ ...mockAccount, currentBalance: absurd, monthlyContribution: absurd }],
      } as unknown,
      1
    ) as CalculatorState

    expect(migrated.personalInfo.annualIncome).toBe(1_000_000_000_000)
    expect(migrated.retirementGoals.desiredMonthlyIncome).toBe(1_000_000_000_000)
    expect(migrated.retirementGoals.legacyAmount).toBe(1_000_000_000_000)
    expect(migrated.drawdownConfig.minimumWithdrawal).toBe(1_000_000_000_000)
    expect(migrated.drawdownConfig.maximumWithdrawal).toBe(1_000_000_000_000)
    expect(migrated.accounts[0].currentBalance).toBe(1_000_000_000_000)
    expect(migrated.accounts[0].monthlyContribution).toBe(1_000_000_000_000)
  })

  it('preserves finite values and optional undefined fields untouched', () => {
    const migrated = migrate!(
      {
        personalInfo: { currentAge: 35, retirementAge: 65, lifeExpectancy: 90, annualIncome: 600000 },
        retirementGoals: { desiredMonthlyIncome: 30000, inflationRate: 5.5, legacyAmount: 0 },
        drawdownConfig: { strategy: 'fixed_percentage', initialWithdrawalRate: 4, minimumWithdrawal: 15000, maximumWithdrawal: 60000, lumpSumPercentage: 0 },
        accounts: [{ ...mockAccount, tfsaContributionsToDate: undefined }],
      } as unknown,
      1
    ) as CalculatorState

    expect(migrated.personalInfo.annualIncome).toBe(600000)
    expect(migrated.retirementGoals.desiredMonthlyIncome).toBe(30000)
    expect(migrated.drawdownConfig.minimumWithdrawal).toBe(15000)
    expect(migrated.accounts[0].tfsaContributionsToDate).toBeUndefined()
  })

  it('handles incomplete persisted state with safe fallbacks', () => {
    const migrated = migrate!(
      {
        personalInfo: {},
        retirementGoals: {},
        drawdownConfig: {},
      } as unknown,
      1
    ) as CalculatorState

    expect(migrated.personalInfo.annualIncome).toBe(0)
    expect(migrated.retirementGoals.desiredMonthlyIncome).toBe(0)
    expect(migrated.retirementGoals.legacyAmount).toBe(0)
    expect(migrated.drawdownConfig.minimumWithdrawal).toBe(0)
    expect(migrated.drawdownConfig.maximumWithdrawal).toBe(0)
    expect(migrated.drawdownConfig.monthlyMedicalAid).toBeUndefined()
    expect(migrated.accounts).toEqual([])
  })

  it('clamps present optional monetary fields', () => {
    const migrated = migrate!(
      {
        drawdownConfig: { monthlyMedicalAid: absurd },
        accounts: [{ ...mockAccount, tfsaContributionsToDate: absurd }],
      } as unknown,
      1
    ) as CalculatorState

    expect(migrated.drawdownConfig.monthlyMedicalAid).toBe(1_000_000_000_000)
    expect(migrated.accounts[0].tfsaContributionsToDate).toBe(1_000_000_000_000)
  })
})

describe('persist write-gate (auth-before-rehydrate clobber regression)', () => {
  // A fresh module gives a fresh store whose gate is still closed — mirroring
  // the first page load where SupabaseProvider's setSessionId races the
  // layout's manual rehydrate().
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  const persistedSnapshot = {
    identity: { kind: "guest" },
    activeScenarioId: null,
    personalInfo: { currentAge: 45, retirementAge: 65, lifeExpectancy: 90, annualIncome: 600000 },
    retirementGoals: { desiredMonthlyIncome: 30000, inflationRate: 5.5, legacyAmount: 0 },
    assumptions: {
      equityReturn: 10.5,
      bondReturn: 8,
      cashReturn: 3,
      equityVolatility: 16,
      bondVolatility: 8,
      inflationRate: 5.5,
      compoundingMethod: 'nominal',
    },
    drawdownConfig: {
      strategy: 'fixed_percentage',
      initialWithdrawalRate: 4,
      minimumWithdrawal: 15000,
      maximumWithdrawal: 60000,
      lumpSumPercentage: 0,
      upperGuardrail: 20,
      lowerGuardrail: 20,
    },
    displayMode: 'nominal',
    accounts: [
      {
        id: 'persisted-1',
        name: 'Persisted RA',
        provider: 'Allan Gray',
        type: 'retirement_annuity' as const,
        currentBalance: 250000,
        monthlyContribution: 4000,
        contributionEscalation: 6,
        expectedReturn: 11,
        annualFees: 0.75,
      },
    ],
  }

  it('survives a setSessionId fired before the layout rehydrate reads storage', async () => {
    localStorage.setItem(
      'retirement-calculator-storage:guest',
      JSON.stringify({ state: persistedSnapshot, version: 2 })
    )

    const { useCalculatorStore: freshStore } = await import('./calculator-store')

    // SupabaseProvider races the layout: auth-driven setSessionId fires first
    // while the store is still holding its pre-hydration defaults.
    freshStore.getState().setIdentity({ kind: "guest" })

    await freshStore.persist.rehydrate()

    // The persisted plan must have survived the setSessionId write.
    expect(freshStore.getState().personalInfo.currentAge).toBe(45)
    expect(freshStore.getState().accounts).toHaveLength(1)
    expect(freshStore.getState().accounts[0].name).toBe('Persisted RA')

    // And localStorage must still hold the plan, not the pre-hydration defaults.
    const stored = JSON.parse(localStorage.getItem('retirement-calculator-storage:guest')!)
    expect(stored.state.personalInfo.currentAge).toBe(45)
    expect(stored.state.accounts).toHaveLength(1)
  })

  it('persists subsequent writes once rehydrate has settled', async () => {
    localStorage.setItem(
      'retirement-calculator-storage:guest',
      JSON.stringify({ state: { ...persistedSnapshot, accounts: [] }, version: 2 })
    )

    const { useCalculatorStore: freshStore } = await import('./calculator-store')

    await freshStore.persist.rehydrate()
    freshStore.getState().setPersonalInfo({ currentAge: 52 })

    const stored = JSON.parse(localStorage.getItem('retirement-calculator-storage:guest')!)
    expect(stored.state.personalInfo.currentAge).toBe(52)
  })
})

describe("identity transitions and stale-write guards", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    useCalculatorStore.setState({
      accounts: [],
      identity: { kind: "guest" },
      activeScenarioId: null,
      scenarioList: [],
    })
  })

  it("clears active scenario metadata on sign-out", () => {
    useCalculatorStore.getState().setIdentity({ kind: "user", userId: "user-a" })
    useCalculatorStore.setState({ activeScenarioId: "scenario-1", scenarioList: [mockScenarioMeta] })

    useCalculatorStore.getState().setIdentity({ kind: "guest" })

    expect(useCalculatorStore.getState()).toEqual(
      expect.objectContaining({ identity: { kind: "guest" }, activeScenarioId: null, scenarioList: [] })
    )
  })

  it("does not update the previous user's scenario after sign-out", async () => {
    useCalculatorStore.getState().setIdentity({ kind: "user", userId: "user-a" })
    useCalculatorStore.setState({ activeScenarioId: "scenario-1" })
    useCalculatorStore.getState().setDrawdownConfig({ initialWithdrawalRate: 4.5 })
    useCalculatorStore.getState().setIdentity({ kind: "guest" })
    await vi.advanceTimersByTimeAsync(1000)

    expect(scenariosApi.updateScenario).not.toHaveBeenCalled()
  })

  it("does not delete a previous user's account from a signed-out store", () => {
    useCalculatorStore.getState().setIdentity({ kind: "guest" })
    useCalculatorStore.getState().removeAccount("user-a-account")

    expect(accountsApi.deleteAccount).not.toHaveBeenCalled()
  })

  it("evicts the signed-out user's scoped storage keys", () => {
    localStorage.setItem("retirement-calculator-storage:user:user-a", JSON.stringify({ state: {} }))
    localStorage.setItem("expenses-store-v2:user:user-a", JSON.stringify({ state: {} }))
    useCalculatorStore.getState().setIdentity({ kind: "user", userId: "user-a" })

    useCalculatorStore.getState().setIdentity({ kind: "guest" })

    expect(localStorage.getItem("retirement-calculator-storage:user:user-a")).toBeNull()
    expect(localStorage.getItem("expenses-store-v2:user:user-a")).toBeNull()
  })

  it("does not commit user A's sync after switching to user B", async () => {
    let resolveFetch!: (value: typeof mockScenarioData | null) => void
    vi.spyOn(scenariosApi, "listScenarios").mockResolvedValue([mockScenarioMeta])
    vi.spyOn(scenariosApi, "fetchScenario").mockReturnValue(
      new Promise<typeof mockScenarioData | null>((resolve) => {
        resolveFetch = resolve
      })
    )
    vi.spyOn(accountsApi, "fetchAccounts").mockResolvedValue([])

    useCalculatorStore.getState().setIdentity({ kind: "user", userId: "user-a" })
    const sync = useCalculatorStore.getState().syncFromDb("user-a")
    // User B supersedes user A while A's fetch is still pending.
    useCalculatorStore.getState().setIdentity({ kind: "user", userId: "user-b" })
    resolveFetch(mockScenarioData)
    await sync

    // A's late response must not have been committed under user B.
    expect(useCalculatorStore.getState().identity).toEqual({ kind: "user", userId: "user-b" })
    expect(useCalculatorStore.getState().activeScenarioId).toBeNull()
  })
})

describe("sync null-data path", () => {
  it("uses the first scenario when fetchScenario returns null", async () => {
    vi.clearAllMocks()
    vi.useRealTimers()
    useCalculatorStore.setState({ identity: { kind: "user", userId: "session-1" }, activeScenarioId: null })
    vi.spyOn(scenariosApi, "listScenarios").mockResolvedValue([mockScenarioMeta])
    vi.spyOn(scenariosApi, "fetchScenario").mockResolvedValue(null)
    vi.spyOn(accountsApi, "fetchAccounts").mockResolvedValue([])

    await useCalculatorStore.getState().syncFromDb("session-1")

    expect(useCalculatorStore.getState().activeScenarioId).toBe("scenario-1")
  })
})

describe("write-guard abort paths", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    useCalculatorStore.setState({
      accounts: [],
      identity: { kind: "guest" },
      activeScenarioId: null,
      scenarioList: [],
    })
  })

  it("drops a debounced scenario sync when the user switched (no cancel)", async () => {
    // Unlike sign-out (which cancels the timer), a user switch must rely on the
    // fire-time re-check: user A schedules, user B takes over, the timer fires.
    useCalculatorStore.getState().setIdentity({ kind: "user", userId: "user-a" })
    useCalculatorStore.setState({ activeScenarioId: "scenario-1" })
    useCalculatorStore.getState().setDrawdownConfig({ initialWithdrawalRate: 4.5 })
    useCalculatorStore.getState().setIdentity({ kind: "user", userId: "user-b" })

    await vi.advanceTimersByTimeAsync(1000)

    expect(scenariosApi.updateScenario).not.toHaveBeenCalled()
  })

  it("rejects a stale generation's late sync response", async () => {
    const gen1Deferred = {
      resolve: null as null | ((v: typeof mockScenarioMeta[]) => void),
    }
    vi.spyOn(scenariosApi, "listScenarios")
      .mockReturnValueOnce(
        new Promise<typeof mockScenarioMeta[]>((resolve) => {
          gen1Deferred.resolve = resolve
        })
      )
      .mockResolvedValueOnce([mockScenarioMeta])
    vi.spyOn(scenariosApi, "fetchScenario").mockResolvedValue(mockScenarioData)
    vi.spyOn(accountsApi, "fetchAccounts").mockResolvedValue([])

    useCalculatorStore.getState().setIdentity({ kind: "user", userId: "user-a" })
    const sync1 = useCalculatorStore.getState().syncFromDb("user-a", 1)
    // A newer generation for the same user supersedes generation 1.
    const sync2 = useCalculatorStore.getState().syncFromDb("user-a", 2)
    await sync2
    gen1Deferred.resolve!([mockScenarioMeta])
    await sync1

    // Generation 2's result is committed; generation 1's late response dropped.
    expect(useCalculatorStore.getState().activeScenarioId).toBe("scenario-1")
  })

  it("skips the seed's DB chain when the user changed mid-flight", async () => {
    vi.spyOn(accountsApi, "deleteAccount").mockResolvedValue(undefined)
    vi.spyOn(accountsApi, "upsertAccount").mockResolvedValue(undefined)
    useCalculatorStore.getState().setIdentity({ kind: "user", userId: "user-a" })
    useCalculatorStore.setState({ activeScenarioId: "scenario-1", accounts: [mockAccount] })

    useCalculatorStore.getState().seedAccounts([mockAccount])
    // User B takes over before the delete chain resolves.
    useCalculatorStore.getState().setIdentity({ kind: "user", userId: "user-b" })
    await Promise.resolve()
    await Promise.resolve()

    // The user's own delete chain may start (cleanup of their own accounts);
    // the guard prevents INSERTING the new accounts under the stale identity.
    expect(accountsApi.upsertAccount).not.toHaveBeenCalled()
  })

  it("refuses to create a scenario from a signed-out store", async () => {
    vi.spyOn(scenariosApi, "createScenario").mockResolvedValue("scenario-new")
    useCalculatorStore.getState().setIdentity({ kind: "guest" })

    useCalculatorStore.getState().createNewScenario("My Plan")

    expect(scenariosApi.createScenario).not.toHaveBeenCalled()
  })

  it("refuses to rename a scenario from a signed-out store", async () => {
    vi.spyOn(scenariosApi, "renameScenario").mockResolvedValue(undefined)
    useCalculatorStore.setState({ scenarioList: [mockScenarioMeta] })

    useCalculatorStore.getState().renameScenario("scenario-1", "New Name")

    expect(scenariosApi.renameScenario).not.toHaveBeenCalled()
  })

  it("refuses to delete a scenario from a signed-out store", async () => {
    vi.spyOn(scenariosApi, "deleteScenario").mockResolvedValue(undefined)
    useCalculatorStore.setState({ scenarioList: [mockScenarioMeta] })

    useCalculatorStore.getState().deleteScenario("scenario-1")

    expect(scenariosApi.deleteScenario).not.toHaveBeenCalled()
  })

  it("refuses to delete a scenario once the user changed mid-await", async () => {
    vi.spyOn(scenariosApi, "deleteScenario").mockResolvedValue(undefined)
    useCalculatorStore.getState().setIdentity({ kind: "user", userId: "user-a" })
    useCalculatorStore.setState({
      scenarioList: [mockScenarioMeta, { ...mockScenarioMeta, id: "scenario-2" }],
    })

    const pending = useCalculatorStore.getState().deleteScenario("scenario-1")
    // User B takes over while the delete is in flight.
    useCalculatorStore.getState().setIdentity({ kind: "user", userId: "user-b" })
    await pending

    expect(useCalculatorStore.getState().scenarioList).toHaveLength(2)
  })
})
