import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { useCalculatorStore } from "./calculator-store"
import * as accountsApi from "@/lib/supabase/accounts"
import * as scenariosApi from "@/lib/supabase/scenarios"
import { SA_DEFAULTS } from "@/lib/constants/defaults"

vi.mock("@/lib/supabase/accounts")
vi.mock("@/lib/supabase/scenarios")

const mockAccount = {
  id: "acc-1",
  scenarioId: "scenario-1",
  type: "TFSA" as const,
  name: "My TFSA",
  balance: 100000,
  monthlyContribution: 500,
  contributionEscalation: 0,
  color: "#818cf8",
}

const mockScenarioMeta = {
  id: "scenario-1",
  name: "My Plan",
  updatedAt: new Date().toISOString(),
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
      sessionId: null,
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
      expect(state.sessionId).toBe(null)
      expect(state.activeScenarioId).toBe(null)
      expect(state.accounts).toEqual([])
      expect(state.scenarioList).toEqual([])
      expect(state.displayMode).toBe("nominal")
      expect(state.personalInfo.annualIncome).toBe(600000)
    })
  })

  describe("Session & ID management", () => {
    it("should set session ID", () => {
      useCalculatorStore.getState().setSessionId("session-123")
      expect(useCalculatorStore.getState().sessionId).toBe("session-123")
    })
  })

  describe("Account operations", () => {
    it("should add account to state and DB", () => {
      vi.spyOn(accountsApi, "upsertAccount").mockResolvedValue(undefined)
      useCalculatorStore.getState().setSessionId("session-1")
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
      useCalculatorStore.getState().setSessionId("session-1")
      useCalculatorStore.setState({ activeScenarioId: "scenario-1" })
      useCalculatorStore.getState().addAccount(mockAccount)

      useCalculatorStore.getState().updateAccount("acc-1", { balance: 150000 })

      const state = useCalculatorStore.getState()
      expect(state.accounts[0].balance).toBe(150000)
    })

    it("should remove account from state and DB", () => {
      vi.spyOn(accountsApi, "deleteAccount").mockResolvedValue(undefined)
      useCalculatorStore.setState({ accounts: [mockAccount] })

      useCalculatorStore.getState().removeAccount("acc-1")

      const state = useCalculatorStore.getState()
      expect(state.accounts).toHaveLength(0)
      expect(accountsApi.deleteAccount).toHaveBeenCalledWith("acc-1")
    })

    it("should seed accounts with new IDs", () => {
      vi.spyOn(accountsApi, "upsertAccount").mockResolvedValue(undefined)
      vi.spyOn(accountsApi, "deleteAccount").mockResolvedValue(undefined)
      useCalculatorStore.getState().setSessionId("session-1")
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
      useCalculatorStore.getState().setSessionId("session-1")
      useCalculatorStore.setState({ activeScenarioId: "scenario-1" })
      vi.spyOn(scenariosApi, "updateScenario").mockResolvedValue(undefined)

      useCalculatorStore.getState().setPersonalInfo({ currentAge: 50 })

      expect(useCalculatorStore.getState().personalInfo.currentAge).toBe(50)

      vi.advanceTimersByTime(800)
      expect(scenariosApi.updateScenario).toHaveBeenCalled()
    })

    it("should update retirement goals and schedule sync", () => {
      vi.useFakeTimers()
      useCalculatorStore.getState().setSessionId("session-1")
      useCalculatorStore.setState({ activeScenarioId: "scenario-1" })
      vi.spyOn(scenariosApi, "updateScenario").mockResolvedValue(undefined)

      useCalculatorStore.getState().setRetirementGoals({ desiredMonthlyIncome: 40000 })

      expect(useCalculatorStore.getState().retirementGoals.desiredMonthlyIncome).toBe(40000)

      vi.advanceTimersByTime(800)
      expect(scenariosApi.updateScenario).toHaveBeenCalled()
    })

    it("should update assumptions and schedule sync", () => {
      vi.useFakeTimers()
      useCalculatorStore.getState().setSessionId("session-1")
      useCalculatorStore.setState({ activeScenarioId: "scenario-1" })
      vi.spyOn(scenariosApi, "updateScenario").mockResolvedValue(undefined)

      useCalculatorStore.getState().setAssumptions({ equityReturn: 12 })

      expect(useCalculatorStore.getState().assumptions.equityReturn).toBe(12)

      vi.advanceTimersByTime(800)
      expect(scenariosApi.updateScenario).toHaveBeenCalled()
    })

    it("should update drawdown config and schedule sync", () => {
      vi.useFakeTimers()
      useCalculatorStore.getState().setSessionId("session-1")
      useCalculatorStore.setState({ activeScenarioId: "scenario-1" })
      vi.spyOn(scenariosApi, "updateScenario").mockResolvedValue(undefined)

      useCalculatorStore.getState().setDrawdownConfig({ initialWithdrawalRate: 3.5 })

      expect(useCalculatorStore.getState().drawdownConfig.initialWithdrawalRate).toBe(3.5)

      vi.advanceTimersByTime(800)
      expect(scenariosApi.updateScenario).toHaveBeenCalled()
    })

    it("should update display mode and schedule sync", () => {
      vi.useFakeTimers()
      useCalculatorStore.getState().setSessionId("session-1")
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
        sessionId: "session-123",
      })

      useCalculatorStore.getState().resetToDefaults()

      const state = useCalculatorStore.getState()
      expect(state.personalInfo.currentAge).toBe(SA_DEFAULTS.defaultCurrentAge)
      expect(state.accounts).toHaveLength(0)
      expect(state.sessionId).toBe(null)
    })
  })

  describe("Scenario operations", () => {
    beforeEach(() => {
      useCalculatorStore.getState().setSessionId("session-1")
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
      const scenario2 = { id: "scenario-2", name: "Second Plan", updatedAt: new Date().toISOString() }
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
      useCalculatorStore.getState().setSessionId("session-1")
    })

    it("should sync existing scenarios list", async () => {
      vi.spyOn(scenariosApi, "listScenarios").mockResolvedValue([mockScenarioMeta])
      vi.spyOn(scenariosApi, "fetchScenario").mockResolvedValue(mockScenarioData)
      vi.spyOn(accountsApi, "fetchAccounts").mockResolvedValue([mockAccount])

      await useCalculatorStore.getState().syncFromDb()

      const state = useCalculatorStore.getState()
      expect(state.scenarioList).toHaveLength(1)
      expect(state.activeScenarioId).toBe("scenario-1")
      expect(state.accounts).toHaveLength(1)
    })

    it("should create default scenario on first sign-in", async () => {
      vi.spyOn(scenariosApi, "listScenarios").mockResolvedValue([])
      vi.spyOn(scenariosApi, "createScenario").mockResolvedValue("new-default-scenario")
      vi.spyOn(accountsApi, "cloneAccounts").mockResolvedValue([])

      await useCalculatorStore.getState().syncFromDb()

      const state = useCalculatorStore.getState()
      expect(state.activeScenarioId).toBe("new-default-scenario")
      expect(state.scenarioList).toHaveLength(1)
      expect(state.scenarioList[0].name).toBe("My Plan")
    })

    it("should restore previously active scenario if available", async () => {
      const scenario2 = { id: "scenario-2", name: "Second", updatedAt: new Date().toISOString() }
      useCalculatorStore.setState({ activeScenarioId: "scenario-1" })

      vi.spyOn(scenariosApi, "listScenarios").mockResolvedValue([scenario2, mockScenarioMeta])
      vi.spyOn(scenariosApi, "fetchScenario").mockResolvedValue(mockScenarioData)
      vi.spyOn(accountsApi, "fetchAccounts").mockResolvedValue([])

      await useCalculatorStore.getState().syncFromDb()

      const state = useCalculatorStore.getState()
      expect(state.activeScenarioId).toBe("scenario-1")
    })

    it("should load most recent scenario if previous is gone", async () => {
      vi.spyOn(scenariosApi, "listScenarios").mockResolvedValue([mockScenarioMeta])
      vi.spyOn(scenariosApi, "fetchScenario").mockResolvedValue(mockScenarioData)
      vi.spyOn(accountsApi, "fetchAccounts").mockResolvedValue([])

      await useCalculatorStore.getState().syncFromDb()

      const state = useCalculatorStore.getState()
      expect(state.activeScenarioId).toBe("scenario-1")
    })

    it("should not sync if already in progress", async () => {
      vi.spyOn(scenariosApi, "listScenarios").mockImplementation(async () => {
        // Simulate slow operation
        await new Promise((resolve) => setTimeout(resolve, 100))
        return []
      })

      const promise1 = useCalculatorStore.getState().syncFromDb()
      const promise2 = useCalculatorStore.getState().syncFromDb()

      await Promise.all([promise1, promise2])

      expect(scenariosApi.listScenarios).toHaveBeenCalledTimes(1)
    })

    it("should skip sync if no session ID", async () => {
      useCalculatorStore.setState({ sessionId: null })
      vi.spyOn(scenariosApi, "listScenarios").mockResolvedValue([])

      await useCalculatorStore.getState().syncFromDb()

      expect(scenariosApi.listScenarios).not.toHaveBeenCalled()
    })
  })

  describe("Sync timing", () => {
    it("should debounce multiple updates", () => {
      vi.useFakeTimers()
      useCalculatorStore.getState().setSessionId("session-1")
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
